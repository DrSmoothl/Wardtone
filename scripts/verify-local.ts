import fs from 'node:fs/promises';
import path from 'node:path';
import {Store} from '../src/core/storage';
import {LocalTransport} from '../src/core/local';
import {scan} from '../src/core/game';
import {readBundle,writeBundle,audioClips,payload,sha256} from '../src/core/unity';
import {parseFsb,fsbPreview} from '../src/core/audio';
const fixture=path.resolve(process.env.WARDTONE_FIXTURE??'.fixtures/Bundles');
const store=new Store(path.resolve('.test-runs/inspection'));
await store.init();
const location={id:'fixture',label:'格式验证副本',kind:'local' as const,root:fixture};
const t=new LocalTransport(location),inventory=await scan(t,new Set(),store,'verify-local');
const codebooks=JSON.parse(await fs.readFile('resources/vorbis-codebooks.json','utf8'));
const report=[];
for(const item of inventory.bundles){
 const bytes=await t.read(item.path),bundle=readBundle(bytes),output=writeBundle(bundle),reparsed=readBundle(output);
 for(let i=0;i<bundle.nodes.length;i++)if(sha256(bundle.nodes[i].data)!==sha256(reparsed.nodes[i].data))throw new Error('节点重封装发生变化：'+item.path);
 const clips=audioClips(bundle);let previews=0;
 for(const itemClip of item.clips){const clip=clips.find(c=>c.name===itemClip.name)!;const audio=payload(bundle,clip);parseFsb(audio);fsbPreview(audio,codebooks);previews++}
 report.push({path:item.path,allAudioClips:clips.length,targetClips:item.clips.length,previews,bytes:bytes.length,repackedBytes:output.length,nodeHashPreserved:true});
}
if(inventory.bundles.length!==10||inventory.bundles.reduce((n,b)=>n+b.clips.length,0)!==133)throw new Error('资源覆盖数量与当前测试版本不一致');
await fs.writeFile('.test-runs/local-format-validation.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
