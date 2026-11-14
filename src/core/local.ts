import * as fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {safeRelative,type Location} from '../shared/model';
import {isMissing} from './storage';
import {sha256} from './unity';

export interface Transport {
  location:Location;
  read(relative:string):Promise<Buffer>;
  exists(relative:string):Promise<boolean>;
  replace(relative:string,expectedHash:string,data:Buffer):Promise<void>;
  close():Promise<void>;
}
export class LocalTransport implements Transport {
  constructor(public location:Location){}
  async resolve(relative:string){
    safeRelative.parse(relative);
    const root=await fs.realpath(this.location.root);
    const requested=path.resolve(root,...relative.split('/'));
    let cursor=root;
    for(const component of relative.split('/')){
      cursor=path.join(cursor,component);
      const stat=await fs.lstat(cursor);
      if(stat.isSymbolicLink())throw new Error('资源目录包含符号链接：'+relative);
    }
    const actual=await fs.realpath(requested);
    if(!actual.startsWith(root+path.sep))throw new Error('资源路径越出已选目录');
    return actual;
  }
  async read(relative:string){
    const p=await this.resolve(relative);const stat=await fs.stat(p);
    if(!stat.isFile()||stat.size>128*1024*1024)throw new Error('资源文件类型或大小超限：'+relative);
    return fs.readFile(p);
  }
  async exists(relative:string){try{await this.resolve(relative);return true}catch(e){if(isMissing(e))return false;throw e}}
  async replace(relative:string,expectedHash:string,data:Buffer){
    const file=await this.resolve(relative);
    if(sha256(await this.read(relative))!==expectedHash)throw new Error('文件已被游戏或其他程序修改：'+relative);
    const temp=path.join(path.dirname(file),'.wardtone-'+randomUUID()+'.tmp');
    const stat=await fs.stat(file),handle=await fs.open(temp,'wx',stat.mode&0o777);
    try {await handle.writeFile(data);await handle.sync()} finally {await handle.close()}
    if(sha256(await fs.readFile(temp))!==sha256(data))throw new Error('暂存文件读回校验失败：'+relative);
    if(sha256(await this.read(relative))!==expectedHash)throw new Error('提交前检测到外部修改，暂存文件保留：'+temp);
    await fs.rename(temp,file);
    if(sha256(await this.read(relative))!==sha256(data))throw new Error('写入后摘要不符：'+relative);
  }
  async close(){}
}
