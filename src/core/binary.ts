export class Reader {
  pos=0;
  constructor(readonly data: Buffer, public little=false) {}
  need(n:number) { if(!Number.isSafeInteger(n)||n<0||this.pos+n>this.data.length) throw new Error(`二进制数据越界：${this.pos} + ${n} / ${this.data.length}`); }
  bytes(n:number) {this.need(n);const b=this.data.subarray(this.pos,this.pos+n);this.pos+=n;return b;}
  u8(){return this.bytes(1)[0]}
  u16(){this.need(2);const n=this.little?this.data.readUInt16LE(this.pos):this.data.readUInt16BE(this.pos);this.pos+=2;return n}
  u32(){this.need(4);const n=this.little?this.data.readUInt32LE(this.pos):this.data.readUInt32BE(this.pos);this.pos+=4;return n}
  i32(){return this.u32()|0}
  u64(){this.need(8);const n=this.little?this.data.readBigUInt64LE(this.pos):this.data.readBigUInt64BE(this.pos);this.pos+=8;if(n>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('二进制长度超过安全整数');return Number(n)}
  f32(){this.need(4);const n=this.little?this.data.readFloatLE(this.pos):this.data.readFloatBE(this.pos);this.pos+=4;if(!Number.isFinite(n))throw new Error('无效音频浮点数');return n}
  align(n=4){this.bytes((n-this.pos%n)%n)}
  cstr(){const end=this.data.indexOf(0,this.pos);if(end<0||end-this.pos>8192)throw new Error('无效字符串');const s=this.bytes(end-this.pos).toString('utf8');this.pos++;return s}
  str(){const length=this.i32();if(length>8192)throw new Error('字符串过长');const s=this.bytes(length).toString('utf8');this.align();return s}
}
export class Writer {
  chunks:Buffer[]=[];length=0;
  bytes(b:Uint8Array){this.chunks.push(Buffer.from(b));this.length+=b.length;return this}
  u16(n:number){const b=Buffer.alloc(2);b.writeUInt16BE(n);return this.bytes(b)}
  u32(n:number){const b=Buffer.alloc(4);b.writeUInt32BE(n);return this.bytes(b)}
  u64(n:number){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(n));return this.bytes(b)}
  cstr(s:string){return this.bytes(Buffer.from(s+'\0'))}
  align(n=16){return this.bytes(Buffer.alloc((n-this.length%n)%n))}
  finish(){return Buffer.concat(this.chunks)}
}
