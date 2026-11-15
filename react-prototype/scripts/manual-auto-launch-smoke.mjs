// Launch the ACTUAL OMSI-Manager-Auto ELF on the user's KDE/GNOME/Hyprland.
// The normal Playwright picker pilot remains separate; it uses the Electron
// wrapper for instrumentation, so it does not validate the native Auto binary.
import {spawn} from 'node:child_process';
import {access,lstat,readFile,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {
 autoPilotDesktop,autoPilotGate,validateAutoExecutable,
 verifiedOperatorAnswer,observedOutcome
} from './manual-auto-launch-contract.mjs';

const args=process.argv.slice(2);
const desktop=autoPilotDesktop(args);
const allowed=autoPilotGate({
 platform:process.platform,uid:process.getuid?.(),args,env:process.env,
 stdinTTY:process.stdin.isTTY,stdoutTTY:process.stdout.isTTY
});
if(!allowed){
 console.error('AUTO_PILOT_REFUSED: interactive matching Linux desktop session required');
 process.exitCode=3;
}else{
 await run(desktop).catch(()=>{
  // Never log environment variables, paths, raw native errors or PIDs.
  console.error('AUTO_PILOT_NOT_VERIFIED');
  process.exitCode=4;
 });
}
async function run(desktop){
 const session=process.env.XDG_SESSION_TYPE;
 const dir=resolve('release/OMSI-Manager-Preview-linux-x64');
 const launcher=join(dir,'OMSI-Manager-Auto');
 const binary=join(dir,'OMSI-Manager-Preview');
 for(const item of [launcher,binary]){
  const info=await lstat(item);
  const resolved=await realpath(item);
  if(resolved!==item||!info.isFile()||info.isSymbolicLink()||
    !(info.mode&0o111))throw Error('refused-package-layout');
  await access(item,constants.X_OK);
 }
 const elf=(await readFile(launcher)).subarray(0,4);
 validateAutoExecutable({regular:true,symlink:false,executable:true,
  header:[...elf]});
 const answer=createInterface({input:process.stdin,output:process.stdout});
 let child;
 let exited=false;
 const onSignal=()=>{
  if(child&&!exited){
   try{process.kill(-child.pid,'SIGTERM');}catch{}
  }
  process.exitCode=4;
 };
 process.once('SIGINT',onSignal);
 process.once('SIGTERM',onSignal);
 try{
  console.log('PILOTO MANUAL: somente o programa portátil será aberto.');
  console.log('Nenhuma pasta OMSI será selecionada. Não abra arquivos reais do jogo.');
  verifiedOperatorAnswer((await answer.question(
   'Abrir o executável automático neste desktop? Digite SIM: '
  )).trim());
  child=spawn(launcher,[],{
   cwd:dirname(launcher),detached:true,stdio:'ignore',shell:false,
   env:{...process.env,OMSI_MANAGER_DEV_PREVIEW:'0'}
  });
  child.once('exit',()=>{exited=true;});
  child.once('error',()=>{exited=true;});
  const checkAlive=()=>!exited&&child.exitCode===null&&child.signalCode===null;
  console.log('Confirme a janela do OMSI Manager aberta pelo executável Auto.');
  verifiedOperatorAnswer((await answer.question(
   'Janela nativa está visível? Digite SIM: '
  )).trim());
  if(!checkAlive())throw Error('app-exited-prematurely');
  verifiedOperatorAnswer((await answer.question(
   'É possível navegar por teclado entre os botões? Digite SIM: '
  )).trim());
  if(!checkAlive())throw Error('app-exited-prematurely');
  verifiedOperatorAnswer((await answer.question(
   'Os textos e controles estão legíveis na escala atual? Digite SIM: '
  )).trim());
  if(!checkAlive())throw Error('app-exited-prematurely');
  console.log(JSON.stringify(observedOutcome({
   desktop,session,visible:true,keyboardNavigation:true,
   scaleReadable:true,processAlive:checkAlive()
  })));
 }finally{
  answer.close();
  process.off('SIGINT',onSignal);
  process.off('SIGTERM',onSignal);
  if(child&&!exited){
   // A detached Linux process group includes Electron child processes.
   // Do not leave test-only processes resident after the manual trial.
   try{process.kill(-child.pid,'SIGTERM');}catch{}
  }
 }
}
