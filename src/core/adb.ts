import net from 'node:net';
import path from 'node:path';
import {generateKeyPairSync,randomUUID} from 'node:crypto';
import {Adb,AdbDaemonTransport,AdbServerClient,type AdbPacketData,type AdbPacketInit,type AdbCredentialStore} from '@yume-chan/adb';
import {TcpAdbConnector} from './adb-server';
import {ReadableStream,WritableStream,Consumable} from '@yume-chan/stream-extra';
import {safeRelative,type Location} from '../shared/model';
import {Store,optionalRead,atomicWrite} from './storage';
import {sha256} from './unity';
import type {Transport} from './local';

export const emulatorPorts=[5555,7555,16384,16416,62001,21503];
export async function portOpen(port:number){
  return new Promise<boolean>((resolve,reject)=>{
    const socket=net.connect({host:'127.0.0.1',port});
    socket.setTimeout(550);
    socket.once('connect',()=>{socket.destroy();resolve(true)});
    socket.once('timeout',()=>{socket.destroy();resolve(false)});
    socket.once('error',(e:NodeJS.ErrnoException)=>{socket.destroy();if(['ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(e.code??''))resolve(false);else reject(e)});
  });
}
export async function listDevices(){
  const devices:{serial:string;label:string;port:number;connection:'server'|'direct';state:string}[]=[];
  if(await portOpen(5037)){
    const client=new AdbServerClient(new TcpAdbConnector(5037));
    for(const d of await client.getDevices(['device','offline','unauthorized']))devices.push({serial:d.serial,label:d.model??d.serial,port:5037,connection:'server',state:d.state});
  }
  for(const port of emulatorPorts)if(await portOpen(port))devices.push({serial:'127.0.0.1:'+port,label:'模拟器 · '+port,port,connection:'direct',state:'available'});
  return devices;
}
async function directAdb(port:number,store:Store){
  const socket=net.connect({host:'127.0.0.1',port});
  await new Promise<void>((resolve,reject)=>{socket.once('connect',resolve);socket.once('error',reject);socket.setTimeout(5000,()=>socket.destroy(new Error('模拟器连接超时'))) });
  socket.setTimeout(0);
  let pending=Buffer.alloc(0),ended=false;
  const readable=new ReadableStream<AdbPacketData>({
    start(controller){
      socket.on('data',chunk=>{
        if(ended)return;
        try {
          if(typeof chunk==='string')throw new Error('ADB socket 意外进入文本模式');
          pending=Buffer.concat([pending,chunk]);
          while(pending.length>=24){
            const command=pending.readUInt32LE(0),length=pending.readUInt32LE(12),magic=pending.readUInt32LE(20);
            if(length>16*1024*1024||magic!==((command^0xffffffff)>>>0))throw new Error('模拟器返回了无效的 ADB 帧');
            if(pending.length<24+length)break;
            const payload=Buffer.from(pending.subarray(24,24+length)),checksum=pending.readUInt32LE(16);
            if(checksum!==0&&checksum!==payload.reduce((n,b)=>n+b,0))throw new Error('ADB 帧摘要错误');
            controller.enqueue({command,arg0:pending.readUInt32LE(4),arg1:pending.readUInt32LE(8),payload});
            pending=Buffer.from(pending.subarray(24+length));
          }
        } catch(error){if(!ended){ended=true;controller.error(error)}socket.destroy()}
      });
      socket.on('error',error=>{if(!ended){ended=true;controller.error(error)}});
      socket.on('close',()=>{if(!ended){ended=true;controller.close()}});
    },cancel(){ended=true;socket.destroy()},
  });
  const writable=new WritableStream<Consumable<AdbPacketInit>>({
    async write(chunk){await chunk.tryConsume(async packet=>{
      const h=Buffer.alloc(24);[packet.command,packet.arg0,packet.arg1,packet.payload.length,packet.checksum,packet.magic>>>0].forEach((v,i)=>h.writeUInt32LE(v>>>0,i*4));
      await new Promise<void>((resolve,reject)=>socket.write(Buffer.concat([h,Buffer.from(packet.payload)]),e=>e?reject(e):resolve()));
    })},close(){socket.end()},abort(){socket.destroy()},
  });
  const keyFile=store.file('adb-private.pk8');
  const credentials:AdbCredentialStore={
    async generateKey(){
      const pair=generateKeyPairSync('rsa',{modulusLength:2048,publicExponent:65537});
      const buffer=pair.privateKey.export({type:'pkcs8',format:'der'});
      await atomicWrite(keyFile,buffer);return{buffer,name:'wardtone'};
    },async *iterateKeys(){const buffer=await optionalRead(keyFile);if(buffer)yield{buffer,name:'wardtone'}},
  };
  const timer=setTimeout(()=>socket.destroy(new Error('ADB 授权超时，请在模拟器中允许本机调试')),25000);
  try {return new Adb(await AdbDaemonTransport.authenticate({serial:'127.0.0.1:'+port,connection:{readable,writable},credentialStore:credentials,readTimeLimit:15000}))}
  catch(error){socket.destroy();throw error}
  finally{clearTimeout(timer)}
}
export async function connectAdb(location:Location,store:Store){
  if(location.connection==='direct')return directAdb(location.port??5555,store);
  if(!location.serial)throw new Error('尚未选择模拟器');
  return new AdbServerClient(new TcpAdbConnector(location.port??5037)).createAdb({serial:location.serial});
}
export async function shell(adb:Adb,args:string[]){
  const service=adb.subprocess.shellProtocol;
  if(!service)throw new Error('模拟器未提供带退出状态的 ADB shell，请升级模拟器后重试');
  const result=await service.spawnWaitText(args);
  if(result.exitCode!==0)throw new Error(`模拟器命令失败 (${result.exitCode})：${result.stderr.trim()||result.stdout.trim()}`);
  return result.stdout;
}
const quote=(value:string)=>"'"+value.replaceAll("'","'\\''")+"'";
export class AdbTransport implements Transport {
  constructor(public location:Location,readonly adb:Adb){}
  async resolve(relative:string){
    safeRelative.parse(relative);
    const root=(await shell(this.adb,['readlink','-f',this.location.root])).trim();
    if(!root.startsWith('/')||root==='/')throw new Error('模拟器资源根目录无效');
    const requested=path.posix.join(root,relative),actual=(await shell(this.adb,['readlink','-f',requested])).trim();
    if(actual!==requested||!actual.startsWith(root+'/'))throw new Error('模拟器资源路径包含链接或越界');
    return actual;
  }
  async read(relative:string){
    const file=await this.resolve(relative),sync=await this.adb.sync();
    try {
      const stat=await sync.lstat(file);if(Number(stat.size)>128*1024*1024)throw new Error('资源文件超过 128 MB');
      const reader=sync.read(file).getReader();const chunks:Buffer[]=[];let size=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>128*1024*1024)throw new Error('资源读取超限');chunks.push(Buffer.from(value))}}
      catch(error){try{await reader.cancel(error)}catch(cancelError){throw new AggregateError([error,cancelError],'模拟器读取失败且中止失败')}throw error}
      finally{reader.releaseLock()}
      return Buffer.concat(chunks);
    }finally{await sync.dispose()}
  }
  async exists(relative:string){safeRelative.parse(relative);const output=await shell(this.adb,['sh','-c',`if [ -f ${quote(path.posix.join(this.location.root,relative))} ]; then printf yes; else printf no; fi`]);return output==='yes'}
  async replace(relative:string,expectedHash:string,data:Buffer){
    const file=await this.resolve(relative);
    if(sha256(await this.read(relative))!==expectedHash)throw new Error('模拟器文件被外部修改：'+relative);
    const temp=path.posix.join(path.posix.dirname(relative),'.wardtone-'+randomUUID()+'.tmp');
    const sync=await this.adb.sync();
    try{await sync.write({filename:path.posix.join(this.location.root,temp),file:new ReadableStream({start(c){c.enqueue(data);c.close()}}),permission:0o644})}finally{await sync.dispose()}
    if(sha256(await this.read(temp))!==sha256(data))throw new Error('模拟器暂存文件校验失败：'+temp);
    if(sha256(await this.read(relative))!==expectedHash)throw new Error('模拟器提交前出现外部修改：'+relative);
    await shell(this.adb,['mv','-f',path.posix.join(this.location.root,temp),file]);
    if(sha256(await this.read(relative))!==sha256(data))throw new Error('模拟器写入后校验失败：'+relative);
  }
  async close(){await this.adb.close()}
}
