import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { _electron as electron } from 'playwright';

// Full end-to-end IPC exercise using an explicitly synthetic directory tree.
// Electron dialog is replaced inside the test process; real user folders are never accessed.
const root=await mkdtemp(join(tmpdir(),'omsi-manager-e2e-'));
let application;
try{
 const sample=join(root,'sample-omsi');
 await mkdir(join(sample,'Vehicles','Bus A'),{recursive:true});
 await mkdir(join(sample,'Vehicles','Bus B'),{recursive:true});
 await mkdir(join(sample,'maps','Sample Map'),{recursive:true});
 await writeFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'DO_NOT_MODIFY', 'utf8');
 application=await electron.launch({
  args:['.'],
  cwd:process.cwd(),
  env:{...process.env,OMSI_MANAGER_DEV_PREVIEW:'0'},
  timeout:60000
 });
 const window=await application.firstWindow();
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'}).waitFor({timeout:20000});
 const patch=async({dialog},response)=>{
  dialog.showOpenDialog=async()=>response;
 };
 await application.evaluate(patch,{canceled:false,filePaths:[sample]});
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
 await window.locator('.inspection-game').first().getByRole('button',{name:'Selecionar pasta e inspecionar'}).click();
 const result=window.locator('.inspection-game').first().locator('.inspection-result');
 await result.waitFor({timeout:15000});
 assert.match(await result.innerText(),/Bus|Veículos/);
 assert.match(await result.innerText(),/2/);
 assert.match(await result.innerText(),/1/);
 const safeResult=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(safeResult.status,'ok');
 assert.equal(safeResult.mode,'read-only');
 assert.equal(safeResult.recognized,true);
 assert.equal(safeResult.groups[0].count,2);
 assert.equal(safeResult.groups[1].count,1);
 assert.ok(!JSON.stringify(safeResult).includes(root),'Must not expose absolute paths');
 assert.equal(await readFile(join(sample,'Vehicles','Bus A','vehicle.bus'),'utf8'),'DO_NOT_MODIFY');

 await application.evaluate(patch,{canceled:true,filePaths:[]});
 const cancelled=await window.evaluate(()=>window.omsiPreview.inspectGame('ets2'));
 assert.deepEqual(cancelled,{status:'cancelled'});
 const rejection=await window.evaluate(async()=>{
  try{await window.omsiPreview.inspectGame('C:\\\\Windows');return false;}
  catch{return true;}
 });
 assert.equal(rejection,true);

 await application.evaluate(({dialog})=>{
  dialog.showOpenDialog=async()=>{
   await new Promise(resolve=>setTimeout(resolve,250));
   return {canceled:true,filePaths:[]};
  };
 });
 const concurrent=await window.evaluate(()=>Promise.all([
  window.omsiPreview.inspectGame('omsi'),
  window.omsiPreview.inspectGame('ets2')
 ]));
 assert.equal(concurrent.filter(x=>x.status==='cancelled').length,1);
 assert.equal(concurrent.filter(x=>x.status==='error').length,1);
 assert.equal(concurrent.find(x=>x.status==='error')?.message,'Já existe uma inspeção em andamento.');

 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 assert.equal(await window.getByRole('button',{name:'Instalar (bloqueado)'}).isDisabled(),true);
 assert.equal(await window.getByRole('button',{name:'Remover (bloqueado)'}).isDisabled(),true);
 console.log('Native folder IPC E2E: OK. Synthetic counts, cancellation, no path leak and concurrent-dialog guard.');
}finally{
 await application?.close();
 await rm(root,{recursive:true,force:true});
}
