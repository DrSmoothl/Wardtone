// LZ4 block encoding; compression 4 swaps token nibbles and match offset byte order.
export function decodeLz4(input:Buffer,size:number,custom=false):Buffer {
  if(size<0||size>128*1024*1024)throw new Error('LZ4 解压长度超限');
  const out=Buffer.alloc(size);let i=0,o=0;
  const length=(n:number)=>{if(n===15){let b=255;while(b===255){if(i>=input.length)throw new Error('LZ4 长度截断');b=input[i++];n+=b;}}return n};
  while(i<input.length){const token=input[i++];const literal=length(custom?token&15:token>>4);
    if(i+literal>input.length||o+literal>size)throw new Error('LZ4 字面数据越界');
    input.copy(out,o,i,i+literal);i+=literal;o+=literal;if(i===input.length)break;
    if(i+2>input.length)throw new Error('LZ4 偏移截断');
    const offset=custom?input.readUInt16BE(i):input.readUInt16LE(i);i+=2;
    const match=length(custom?token>>4:token&15)+4;
    if(!offset||offset>o||o+match>size)throw new Error('LZ4 引用越界');
    for(let k=0;k<match;k++)out[o+k]=out[o+k-offset];o+=match;
  }
  if(o!==size)throw new Error(`LZ4 长度不符：${o}/${size}`);return out;
}
export function encodeLz4(input:Buffer,custom=false):Buffer {
  const output:number[]=[];const head=new Int32Array(65536).fill(-1);const prev=new Int32Array(input.length).fill(-1);
  const hash=(p:number)=>(Math.imul(input.readUInt32LE(p),-1640531535)>>>16)&65535;
  const insert=(p:number)=>{if(p+4<=input.length){const h=hash(p);prev[p]=head[h];head[h]=p}};
  const extra=(n:number)=>{while(n>=255){output.push(255);n-=255}output.push(n)};
  const emit=(anchor:number,p:number,match:number,offset:number)=>{
    const lit=p-anchor,m=match?match-4:0;const a=Math.min(lit,15),b=Math.min(m,15);
    output.push(custom?(b<<4)|a:(a<<4)|b);if(lit>=15)extra(lit-15);
    for(let x=anchor;x<p;x++)output.push(input[x]);
    if(match){output.push(custom?offset>>8:offset&255,custom?offset&255:offset>>8);if(m>=15)extra(m-15)}
  };
  let anchor=0,p=0;
  while(p+12<=input.length){let candidate=head[hash(p)],best=0,offset=0,tries=0;
    while(candidate>=0&&p-candidate<=65535&&tries++<512){
      if(input[candidate]===input[p]&&input[candidate+best]===input[p+best]){
        let len=0;while(p+len<input.length-5&&input[candidate+len]===input[p+len])len++;
        if(len>=4&&len>best){best=len;offset=p-candidate;}
      }candidate=prev[candidate];
    }
    if(best>=4){emit(anchor,p,best,offset);const end=p+best;while(p<end)insert(p++);anchor=p}else insert(p++);
  }
  emit(anchor,input.length,0,0);return Buffer.from(output);
}
export function decompress(data:Buffer,size:number,flags:number){const mode=flags&63;if(mode===0){if(data.length!==size)throw new Error('未压缩块长度不符');return Buffer.from(data)}if([2,3,4].includes(mode))return decodeLz4(data,size,mode===4);throw new Error(`暂不支持压缩标记 ${mode}`)}
