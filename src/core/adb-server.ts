import net from 'node:net';
import type {AdbServerClient} from '@yume-chan/adb';
import {ReadableStream,MaybeConsumable} from '@yume-chan/stream-extra';

/** Every server socket has an idle deadline; an unrelated service on 5037 cannot stall the worker queue. */
export class TcpAdbConnector implements AdbServerClient.ServerConnector {
  constructor(readonly port=5037,readonly timeout=15000){}
  async connect(options:AdbServerClient.ServerConnectionOptions={}):Promise<AdbServerClient.ServerConnection>{
    const socket=new net.Socket();
    const abort=()=>socket.destroy(new Error('ADB 连接已中止',{cause:options.signal?.reason}));
    options.signal?.addEventListener('abort',abort);
    socket.once('close',()=>options.signal?.removeEventListener('abort',abort));
    if(options.unref)socket.unref();
    socket.setNoDelay(true);
    socket.setTimeout(this.timeout,()=>socket.destroy(new Error('ADB 服务响应超时，请检查模拟器调试端口')));
    let ended=false;
    const readable=new ReadableStream<Uint8Array>({
      start(controller){
        socket.on('data',data=>{if(ended)return;if(typeof data==='string'){socket.destroy(new Error('ADB socket 意外进入文本模式'));return}controller.enqueue(new Uint8Array(data));if((controller.desiredSize??0)<=0)socket.pause()});
        socket.on('error',error=>{if(!ended){ended=true;controller.error(error)}});
        socket.on('close',()=>{if(!ended){ended=true;controller.close()}});
      },pull(){socket.resume()},cancel(){ended=true;socket.destroy()},
    });
    const writable=new MaybeConsumable.WritableStream<Uint8Array>({
      write(chunk){return new Promise<void>((resolve,reject)=>socket.write(chunk,error=>error?reject(error):resolve()))},
      close(){socket.end()},abort(){socket.destroy()},
    });
    const closed=new Promise<undefined>(resolve=>socket.once('close',()=>resolve(undefined)));
    await new Promise<void>((resolve,reject)=>{
      socket.once('connect',resolve);socket.once('error',reject);
      if(options.signal?.aborted)abort();else socket.connect({host:'127.0.0.1',port:this.port});
    });
    return{readable,writable,closed,close(){socket.destroy()}};
  }
  addReverseTunnel():never{throw new Error('戍声不提供 ADB 反向端口映射')}
  removeReverseTunnel():never{throw new Error('戍声不提供 ADB 反向端口映射')}
  clearReverseTunnels(){}
}
