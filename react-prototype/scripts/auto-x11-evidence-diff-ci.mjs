// GitHub Actions only: compare two exact same-workflow diagnostic artifacts.
// Do not read arbitrary paths or print artifact contents. No policy edits.
import {open,mkdir,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve} from 'node:path';
import {parseSanitizedX11Record,compareSanitizedX11Records}
 from './auto-x11-evidence-diff.mjs';
if(process.platform!=='linux'||process.getuid?.()===0||
 process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true')
 throw Error('AUTO_X11_CROSS_RUNNER_CI_ONLY');
async function safeRead(runner){
 const path=resolve('x11-diff-input',runner,'host-evidence.json');
 let f;
 try{
  f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  const stat=await f.stat();
  if(!stat.isFile()||stat.size<100||stat.size>4096)
   throw Error('AUTO_X11_CROSS_RUNNER_REFUSED');
  const content=await f.readFile({encoding:'utf8'});
  return parseSanitizedX11Record(content,runner);
 }catch{
  throw Error('AUTO_X11_CROSS_RUNNER_REFUSED');
 }finally{
  await f?.close();
 }
}
const [older,newer]=await Promise.all([
 safeRead('ubuntu-22.04'),safeRead('ubuntu-24.04')
]);
const comparison=compareSanitizedX11Records(older,newer);
await mkdir('x11-diff-output',{mode:0o700,recursive:true});
await writeFile('x11-diff-output/host-comparison.json',
 JSON.stringify(comparison)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
console.log('AUTO_X11_CROSS_RUNNER_READY',JSON.stringify(comparison));
