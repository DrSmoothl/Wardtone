import {createHash} from 'node:crypto';
import {Reader,Writer} from './binary';
import {decompress,encodeLz4} from './lz4';
export type BundleNode={name:string;flags:number;data:Buffer};
export type UnityBundle={version:number;engine:string;revision:string;flags:number;blockFlags:number;nodes:BundleNode[];originalBlocks?:{raw:Buffer;data:Buffer;flags:number}[];originalInfo?:{raw:Buffer;data:Buffer}};
export type AudioClip={name:string;id:string;node:number;objectOffset:number;objectSize:number;channels:number;frequency:number;duration:number;compression:number;source:string;offset:number;size:number;fields:{channels:number;frequency:number;bits:number;duration:number;offset:number;size:number;compression:number};little:boolean};
export function readBundle(data:Buffer):UnityBundle{
  if(data.length>128*1024*1024)throw new Error('资源包超过 128 MB');const r=new Reader(data);
  if(r.cstr()!=='UnityFS')throw new Error('文件不是 UnityFS 资源包');const version=r.u32(),engine=r.cstr(),revision=r.cstr();
  const total=r.u64(),packed=r.u32(),unpacked=r.u32(),flags=r.u32();
  if(total!==data.length||![6,7,8].includes(version))throw new Error('UnityFS 长度或版本不匹配');
  r.align(16);const dataStart=r.pos;let info:Buffer;
  if(flags&128){if(packed>data.length-dataStart)throw new Error('目录长度越界');info=data.subarray(data.length-packed)}else info=r.bytes(packed);
  const infoRaw=decompress(info,unpacked,flags),d=new Reader(infoRaw);d.bytes(16);const count=d.u32();if(count>8192)throw new Error('数据块数量超限');
  const blocks=Array.from({length:count},()=>({size:d.u32(),packed:d.u32(),flags:d.u16()}));
  const nc=d.u32();if(nc>4096)throw new Error('节点数量超限');
  const entries=Array.from({length:nc},()=>({offset:d.u64(),size:d.u64(),flags:d.u32(),name:d.cstr()}));
  if(flags&128)r.pos=dataStart;if(flags&512)r.align(16);
  if(blocks.reduce((n,b)=>n+b.size,0)>128*1024*1024)throw new Error('资源解压总量超限');
  const originalBlocks=blocks.map(b=>{const data=Buffer.from(r.bytes(b.packed));return{raw:decompress(data,b.size,b.flags),data,flags:b.flags}});
  const stream=Buffer.concat(originalBlocks.map(b=>b.raw));
  const nodes=entries.map(e=>{if(e.offset+e.size>stream.length)throw new Error('节点越界');return{name:e.name,flags:e.flags,data:Buffer.from(stream.subarray(e.offset,e.offset+e.size))}});
  return{version,engine,revision,flags,blockFlags:blocks[0]?.flags??4,nodes,originalBlocks,originalInfo:{raw:infoRaw,data:Buffer.from(info)}};
}
export function writeBundle(bundle:UnityBundle):Buffer{
  const raw=Buffer.concat(bundle.nodes.map(n=>n.data));const blocks:{raw:number;data:Buffer;flags:number}[]=[];
  const mode=bundle.blockFlags&63;if(![0,2,3,4].includes(mode))throw new Error('不可写入该压缩格式');
  let originalBlock=0;
  for(let i=0;i<raw.length;){const prior=bundle.originalBlocks?.[originalBlock++],size=prior?.raw.length||0x20000,part=raw.subarray(i,i+size);i+=size;
    const flags=prior?.flags??bundle.blockFlags,blockMode=flags&63;
    if(![0,2,3,4].includes(blockMode))throw new Error('不可写入该数据块压缩格式');
    blocks.push({raw:part.length,data:prior&&part.equals(prior.raw)?prior.data:blockMode===0?part:encodeLz4(part,blockMode===4),flags});
  }
  const table=new Writer().bytes(Buffer.alloc(16)).u32(blocks.length);for(const b of blocks)table.u32(b.raw).u32(b.data.length).u16(b.flags);
  table.u32(bundle.nodes.length);let offset=0;for(const node of bundle.nodes){table.u64(offset).u64(node.data.length).u32(node.flags).cstr(node.name);offset+=node.data.length}
  const plain=table.finish(),infoMode=bundle.flags&63;
  if(![0,2,3,4].includes(infoMode))throw new Error('不可写入目录压缩格式');
  const info=bundle.originalInfo&&plain.equals(bundle.originalInfo.raw)?bundle.originalInfo.data:infoMode===0?plain:encodeLz4(plain,infoMode===4);
  const w=new Writer().cstr('UnityFS').u32(bundle.version).cstr(bundle.engine).cstr(bundle.revision);const sizePos=w.length;
  w.u64(0).u32(info.length).u32(plain.length).u32(bundle.flags).align();
  if(!(bundle.flags&128))w.bytes(info);if(bundle.flags&512)w.align();for(const b of blocks)w.bytes(b.data);if(bundle.flags&128)w.bytes(info);
  const output=w.finish();output.writeBigUInt64BE(BigInt(output.length),sizePos);return output;
}
export function audioClips(bundle:UnityBundle):AudioClip[]{
  const clips:AudioClip[]=[];
  bundle.nodes.forEach((node,nodeIndex)=>{if(node.name.endsWith('.resource')||node.name.endsWith('.resS'))return;
    const r=new Reader(node.data);r.u32();let total=r.u32();const version=r.u32();let dataOffset=r.u32();
    if(version<17||version>22)throw new Error(`不支持的 SerializedFile 版本 ${version}`);
    const little=r.u8()===0;r.bytes(3);if(version>=22){r.u32();total=r.u64();dataOffset=r.u64();r.bytes(8)}
    if(total!==node.data.length)throw new Error('SerializedFile 长度不符');r.little=little;const unity=r.cstr();r.u32();const tree=r.u8();const tc=r.u32();if(tc>10000)throw new Error('类型表超限');
    const types:number[]=[];for(let i=0;i<tc;i++){const id=r.i32();types.push(id);r.u8();r.u16();if(id===114)r.bytes(16);r.bytes(16);
      if(tree){const nodes=r.u32(),strings=r.u32();r.bytes(nodes*(version>=19?32:24));r.bytes(strings);if(version>=21)r.bytes(r.u32()*4)}
    }
    const count=r.u32();if(count>100000)throw new Error('对象数量超限');
    for(let i=0;i<count;i++){r.align();const id=r.bytes(8).toString('hex');const offset=(version>=22?r.u64():r.u32())+dataOffset;const size=r.u32();const type=r.i32();if(types[type]!==83)continue;
      if(offset+size>node.data.length)throw new Error('AudioClip 对象越界');if(!/^20(1[7-9]|2\d)\./.test(unity))throw new Error(`不支持的音频结构版本 ${unity}`);
      const a=new Reader(node.data.subarray(offset,offset+size),little);const name=a.str();a.i32();const channelsPos=a.pos,channels=a.i32(),frequencyPos=a.pos,frequency=a.i32(),bits=a.pos;a.i32();const durationPos=a.pos,duration=a.f32();
      a.u8();a.align();a.i32();a.u8();a.u8();a.u8();a.align();const source=a.str();const off=a.pos,resourceOffset=a.u64(),sz=a.pos,resourceSize=a.u64(),comp=a.pos,compression=a.i32();
      if(a.pos!==size||channels<1||channels>8||frequency<1000||frequency>192000||duration<0)throw new Error(`AudioClip 布局校验失败：${name}`);
      clips.push({name,id,node:nodeIndex,objectOffset:offset,objectSize:size,channels,frequency,duration,compression,source,offset:resourceOffset,size:resourceSize,little,
        fields:{channels:channelsPos,frequency:frequencyPos,bits,duration:durationPos,offset:off,size:sz,compression:comp}});
    }
  });return clips;
}
export function resourceNode(bundle:UnityBundle,clip:AudioClip){const node=bundle.nodes.find(n=>n.name===clip.source.split('/').at(-1));if(!node||clip.offset+clip.size>node.data.length)throw new Error(`音频资源引用无效：${clip.name}`);return node}
export function payload(bundle:UnityBundle,clip:AudioClip){return Buffer.from(resourceNode(bundle,clip).data.subarray(clip.offset,clip.offset+clip.size))}
export function referenceClip(bundle:UnityBundle,target:AudioClip,donor:AudioClip){
  if(target.source!==donor.source)throw new Error('直接引用需要同一音频数据节点');
  const object=bundle.nodes[target.node].data;
  for(const key of ['channels','frequency','duration','offset','size','compression'] as const){
    const at=target.objectOffset+target.fields[key],value=donor[key];
    if(key==='offset'||key==='size'){if(target.little)object.writeBigUInt64LE(BigInt(value),at);else object.writeBigUInt64BE(BigInt(value),at)}
    else if(key==='duration'){if(target.little)object.writeFloatLE(value,at);else object.writeFloatBE(value,at)}
    else{if(target.little)object.writeInt32LE(value,at);else object.writeInt32BE(value,at)}
  }
}
export function clearUnusedAudio(bundle:UnityBundle,originalClips:AudioClip[]){
  const current=audioClips(bundle);
  for(const old of originalClips){
    if(current.some(c=>c.source===old.source&&c.offset<old.offset+old.size&&c.offset+c.size>old.offset))continue;
    resourceNode(bundle,old).data.fill(0,old.offset,old.offset+old.size);
  }
}
export function patchClip(bundle:UnityBundle,clip:AudioClip,audio:Buffer,meta:{channels:number;frequency:number;duration:number;compression:number}){
  const node=resourceNode(bundle,clip),object=bundle.nodes[clip.node].data;let offset=clip.offset;
  const overlapping=audioClips(bundle).some(other=>other.id!==clip.id&&other.source===clip.source&&other.offset<clip.offset+clip.size&&other.offset+other.size>clip.offset);
  if(audio.length<=clip.size&&!overlapping){node.data.fill(0,offset,offset+clip.size);audio.copy(node.data,offset)}else{offset=(node.data.length+31)&~31;node.data=Buffer.concat([node.data,Buffer.alloc(offset-node.data.length),audio])}
  for(const [key,value]of Object.entries({...meta,bits:16,offset,size:audio.length})){const at=clip.objectOffset+clip.fields[key as keyof AudioClip['fields']];if(key==='offset'||key==='size'){if(clip.little)object.writeBigUInt64LE(BigInt(value),at);else object.writeBigUInt64BE(BigInt(value),at)}else if(key==='duration'){if(clip.little)object.writeFloatLE(value,at);else object.writeFloatBE(value,at)}else{if(clip.little)object.writeInt32LE(value,at);else object.writeInt32BE(value,at)}}
}
export function packExact(bundle:UnityBundle,bytes:number):Buffer{
  const node=[...bundle.nodes].reverse().find(n=>n.name.endsWith('.resource')||n.name.endsWith('.resS'));if(!node)throw new Error('找不到音频数据节点');
  const original=node.data;const first=writeBundle(bundle);if(first.length>bytes)throw new Error(`封包超出原包 ${first.length-bytes} 字节。可选择“变长包”，或缩短音频、降低采样率、使用紧凑单声道编码。`);if(first.length===bytes)return first;
  const max=bytes-first.length+4096;if(max>128*1024*1024)throw new Error('填充长度超限');const noise=Buffer.alloc(max);let s=0x1a2b3c4d;for(let i=0;i<max;i++){s^=s<<13;s^=s>>>17;s^=s<<5;noise[i]=s&255}
  let pad=bytes-first.length;const seen=new Set<number>();
  try{for(let tries=0;tries<40;tries++){if(pad<0||pad>max||seen.has(pad))break;seen.add(pad);node.data=Buffer.concat([original,noise.subarray(0,pad)]);const data=writeBundle(bundle);if(data.length===bytes){readBundle(data);return data}pad+=bytes-data.length}
    for(let n=Math.max(0,pad-64);n<=Math.min(max,pad+64);n++){if(seen.has(n))continue;node.data=Buffer.concat([original,noise.subarray(0,n)]);const data=writeBundle(bundle);if(data.length===bytes){readBundle(data);return data}}
    throw new Error('未找到精确等长的封包，原文件未写入');
  }finally{node.data=original}
}
export const sha256=(data:Uint8Array)=>createHash('sha256').update(data).digest('hex');
