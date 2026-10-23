import assert from 'node:assert/strict';
import {access, mkdir, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import { _electron as electron } from 'playwright';

// This must point to the packaged Windows EXE, not "electron ." from node_modules.
if(process.platform!=='win32')throw new Error('O smoke do executável portátil exige Windows.');
const exe=resolve(process.argv[2]??'release/OMSI-Manager-Preview-win32-x64/OMSI-Manager-Preview.exe');
await access(exe,constants.R_OK);
const shots=resolve('test-results/screenshots/portable-windows');
await mkdir(shots,{recursive:true});
const root=await mkdtemp(join(tmpdir(),'omsi-portable-smoke-'));
let application;
try{
 const sample=join(root,'OMSI 2 - Synthetic');
 await mkdir(join(sample,'Vehicles','Bus A'),{recursive:true});
 await mkdir(join(sample,'maps','Sample Map'),{recursive:true});
 await writeFile(join(sample,'Vehicles','Bus A','sentinel.bus'),'UNCHANGED', 'utf8');
 application=await electron.launch({
   executablePath:exe,
   args:[],
   cwd:root,
   env:{...process.env,OMSI_MANAGER_DEV_PREVIEW:'0'},
   timeout:90000
 });
 const info=await application.evaluate(({app,BrowserWindow})=>({
   packaged:app.isPackaged,
   appPath:app.getAppPath(),
   windows:BrowserWindow.getAllWindows().length
 }));
 assert.equal(info.packaged,true,'O teste deve iniciar o executável empacotado');
 assert.ok(info.appPath.includes('app.asar'),'Aplicação deve rodar dentro de app.asar');
 assert.ok(info.windows>0,'Deve abrir uma janela');
 const window=await application.firstWindow();
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'}).waitFor({timeout:30000});
 const isolation=await window.evaluate(()=>({
   nodeRequire:typeof window.require,
   nodeProcess:typeof window.process,
   rawIpc:typeof window.ipcRenderer,
   previewMode:window.omsiPreview?.mode,
   read:window.omsiPreview?.capabilities?.readGameFiles,
   install:window.omsiPreview?.capabilities?.installMods,
   uninstall:window.omsiPreview?.capabilities?.uninstallMods,
   command:window.omsiPreview?.capabilities?.executeCommands,
   inspect:typeof window.omsiPreview?.inspectGame
 }));
 assert.deepEqual(isolation,{
   nodeRequire:'undefined',nodeProcess:'undefined',rawIpc:'undefined',
   previewMode:'read-only',read:false,install:false,uninstall:false,
   command:false,inspect:'function'
 });
 await window.screenshot({path:join(shots,'01-inicio.png'),animations:'disabled'});
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
 await window.getByRole('heading',{name:'Escolha seu simulador'}).waitFor({timeout:12000});
 await window.screenshot({path:join(shots,'02-jogos.png'),animations:'disabled'});

 // Intercept only this test run's native dialog and return a freshly generated synthetic path.
 await application.evaluate(({dialog},path)=>{
   dialog.showOpenDialog=async()=>({canceled:false,filePaths:[path]});
 },sample);
 await window.locator('.inspection-game').first().getByRole('button',{name:'Selecionar pasta e inspecionar'}).click();
 const result=window.locator('.inspection-game').first().locator('.inspection-result');
 await result.waitFor({timeout:15000});
 assert.match(await result.innerText(),/Veículos/);
 assert.match(await result.innerText(),/Mapas/);
 const actual=await window.evaluate(()=>window.omsiPreview.inspectGame('omsi'));
 assert.equal(actual.status,'ok');
 assert.equal(actual.groups[0].count,1);
 assert.equal(actual.groups[1].count,1);
 assert.equal(actual.assessment.compatibilityVerified,false);
 assert.equal(actual.assessment.installationVerified,false);
 assert.ok(!JSON.stringify(actual).includes(root),'Caminhos absolutos nunca devem vazar para o renderer');
 assert.equal(await readFile(join(sample,'Vehicles','Bus A','sentinel.bus'),'utf8'),'UNCHANGED');
 await window.screenshot({path:join(shots,'03-inspecao-ficticia.png'),animations:'disabled'});

 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await window.getByRole('region',{name:'Relatório consolidado'}).waitFor({timeout:12000});
 assert.equal(await window.getByRole('button',{name:'Instalar (bloqueado)'}).isDisabled(),true);
 assert.equal(await window.getByRole('button',{name:'Remover (bloqueado)'}).isDisabled(),true);
 assert.match(await window.getByRole('region',{name:'Relatório consolidado'}).innerText(),/Compatibilidade não verificada/);
 await window.screenshot({path:join(shots,'04-detalhes-e-relatorio.png'),animations:'disabled'});
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Segurança'}).click();
 await window.getByRole('heading',{name:'Central de segurança'}).waitFor({timeout:12000});
 await window.screenshot({path:join(shots,'05-seguranca.png'),animations:'disabled'});
 console.log('WINDOWS PORTABLE EXE SMOKE: OK. EXE empacotado abriu; sandbox, IPC, inspeção sintética, relatório e bloqueios verificados.');
}finally{
 await application?.close();
 await rm(root,{recursive:true,force:true});
}
