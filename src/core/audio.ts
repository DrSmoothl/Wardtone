import {Reader} from './binary';
const rates=[4000,8000,11000,11025,16000,22050,24000,32000,44100,48000,96000];
const steps=[7,8,9,10,11,12,13,14,16,17,19,21,23,25,28,31,34,37,41,45,50,55,60,66,73,80,88,97,107,118,130,143,157,173,190,209,230,253,279,307,337,371,408,449,494,544,598,658,724,796,876,963,1060,1166,1282,1411,1552,1707,1878,2066,2272,2499,2749,3024,3327,3660,4026,4428,4871,5358,5894,6484,7132,7845,8630,9493,10442,11487,12635,13899,15289,16818,18500,20350,22385,24623,27086,29794,32767];
const indices=[-1,-1,-1,-1,2,4,6,8];
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export type FsbInfo={codec:number;channels:number;rate:number;samples:number;data:Buffer;setup?:number};
export function parseFsb(data:Buffer):FsbInfo{
  const r=new Reader(data,true);if(r.bytes(4).toString()!=='FSB5')throw new Error('音频不是 FSB5');
  const version=r.u32(),count=r.u32(),headers=r.u32(),names=r.u32(),bytes=r.u32(),codec=r.u32();
  if(count!==1||version>1)throw new Error('仅支持单音频 FSB5 数据段');const base=version===1?60:64;
  r.pos=base;const mode=data.readBigUInt64LE(r.pos);r.pos+=8;
  const samples=Number(mode>>34n),offset=Number((mode>>7n)&0x7ffffffn)*32;
  let rate=rates[Number((mode>>1n)&15n)],channels=[1,2,6,8][Number((mode>>5n)&3n)],setup:number|undefined,more=Number(mode&1n);
  while(more){const chunk=r.u32();more=chunk&1;const n=(chunk>>>1)&0xffffff,type=chunk>>>25;const value=r.bytes(n);if(type===11&&n>=4)setup=value.readUInt32LE(0);if(type===1&&n>=1)channels=value[0];if(type===2&&n===4)rate=value.readUInt32LE(0)}
  if(!rate||samples*channels>32*1024*1024||channels>8||base+headers+names+bytes>data.length)throw new Error('FSB5 参数无效或解码样本超过 64 MiB');
  return{codec,channels,rate,samples,setup,data:Buffer.from(data.subarray(base+headers+names+offset,base+headers+names+bytes))};
}
export function wav(samples:Int16Array,rate:number,channels=1):Buffer{
  const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(channels,22);b.writeUInt32LE(rate,24);b.writeUInt32LE(rate*channels*2,28);b.writeUInt16LE(channels*2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(samples[i],44+i*2);return b;
}
export function encodeIma(samples:Int16Array,rate:number):Buffer{
  const code=rates.indexOf(rate);if(code<0||samples.length<1||samples.byteLength>64*1024*1024)throw new Error('录音需使用受支持的采样率，解码数据不能超过 64 MiB');
  const audio=Buffer.alloc(Math.ceil(samples.length/64)*36);let index=0;
  for(let start=0;start<samples.length;start+=64){const pos=start/64*36;let value=samples[start];audio.writeInt16LE(value,pos);audio[pos+2]=index;
    for(let i=1;i<64;i++){const sample=samples[Math.min(start+i,samples.length-1)],step=steps[index];let diff=sample-value,nibble=0;if(diff<0){nibble=8;diff=-diff}let delta=step>>3;if(diff>=step){nibble|=4;diff-=step;delta+=step}if(diff>=step/2){nibble|=2;diff-=step>>1;delta+=step>>1}if(diff>=step/4){nibble|=1;delta+=step>>2}value=clamp(value+(nibble&8?-delta:delta),-32768,32767);index=clamp(index+indices[nibble&7],0,88);const at=pos+4+Math.floor((i-1)/2);audio[at]|=nibble<<(((i-1)&1)*4);}
  }
  const data=Buffer.alloc(68+audio.length);data.write('FSB5');data.writeUInt32LE(1,4);data.writeUInt32LE(1,8);data.writeUInt32LE(8,12);data.writeUInt32LE(audio.length,20);data.writeUInt32LE(7,24);data.writeBigUInt64LE((BigInt(samples.length)<<34n)|(BigInt(code)<<1n),60);audio.copy(data,68);return data;
}
export function encodePcm(samples:Int16Array,rate:number,channels:1|2):Buffer{
  const code=rates.indexOf(rate);
  if(code<0||![1,2].includes(channels)||samples.length<1||samples.length%channels||samples.byteLength+68>64*1024*1024)
    throw new Error('PCM 采样率、声道或数据长度无效');
  const frames=samples.length/channels, data=Buffer.alloc(68+samples.byteLength);
  data.write('FSB5');data.writeUInt32LE(1,4);data.writeUInt32LE(1,8);data.writeUInt32LE(8,12);data.writeUInt32LE(samples.byteLength,20);data.writeUInt32LE(2,24);
  data.writeBigUInt64LE((BigInt(frames)<<34n)|(BigInt(channels-1)<<5n)|(BigInt(code)<<1n),60);
  for(let i=0;i<samples.length;i++)data.writeInt16LE(samples[i],68+i*2);
  return data;
}
export function decodeIma(info:FsbInfo):Buffer{
  if(info.channels!==1)throw new Error('当前 IMA 试听仅支持单声道');const samples=new Int16Array(info.samples);let out=0;
  for(let pos=0;out<samples.length;pos+=36){if(pos+36>info.data.length)throw new Error('ADPCM 数据截断');let value=info.data.readInt16LE(pos),index=info.data[pos+2];if(index>88)throw new Error('ADPCM 索引错误');samples[out++]=value;
    for(let i=1;i<64&&out<samples.length;i++){const code=(info.data[pos+4+Math.floor((i-1)/2)]>>(((i-1)&1)*4))&15,step=steps[index];let delta=step>>3;if(code&4)delta+=step;if(code&2)delta+=step>>1;if(code&1)delta+=step>>2;value=clamp(value+(code&8?-delta:delta),-32768,32767);index=clamp(index+indices[code&7],0,88);samples[out++]=value}
  }return wav(samples,info.rate);
}
function crc(data:Buffer){let crc=0;for(const byte of data){crc^=byte<<24;for(let k=0;k<8;k++)crc=(crc<<1)^((crc&0x80000000)?0x04c11db7:0)}return crc>>>0}
function page(packet:Buffer,sequence:number,granule:number,flags:number){const count=Math.floor(packet.length/255)+1;if(count>255)throw new Error('Vorbis 数据包过大');const header=Buffer.alloc(27+count);header.write('OggS');header[5]=flags;header.writeBigInt64LE(BigInt(granule),6);header.writeUInt32LE(0x53535631,14);header.writeUInt32LE(sequence,18);header[26]=count;header.fill(255,27);header[26+count]=packet.length%255;const out=Buffer.concat([header,packet]);out.writeUInt32LE(crc(out),22);return out}
function modes(setup:Buffer):boolean[]{
  let framing=setup.length*8-1;const bit=(at:number)=>(setup[at>>3]>>(at&7))&1;while(framing>0&&!bit(framing))framing--;
  const read=(at:number,n:number)=>{let v=0;for(let i=0;i<n;i++)v|=bit(at+i)<<i;return v};
  for(let n=1;n<=64;n++){const start=framing-6-n*41;if(start<56||read(start,6)!==n-1)continue;const result:boolean[]=[];let valid=true;for(let i=0;i<n;i++){const at=start+6+i*41;if(read(at+1,16)||read(at+17,16)){valid=false;break}result.push(Boolean(bit(at)))}if(valid)return result}
  throw new Error('无法解析 Vorbis 模式表');
}
export function fsbPreview(data:Buffer,codebooks:Record<string,string>):{mime:string;data:Buffer}{
  const f=parseFsb(data);if(f.codec===7)return{mime:'audio/wav',data:decodeIma(f)};
  if(f.codec===2){const samples=new Int16Array(f.samples*f.channels);if(f.data.length<samples.length*2)throw new Error('PCM 数据截断');for(let i=0;i<samples.length;i++)samples[i]=f.data.readInt16LE(i*2);return{mime:'audio/wav',data:wav(samples,f.rate,f.channels)}}
  if(f.codec!==15||f.setup===undefined)throw new Error(`暂不支持试听编码 ${f.codec}`);
  const encoded=codebooks[String(f.setup)];if(!encoded)throw new Error(`缺少 Vorbis 编码表 ${f.setup}，请在诊断中导出该编号`);const setup=Buffer.from(encoded,'base64'),flags=modes(setup),modeBits=Math.ceil(Math.log2(flags.length));
  const id=Buffer.alloc(30);id.write('\x01vorbis',0,'binary');id[11]=f.channels;id.writeUInt32LE(f.rate,12);id[28]=0xb8;id[29]=1;
  const vendor=Buffer.from('Wardtone'),comment=Buffer.alloc(7+4+vendor.length+4+1);comment.write('\x03vorbis',0,'binary');comment.writeUInt32LE(vendor.length,7);vendor.copy(comment,11);comment[comment.length-1]=1;
  const packets:Buffer[]=[];let p=0;while(p+2<=f.data.length){const len=f.data.readUInt16LE(p);p+=2;if(!len)break;if(p+len>f.data.length)throw new Error('Vorbis 包截断');packets.push(f.data.subarray(p,p+len));p+=len}
  if(!packets.length)throw new Error('Vorbis 音频为空');let granule=0,previous=0;const pages=[page(id,0,0,2),page(comment,1,0,0),page(setup,2,0,0)];
  packets.forEach((packet,i)=>{const mode=(packet[0]>>1)&((1<<modeBits)-1);if(mode>=flags.length)throw new Error('Vorbis 模式越界');const block=flags[mode]?2048:256;if(previous)granule+=(previous+block)/4;previous=block;pages.push(page(packet,i+3,i===packets.length-1?f.samples:granule,i===packets.length-1?4:0))});return{mime:'audio/ogg',data:Buffer.concat(pages)};
}
