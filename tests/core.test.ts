import {describe,it,expect,beforeAll} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {zipSync,strToU8} from 'fflate';
import {encodeLz4,decompress} from '../src/core/lz4';
import {readBundle,writeBundle,sha256} from '../src/core/unity';
import {parseFsb,encodeIma,decodeIma} from '../src/core/audio';
import {decodePack,exportPack,importPack,newPack} from '../src/core/packs';
import {Store} from '../src/core/storage';
import {LocalTransport} from '../src/core/local';
import {safeRelative} from '../src/shared/model';

const root=path.resolve('.test-runs/core');
beforeAll(async()=>{await fs.mkdir(root,{recursive:true})});
describe('binary formats',()=>{
 for(const mode of [2,4])for(const size of [1,15,255,1024,131072])it(`LZ4 mode ${mode} / ${size}`,()=>{
  const data=randomBytes(size);if(size>100)data.fill(42,10,Math.floor(size*.8));expect(decompress(encodeLz4(data,mode===4),size,mode)).toEqual(data);
 });
 it('rejects truncated and overflowing compressed data',()=>{
  expect(()=>decompress(Buffer.from([0xf0]),100,4)).toThrow();
  expect(()=>decompress(Buffer.from([0,0,0]),100,4)).toThrow();
 });
 it('round-trips a multiblock UnityFS without changing nodes',()=>{
  const bundle={version:8,engine:'5.x.x',revision:'2021.3.39f1',flags:579,blockFlags:4,nodes:[{name:'payload.resource',flags:0,data:randomBytes(290000)}]};
  const data=writeBundle(bundle),parsed=readBundle(data);expect(parsed.nodes[0].data).toEqual(bundle.nodes[0].data);expect(writeBundle(parsed)).toEqual(data);
  expect(()=>readBundle(data.subarray(0,-1))).toThrow();
 });
 it('encodes ADPCM with the exact sample count and finite signal error',()=>{
  const samples=Int16Array.from({length:24000},(_,i)=>Math.round(Math.sin(i/24000*440*Math.PI*2)*24000));
  const info=parseFsb(encodeIma(samples,24000)),decoded=decodeIma(info);expect(info.samples).toBe(24000);expect(info.codec).toBe(7);expect(decoded.length).toBe(48044);
  let signal=0,error=0;for(let i=100;i<samples.length;i++){signal+=samples[i]**2;error+=(samples[i]-decoded.readInt16LE(44+i*2))**2}expect(10*Math.log10(signal/error)).toBeGreaterThan(20);
 });
 it('fails on unsupported and malformed audio',()=>{
  expect(()=>encodeIma(new Int16Array(10),12345)).toThrow();expect(()=>parseFsb(Buffer.from('invalid'))).toThrow();
  const broken=encodeIma(new Int16Array(64),24000);broken[70]=100;expect(()=>decodeIma(parseFsb(broken))).toThrow();
 });
});
describe('sharing and persistence',()=>{
 it('exports and imports versioned audio with content hashes',async()=>{
  const a=new Store(path.join(root,'export'));await a.init();const p=newPack('Test');p.name='Round trip';
  const hash=await a.blob(encodeIma(new Int16Array(2400),24000));p.entries=[{bundle:'audio/sound_beta_2/voice_cn/ac_s_closur.ab',clip:'CN_001',kind:'audio',blob:hash}];
  const zip=await exportPack(p,a),b=new Store(path.join(root,'import'));await b.init();const result=await importPack(zip,b);expect(result).toEqual(p);expect(await b.readBlob(hash)).toEqual(await a.readBlob(hash));expect(await importPack(zip,b)).toEqual(p);
  const changed={...p,description:'conflict'};const conflict=Buffer.from(zipSync({'manifest.json':strToU8(JSON.stringify(changed)),['audio/'+hash+'.fsb']:await a.readBlob(hash)}));await expect(importPack(conflict,b)).rejects.toThrow('同一语音包版本');
 });
 it('rejects traversal, foreign targets, hash corruption, duplicate names, and zip bombs',()=>{
  const p=newPack('Test');
  expect(()=>decodePack(Buffer.from(zipSync({'manifest.json':strToU8(JSON.stringify(p)),'../attack':strToU8('x')})))).toThrow();
  const foreign={...p,entries:[{bundle:'config/credentials.bin',clip:'x',kind:'silence'}]};expect(()=>decodePack(Buffer.from(zipSync({'manifest.json':strToU8(JSON.stringify(foreign))})))).toThrow('卫戍协议');
  expect(()=>decodePack(Buffer.from(zipSync({'manifest.json':strToU8(JSON.stringify(p)),['audio/'+'0'.repeat(64)+'.fsb']:strToU8('bad')})))).toThrow('摘要');
  const duplicated=Buffer.from(zipSync({'manifest.json':strToU8(JSON.stringify(p)),'ManifEst.json':strToU8(JSON.stringify(p))}));
  for(let at=duplicated.indexOf('ManifEst.json');at!==-1;at=duplicated.indexOf('ManifEst.json'))duplicated.write('manifest.json',at);expect(()=>decodePack(duplicated)).toThrow('重复');
  const bomb=Buffer.from(zipSync({'manifest.json':strToU8(JSON.stringify(p))}));const index=bomb.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));bomb.writeUInt32LE(1024*1024*1024,index+24);expect(()=>decodePack(bomb)).toThrow('超限');
 });
 it('rejects invalid config rather than resetting it',async()=>{
  const dir=path.join(root,'corrupt');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'config.json'),'{bad');await expect(new Store(dir).init()).rejects.toThrow();expect(await fs.readFile(path.join(dir,'config.json'),'utf8')).toBe('{bad');
 });
 it('rejects stale writes and symlink escapes',async()=>{
  const dir=path.join(root,'local');await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'a.ab'),'original');
  const t=new LocalTransport({id:'test',kind:'local',label:'test',root:dir});await expect(t.replace('a.ab',sha256(Buffer.from('other')),Buffer.from('new'))).rejects.toThrow('修改');expect((await t.read('a.ab')).toString()).toBe('original');
  const link=path.join(dir,'link.ab');try{await fs.unlink(link)}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}await fs.symlink(path.join(dir,'a.ab'),link);await expect(t.read('link.ab')).rejects.toThrow('符号链接');
 });
 for(const bad of ['../x','/a','a/../../b','C:/a','a\\b','a\0b','a//b'])it(`rejects path ${JSON.stringify(bad)}`,()=>expect(()=>safeRelative.parse(bad)).toThrow());
});
