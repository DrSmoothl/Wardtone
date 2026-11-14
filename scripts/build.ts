import { build as esbuild } from 'esbuild';
import { build as viteBuild } from 'vite';
export async function buildMain() {
  await esbuild({entryPoints:['src/main/index.ts'], outfile:'dist/main/index.cjs', bundle:true, platform:'node', format:'cjs', target:'node24', external:['electron'], sourcemap:true});
  await esbuild({entryPoints:['src/preload/index.ts'], outfile:'dist/preload/index.cjs', bundle:true, platform:'node', format:'cjs', target:'node24', external:['electron'], sourcemap:true});
  await esbuild({entryPoints:['src/main/backend.ts'], outfile:'dist/main/backend.cjs', bundle:true, platform:'node', format:'cjs', target:'node24', sourcemap:true});
}
await buildMain();
await viteBuild();
