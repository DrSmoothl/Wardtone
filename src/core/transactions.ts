import * as fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {entrySchema,locationSchema,safeRelative,packKey,type VoicePack,type Location,type PackEntry,type PlanView,type JournalView} from '../shared/model';
import {Store,atomicWrite} from './storage';
import type {Transport} from './local';
import {manifestName,readManifest,targetBundle,targetClip,gameRunning,md5,transport} from './game';
import {readBundle,writeBundle,audioClips,payload,patchClip,referenceClip,packExact,sha256,clearUnusedAudio} from './unity';
import {encodeIma,parseFsb} from './audio';

const hash=z.string().regex(/^[a-f0-9]{64}$/);
const fileSchema=z.object({path:safeRelative,beforeHash:hash,afterHash:hash,baseHash:hash,entries:z.array(entrySchema),before:z.number(),after:z.number()});
const journalSchema=z.object({schema:z.literal(1),id:z.string().uuid(),time:z.string(),pack:z.string(),location:locationSchema,status:z.enum(['prepared','committing','committed','rolling-back','rolled-back','recovery-required']),files:z.array(fileSchema),error:z.string().optional()});
type FileChange=z.infer<typeof fileSchema>;
export type Journal=z.infer<typeof journalSchema>;
type Plan={view:PlanView;journal:Journal;manifestHash:string;created:number};
export class Transactions {
  private plans=new Map<string,Plan>();
  private busy=false;
  constructor(readonly store:Store,private open:typeof transport=transport){}
  async journals(){
    const files=(await fs.readdir(this.store.file('journals'))).filter(n=>n.endsWith('.json'));
    const journals=await Promise.all(files.map(async file=>journalSchema.parse(JSON.parse(await fs.readFile(this.store.file('journals',file),'utf8')))));
    return journals.sort((a,b)=>a.time.localeCompare(b.time));
  }
  async views():Promise<JournalView[]>{return(await this.journals()).map(j=>({id:j.id,time:j.time,pack:j.pack,location:j.location.label,status:j.status,files:j.files.length,error:j.error})).reverse()}
  async managedHashes(){return new Set((await this.journals()).filter(j=>j.status==='committed').flatMap(j=>j.files.map(f=>f.afterHash)))}
  async baseline(t:Transport,name:string){
    const manifest=await readManifest(t),entry=manifest.value.abInfos.find(e=>e.name===name);
    if(!entry||!targetBundle(name))throw new Error('目标资源不存在');
    const current=await t.read(name),record=this.record(await this.journals(),t.location,name,sha256(current));
    const base=record?await this.store.readBlob(record.baseHash):current;
    if(md5(base).toLowerCase()!==entry.md5.toLowerCase())throw new Error('原包备份与当前游戏版本不符：'+name);
    return base;
  }
  private async persist(j:Journal){await atomicWrite(this.store.file('journals',j.id+'.json'),JSON.stringify(j,null,2))}
  private record(history:Journal[],location:Location,path:string,currentHash:string){
    return history.filter(j=>j.location.id===location.id&&j.status==='committed').reverse().flatMap(j=>j.files).find(f=>f.path===path&&f.afterHash===currentHash);
  }
  async prepare(t:Transport,pack:VoicePack,mode:'exact'|'variable',timing:'closed'|'hot'):Promise<PlanView>{
    const history=await this.journals();
    if(history.some(j=>!['committed','rolled-back'].includes(j.status)))throw new Error('存在未结束事务，请先在备份与恢复中完成恢复');
    if(!pack.entries.length)throw new Error('语音包尚未添加任何替换条目');
    const operation=randomUUID(),manifest=await readManifest(t),files:FileChange[]=[],warnings:string[]=[];
    const entriesByBundle=new Map<string,PackEntry[]>();
    for(const e of pack.entries){
      if(!targetBundle(e.bundle)||!targetClip(e.bundle,e.clip))throw new Error('替换目标不属于卫戍协议：'+e.bundle);
      const list=entriesByBundle.get(e.bundle)??[];list.push(e);entriesByBundle.set(e.bundle,list);
    }
    const originalCache=new Map<string,Buffer>();
    const original=async(name:string)=>{
      if(originalCache.has(name))return originalCache.get(name)!;
      const entry=manifest.value.abInfos.find(e=>e.name===name);if(!entry)throw new Error('当前资源清单中不存在：'+name);
      const current=await t.read(name),currentHash=sha256(current),record=this.record(history,t.location,name,currentHash);
      const base=record?await this.store.readBlob(record.baseHash):current;
      if(md5(base).toLowerCase()!==entry.md5.toLowerCase())throw new Error('资源已被外部修改，或游戏更新后备份过期：'+name);
      originalCache.set(name,base);return base;
    };
    let manifestChanged=false;
    for(const [name,incoming]of entriesByBundle){
      const entry=manifest.value.abInfos.find(e=>e.name===name);if(!entry)throw new Error('资源清单中不存在：'+name);
      const before=await t.read(name),beforeHash=await this.store.blob(before),base=await original(name),baseHash=await this.store.blob(base);
      const prior=this.record(history,t.location,name,beforeHash);
      const combined=new Map((prior?.entries??[]).map(e=>[e.clip,e]));for(const e of incoming)combined.set(e.clip,e);
      const entries=[...combined.values()].sort((a,b)=>(a.kind==='reference'?0:1)-(b.kind==='reference'?0:1)||a.clip.localeCompare(b.clip));
      const bundle=readBundle(base),baseBundle=readBundle(base),baseClips=audioClips(baseBundle);
      for(const e of entries){
        const clip=audioClips(bundle).find(c=>c.name===e.clip);if(!clip)throw new Error('当前版本缺少语音：'+e.clip);
        let audio:Buffer;
        if(e.kind==='reference'){
          if(!targetBundle(e.donorBundle!))throw new Error('引用目标不属于卫戍协议');
          if(e.donorBundle===name){const donor=baseClips.find(c=>c.name===e.donorClip);if(!donor)throw new Error('找不到引用语音：'+e.donorClip);referenceClip(bundle,clip,donor);continue}
          const donorBundle=readBundle(await original(e.donorBundle!)),donor=audioClips(donorBundle).find(c=>c.name===e.donorClip);
          if(!donor)throw new Error('找不到引用语音：'+e.donorClip);audio=payload(donorBundle,donor);
        }else if(e.kind==='silence')audio=encodeIma(new Int16Array(2400),24000);
        else audio=await this.store.readBlob(e.blob!);
        const info=parseFsb(audio),compression=info.codec===15?1:info.codec===7?2:info.codec===2?0:undefined;
        if(compression===undefined)throw new Error('不支持写入此音频编码：'+info.codec);
        patchClip(bundle,clip,audio,{channels:info.channels,frequency:info.rate,duration:info.samples/info.rate,compression});
      }
      clearUnusedAudio(bundle,baseClips);
      const after=mode==='exact'?packExact(bundle,base.length):writeBundle(bundle);
      const checked=readBundle(after);if(audioClips(checked).length!==baseClips.length)throw new Error('封包后的音频数量发生变化');
      for(const e of entries){const c=audioClips(checked).find(c=>c.name===e.clip)!;parseFsb(payload(checked,c))}
      const afterHash=await this.store.blob(after);files.push({path:name,beforeHash,afterHash,baseHash,entries,before:before.length,after:after.length});
      const wanted=mode==='variable'?0:base.length;
      if(entry.abSize!==wanted){entry.abSize=wanted;manifestChanged=true}
      await this.store.log('info',operation,'plan.bundle',{name,before:before.length,after:after.length,beforeHash,afterHash,entries:entries.length});
    }
    if(manifestChanged){
      if(timing==='hot')throw new Error('此模式需要先修改资源清单，请关闭游戏并使用关闭游戏后替换；后续启动才能进行变长热替换');
      const after=Buffer.from(JSON.stringify(manifest.value));const beforeHash=await this.store.blob(manifest.bytes),afterHash=await this.store.blob(after);
      files.push({path:manifestName,beforeHash,afterHash,baseHash:beforeHash,entries:[],before:manifest.bytes.length,after:after.length});
      warnings.push('首次启用或切换模式会修改受影响资源的清单大小字段，并保留完整清单备份。');
    }
    if(timing==='hot')warnings.push('请在试听或菜单空闲时应用。已载入内存的声音会在游戏释放后更新。');
    if(mode==='variable')warnings.push('变长模式保留原始校验信息；游戏资源更新或修复后需重新检查替换状态。');
    const view:PlanView={id:operation,pack:pack.name+' · '+pack.version,mode,timing,files:files.map(f=>({...f,unchanged:f.beforeHash===f.afterHash})),warnings,unchanged:files.every(f=>f.beforeHash===f.afterHash)};
    const journal:Journal={schema:1,id:operation,time:new Date().toISOString(),pack:packKey(pack),location:t.location,status:'prepared',files};
    this.plans.set(operation,{view,journal,manifestHash:sha256(manifest.bytes),created:Date.now()});
    for(const [id,p]of this.plans)if(Date.now()-p.created>600000)this.plans.delete(id);
    return view;
  }
  async apply(id:string){
    if(this.busy)throw new Error('已有资源操作正在进行');const plan=this.plans.get(id);if(!plan||Date.now()-plan.created>600000)throw new Error('替换计划已过期，请重新生成');
    this.busy=true;const j=plan.journal;let t:Transport|undefined;
    try{
      t=await this.open(j.location,this.store);
      if(plan.view.timing==='closed'&&await gameRunning(t))throw new Error('检测到明日方舟仍在运行，请先退出游戏');
      if(sha256(await t.read(manifestName))!==plan.manifestHash)throw new Error('生成计划后资源清单已变化，请重新扫描');
      for(const file of j.files)if(sha256(await t.read(file.path))!==file.beforeHash)throw new Error('生成计划后文件已变化：'+file.path);
      if(plan.view.unchanged){await this.store.log('info',id,'apply.unchanged',{pack:j.pack});return{unchanged:true}}
      await this.persist(j);j.status='committing';await this.persist(j);
      try{
        for(const file of j.files){if(file.beforeHash===file.afterHash)continue;
          await this.store.log('info',id,'commit.before',{path:file.path,beforeHash:file.beforeHash,afterHash:file.afterHash});
          await t.replace(file.path,file.beforeHash,await this.store.readBlob(file.afterHash));
          await this.store.log('info',id,'commit.verified',{path:file.path,sha256:file.afterHash});
        }
        j.status='committed';await this.persist(j);await this.store.log('info',id,'apply.complete',{files:j.files.length});
      }catch(error){
        j.error=String(error);await this.persist(j);
        try{await this.rollback(j,t)}catch(rollbackError){throw new AggregateError([error,rollbackError],'替换失败，且恢复遇到冲突。请打开备份与恢复查看事务 '+id)}
        throw error;
      }
      return{unchanged:false};
    }finally{this.plans.delete(id);this.busy=false;if(t)await t.close()}
  }
  private async rollback(j:Journal,t:Transport){
    j.status='rolling-back';await this.persist(j);
    try{
      // Preflight every file before restoring any; never overwrite an unrelated edit.
      for(const f of j.files){const current=sha256(await t.read(f.path));if(current!==f.beforeHash&&current!==f.afterHash)throw new Error('恢复发现外部修改：'+f.path)}
      for(const f of [...j.files].reverse()){
        const current=sha256(await t.read(f.path));if(current===f.beforeHash)continue;
        await this.store.log('info',j.id,'rollback.before',{path:f.path,current,original:f.beforeHash});
        await t.replace(f.path,current,await this.store.readBlob(f.beforeHash));
        await this.store.log('info',j.id,'rollback.verified',{path:f.path,sha256:f.beforeHash});
      }
      j.status='rolled-back';await this.persist(j);
    }catch(error){j.status='recovery-required';j.error=String(error);await this.persist(j);throw error}
  }
  async restore(id:string){
    if(this.busy)throw new Error('已有资源操作正在进行');this.busy=true;let t:Transport|undefined;
    try{
      const j=(await this.journals()).find(j=>j.id===id);if(!j)throw new Error('事务不存在');
      if(j.status==='rolled-back')return{unchanged:true};
      t=await this.open(j.location,this.store);
      if(await gameRunning(t))throw new Error('恢复前请退出游戏');
      await this.rollback(j,t);return{unchanged:false};
    }finally{this.busy=false;if(t)await t.close()}
  }
}
