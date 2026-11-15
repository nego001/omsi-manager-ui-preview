// Fresh, exclusive output staging for CI-owned X11 reports. Never accept a
// preexisting directory, file or symlink, even if it looks empty and private.
// Does not touch external paths outside the caller's root.
import {mkdir,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';

const refuse=()=>{throw Error('AUTO_X11_HANDOFF_OUTPUT_REFUSED');};
const safeDirectory=stat=>stat.isDirectory()&&!stat.isSymbolicLink()&&
 (stat.mode&0o777)===0o700;

export async function prepareFreshX11OutputDirectory(root){
 if(typeof root!=='string'||!root.trim())refuse();
 const path=resolve(root,'x11-diff-output');
 let stat;
 try{
  await mkdir(path,{mode:0o700,recursive:false});
  stat=await lstat(path);
 }catch{refuse();}
 if(!safeDirectory(stat))refuse();
 return Object.freeze({path,device:stat.dev,inode:stat.ino});
}

export async function verifyX11OutputDirectoryIdentity(output){
 if(!output||typeof output!=='object'||
  typeof output.path!=='string'||!Number.isSafeInteger(output.device)||
  !Number.isSafeInteger(output.inode))refuse();
 let stat;
 try{stat=await lstat(output.path);}catch{refuse();}
 if(!safeDirectory(stat)||stat.dev!==output.device||
  stat.ino!==output.inode)refuse();
 return true;
}
