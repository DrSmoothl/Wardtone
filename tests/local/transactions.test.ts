import {beforeAll,describe,it,expect} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Store,atomicWrite} from '../../src/core/storage';
import {Transactions} from '../../src/core/transactions';
import {LocalTransport} from '../../src/core/local';
import {newPack} from '../../src/core/packs';
import {readBundle,audioClips,payload,sha256} from '../../src/core/unity';
import {encodeIma} from '../../src/core/audio';
import {manifestName,scan} from '../../src/core/game';
import type {Location} from '../../src/shared/model';
const source=path.resolve(process.env.WARDTONE_FIXTURE??'.fixtures/Bundles');
const target='audio/sound_beta_2/voice_cn/ac_s_closur.ab';
const root=path.resolve('.test-runs/transactions');
beforeAll(async()=>{await fs.access(path.join(source,manifestName));await fs.mkdir(root,{recursive:true})});
async function setup(){
 const dir=await fs.mkdtemp(path.join(root,'case-'));await fs.cp(source,path.join(dir,'game'),{recursive:true});
 const store=new Store(path.join(dir,'data'));await store.init();
 const location:Location={id:'fixture',kind:'local',label:'Resource copy',root:path.join(dir,'game')};const t=new LocalTransport(location);
 const p=newPack('Tests');p.entries=[{bundle:target,clip:'CN_001',kind:'reference',donorBundle:target,donorClip:'CN_007'}];return{dir,store,t,location,p};
}
describe('real resource copies / transactional writes',()=>{
 it('covers ten bundles and 133 voices, effects and music tracks',async()=>{const {store,t}=await setup();const inventory=await scan(t,new Set(),store,'test');expect(inventory.bundles).toHaveLength(10);expect(inventory.bundles.reduce((n,b)=>n+b.clips.length,0)).toBe(133);expect(inventory.bundles.every(b=>b.status==='official')).toBe(true)});
 it('applies an exact-size reference, is idempotent, and restores exact bytes',async()=>{
  const {store,t,p}=await setup(),tx=new Transactions(store),original=await t.read(target),originalBundle=readBundle(original);
  const plan=await tx.prepare(t,p,'exact','closed');expect(plan.files[0].after).toBe(original.length);await tx.apply(plan.id);
  const result=readBundle(await t.read(target)),targetClip=audioClips(result).find(c=>c.name==='CN_001')!,donor=audioClips(originalBundle).find(c=>c.name==='CN_007')!;
  expect(payload(result,targetClip)).toEqual(payload(originalBundle,donor));
  for(const old of audioClips(originalBundle).filter(c=>c.name!=='CN_001'))expect(payload(result,audioClips(result).find(c=>c.name===old.name)!)).toEqual(payload(originalBundle,old));
  const repeat=await tx.prepare(t,p,'exact','closed');expect(repeat.unchanged).toBe(true);expect(await tx.apply(repeat.id)).toEqual({unchanged:true});expect(await tx.journals()).toHaveLength(1);
  await tx.restore(plan.id);expect(await t.read(target)).toEqual(original);
 });
 it('merges later replacements and changes only the selected manifest size field',async()=>{
  const {store,t,p}=await setup(),tx=new Transactions(store),originalManifest=JSON.parse((await t.read(manifestName)).toString());
  const first=await tx.prepare(t,p,'exact','closed');await tx.apply(first.id);
  const next=newPack('Tests'),samples=Int16Array.from({length:24000*11},(_,i)=>Math.round(Math.sin(i*1.137)*30000));
  next.entries=[{bundle:target,clip:'CN_002',kind:'audio',blob:await store.blob(encodeIma(samples,24000))}];
  const plan=await tx.prepare(t,next,'variable','closed');await tx.apply(plan.id);
  const updated=JSON.parse((await t.read(manifestName)).toString());const row=updated.abInfos.find((e:{name:string})=>e.name===target);expect(row.abSize).toBe(0);row.abSize=342014;expect(updated).toEqual(originalManifest);
  const clips=audioClips(readBundle(await t.read(target)));expect(clips.find(c=>c.name==='CN_002')!.duration).toBeCloseTo(11,4);expect(clips.find(c=>c.name==='CN_001')!.duration).toBeCloseTo(3.235737,3);
  const repeat=await tx.prepare(t,next,'variable','hot');expect(repeat.unchanged).toBe(true);
  await tx.restore(plan.id);await tx.restore(first.id);expect(await t.read(target)).toEqual(await fs.readFile(path.join(source,target)));
 });
 it('refuses stale plans without writing resources',async()=>{
  const {store,t,p}=await setup(),tx=new Transactions(store),original=await t.read(target);const plan=await tx.prepare(t,p,'exact','closed');
  const changed=Buffer.from(original);changed[changed.length-1]^=1;await fs.writeFile(path.join(t.location.root,target),changed);await expect(tx.apply(plan.id)).rejects.toThrow('文件已变化');expect(await t.read(target)).toEqual(changed);expect(await tx.journals()).toHaveLength(0);
 });
 it('rolls back a partial two-file commit on failure',async()=>{
  const {store,t,p,location}=await setup(),original=await t.read(target),manifest=await t.read(manifestName);let writes=0;
  class FailingTransport extends LocalTransport{override async replace(name:string,expected:string,data:Buffer){if(++writes===2)throw new Error('Injected write failure');return super.replace(name,expected,data)}}
  const tx=new Transactions(store,async()=>new FailingTransport(location));const plan=await tx.prepare(t,p,'variable','closed');await expect(tx.apply(plan.id)).rejects.toThrow('Injected');
  expect(await t.read(target)).toEqual(original);expect(await t.read(manifestName)).toEqual(manifest);expect((await tx.journals())[0].status).toBe('rolled-back');expect((await store.logs()).some(l=>l.event==='rollback.verified')).toBe(true);
 });
 it('recovers a durable journal after a simulated process interruption',async()=>{
  const {store,t,p,location}=await setup(),tx=new Transactions(store),original=await t.read(target);const plan=await tx.prepare(t,p,'variable','closed');
  const files=plan.files.map(f=>({...f,baseHash:f.beforeHash,entries:f.path===target?p.entries:[]}));
  await atomicWrite(store.file('journals',plan.id+'.json'),JSON.stringify({schema:1,id:plan.id,time:new Date().toISOString(),pack:p.id,location,status:'committing',files}));
  const first=files[0];await t.replace(first.path,first.beforeHash,await store.readBlob(first.afterHash));
  const restarted=new Transactions(store);await expect(restarted.prepare(t,p,'exact','closed')).rejects.toThrow('未结束事务');await restarted.restore(plan.id);expect(await t.read(target)).toEqual(original);expect((await restarted.journals())[0].status).toBe('rolled-back');
 });
 it('preserves external edits during restore and records the conflict',async()=>{
  const {store,t,p}=await setup(),tx=new Transactions(store);const plan=await tx.prepare(t,p,'variable','closed');await tx.apply(plan.id);
  const external=Buffer.from('external edit');await fs.writeFile(path.join(t.location.root,target),external);const currentManifest=await t.read(manifestName);
  await expect(tx.restore(plan.id)).rejects.toThrow('外部修改');expect(await t.read(target)).toEqual(external);expect(await t.read(manifestName)).toEqual(currentManifest);expect((await tx.journals())[0].status).toBe('recovery-required');
 });
 it('requires a closed-game activation before variable hot replacement',async()=>{const {store,t,p}=await setup();await expect(new Transactions(store).prepare(t,p,'variable','hot')).rejects.toThrow('关闭游戏')});
});
