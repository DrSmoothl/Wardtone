import {zipSync,unzipSync,strToU8} from 'fflate';
import {randomUUID} from 'node:crypto';
import {packSchema,packKey,type VoicePack,type PackEntry} from '../shared/model';
import {Store} from './storage';
import {parseFsb,encodeIma,encodePcm} from './audio';
import {sha256,readBundle,audioClips,payload} from './unity';
import {targetBundle,targetClip} from './game';

const MAX_ARCHIVE=128*1024*1024,MAX_EXPANDED=256*1024*1024;
export function inspectZip(data:Buffer){
  if(data.length>MAX_ARCHIVE)throw new Error('分享包超过 128 MB');
  let end=-1;
  for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(data.readUInt32LE(i)===0x06054b50){end=i;break}
  if(end<0||end+22+data.readUInt16LE(end+20)!==data.length)throw new Error('分享包的 ZIP 目录无效');
  const count=data.readUInt16LE(end+10),size=data.readUInt32LE(end+12),offset=data.readUInt32LE(end+16);
  if(data.readUInt16LE(end+4)||data.readUInt16LE(end+6)||count!==data.readUInt16LE(end+8)||count>1001||count===0||offset+size!==end)throw new Error('不支持分卷、ZIP64 或目录异常的分享包');
  let p=offset,total=0;const names=new Set<string>();
  for(let i=0;i<count;i++){
    if(p+46>end||data.readUInt32LE(p)!==0x02014b50)throw new Error('ZIP 条目被截断');
    const flags=data.readUInt16LE(p+8),method=data.readUInt16LE(p+10),packed=data.readUInt32LE(p+20),plain=data.readUInt32LE(p+24),n=data.readUInt16LE(p+28),extra=data.readUInt16LE(p+30),comment=data.readUInt16LE(p+32),local=data.readUInt32LE(p+42);
    if(p+46+n+extra+comment>end||flags&1||![0,8].includes(method)||plain>64*1024*1024||local+30>offset||packed>data.length)throw new Error('ZIP 条目格式或大小超限');
    const name=data.subarray(p+46,p+46+n).toString('utf8');
    if(!/^(?:manifest\.json|audio\/[a-f0-9]{64}\.fsb)$/.test(name)||names.has(name))throw new Error('分享包包含重复或不允许的路径：'+name);
    names.add(name);total+=plain;if(total>MAX_EXPANDED)throw new Error('分享包解压后超过 256 MB');
    p+=46+n+extra+comment;
  }
  if(p!==end||!names.has('manifest.json'))throw new Error('分享包缺少元数据或目录长度不符');
  return names;
}
export function decodePack(data:Buffer){
  const names=inspectZip(data),files=unzipSync(data,{filter:f=>f.originalSize<=64*1024*1024});
  if(Object.keys(files).length!==names.size)throw new Error('分享包文件数不符');
  const pack=packSchema.parse(JSON.parse(Buffer.from(files['manifest.json']).toString()));
  const audio=new Map<string,Buffer>();
  for(const name of Object.keys(files)){
    if(!names.has(name))throw new Error('ZIP 文件名不一致');
    if(name==='manifest.json')continue;
    const hash=name.slice(6,-4),blob=Buffer.from(files[name]);if(sha256(blob)!==hash)throw new Error('分享音频摘要不符：'+name);parseFsb(blob);audio.set(hash,blob);
  }
  for(const entry of pack.entries){
    if(!targetBundle(entry.bundle)||!targetClip(entry.bundle,entry.clip))throw new Error('分享包包含卫戍协议以外的目标：'+entry.bundle);
    if(entry.kind==='audio'&&!audio.has(entry.blob!))throw new Error('分享包缺少音频：'+entry.clip);
    if(entry.kind==='reference'&&(!targetBundle(entry.donorBundle!)||!targetClip(entry.donorBundle!,entry.donorClip!)))throw new Error('引用语音不在卫戍协议范围内');
  }
  return{pack,audio};
}
export async function importPack(data:Buffer,store:Store){
  const {pack,audio}=decodePack(data);const existing=(await store.packs()).find(p=>packKey(p)===packKey(pack));
  if(existing&&JSON.stringify(existing)!==JSON.stringify(pack))throw new Error('同一语音包版本已存在且内容不同，请更改版本号后重新导出');
  for(const blob of audio.values())await store.blob(blob);
  return store.savePack(pack);
}
export async function exportPack(pack:VoicePack,store:Store){
  const files:Record<string,Uint8Array>={'manifest.json':strToU8(JSON.stringify(pack,null,2))};
  for(const entry of pack.entries)if(entry.kind==='audio')files['audio/'+entry.blob+'.fsb']=await store.readBlob(entry.blob!);
  const bytes=Buffer.from(zipSync(files,{level:6}));decodePack(bytes);return bytes;
}
export function newPack(author:string):VoicePack{return{schema:1,id:randomUUID(),name:'新的语音包',version:'1.0.0',author:author||'未署名',description:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),entries:[]}}
export async function encodeAudio(pcm:Uint8Array,rate:number,store:Store,encoding:'ima'|'pcm'='ima',channels:1|2=1){
  if(pcm.length%2||pcm.length>64*1024*1024)throw new Error('PCM 长度无效或超过 64 MiB');
  if(encoding==='ima'&&channels!==1)throw new Error('紧凑编码只支持单声道');
  if(encoding!=='ima'&&encoding!=='pcm')throw new Error('不支持的音频编码');
  const b=Buffer.from(pcm),samples=new Int16Array(b.length/2);for(let i=0;i<samples.length;i++)samples[i]=b.readInt16LE(i*2);
  const fsb=encoding==='pcm'?encodePcm(samples,rate,channels):encodeIma(samples,rate),blob=await store.blob(fsb);
  await store.log('info',randomUUID(),'audio.encoded',{blob,encoding,channels,rate,frames:samples.length/channels,bytes:fsb.length});
  return{blob,duration:samples.length/channels/rate,bytes:fsb.length};
}
export async function entriesFromBundle(data:Buffer,target:string,store:Store):Promise<PackEntry[]>{
  if(!targetBundle(target))throw new Error('目标不属于卫戍协议');
  const bundle=readBundle(data),entries:PackEntry[]=[];
  for(const clip of audioClips(bundle).filter(c=>targetClip(target,c.name))){const fsb=payload(bundle,clip);parseFsb(fsb);entries.push({bundle:target,clip:clip.name,kind:'audio',blob:await store.blob(fsb)})}
  if(!entries.length)throw new Error('资源包中未找到卫戍协议音频');return entries;
}
