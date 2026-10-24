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
 // First keyboard Tab must offer a direct route to the active document content.
 await window.keyboard.press('Tab');
 assert.equal(await window.getByRole('link',{name:'Pular para o conteúdo principal'}).evaluate(el=>el===document.activeElement),true);
 await window.keyboard.press('Enter');
 assert.equal(await window.locator('main#conteudo-principal').evaluate(el=>el===document.activeElement),true);

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
 const featured=window.getByRole('region',{name:'Destaque de simuladores'});
 await featured.getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'}).click();
 assert.equal(await featured.getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'}).getAttribute('aria-pressed'),'true');
 await featured.getByRole('heading',{name:'Euro Truck Simulator 2'}).waitFor();
 assert.equal(await featured.locator('.hero-spotlight-art .game-cover').count(),1);
 await featured.getByRole('button',{name:'Ver mods de Euro Truck Simulator 2'}).click();
 await window.getByRole('heading',{name:'Catálogo de mods'}).waitFor();
 assert.match(await window.locator('.result-count').first().innerText(),/2 resultados/);
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Início'}).click();
 await window.getByRole('region',{name:'Destaque de simuladores'}).getByRole('button',{name:'Mostrar OMSI 2 no destaque'}).click();
 await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'}).waitFor();
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
 const verification=window.getByRole('region',{name:'Etapas de verificação do mod'});
 assert.equal(await verification.locator('.detail-check-item').count(),4);
 assert.match(await verification.innerText(),/Nenhuma inspeção de pasta realizada/);
 assert.match(await verification.innerText(),/Conteúdo do mod/);
 assert.match(await verification.innerText(),/Compatibilidade com o jogo/);
 await verification.getByRole('link',{name:'Consultar evidências e limitações'}).click();
 assert.match(await window.evaluate(()=>location.hash),/#relatorio-consolidado/);
 await window.screenshot({path:join(shots,'04-detalhes-e-relatorio.png'),animations:'disabled'});
 // The shortcut must never auto-open a file picker or scan any real game directory.
 await verification.getByRole('button',{name:'Inspecionar pasta manualmente'}).click();
 await window.getByRole('heading',{name:'Escolha seu simulador'}).waitFor();
 assert.equal(await window.locator('.inspection-result').count(),0,'No automatic file inspection');
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Segurança'}).click();
 await window.getByRole('heading',{name:'Central de segurança'}).waitFor({timeout:12000});
 await window.screenshot({path:join(shots,'05-seguranca.png'),animations:'disabled'});
 // Prepare local-only favorite entries so the visual review checks a populated Library, not only its empty state.
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 // The earlier hero test intentionally filters ETS2; reset its catalog scope for mixed-game fixtures.
 await window.getByRole('button',{name:'Todos os jogos',exact:true}).click();
 assert.equal(await window.locator('.mod-card').count(),7);
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']){
   const card=window.locator('.mod-card').filter({has:window.getByRole('button',{name:title,exact:true})});
   await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
 assert.match(await window.locator('.library-filter-results').innerText(),/3 favoritos exibidos/);
 await window.getByRole('textbox',{name:'Buscar favoritos'}).fill('serra');
 assert.match(await window.locator('.library-filter-results').innerText(),/1 favorito exibido/);
 await window.getByRole('button',{name:'Serra do Vale',exact:true}).click();
 await window.getByRole('heading',{name:'Serra do Vale',exact:true}).waitFor();
 assert.equal(await window.getByRole('button',{name:'Instalar (bloqueado)'}).isDisabled(),true);
 await window.getByRole('button',{name:'Voltar à biblioteca'}).click();
 assert.equal(await window.getByRole('textbox',{name:'Buscar favoritos'}).inputValue(),'serra');
 await window.getByRole('textbox',{name:'Buscar favoritos'}).fill('');
 await window.getByRole('combobox',{name:'Ordenar biblioteca'}).selectOption('title');
 assert.match(await window.locator('.library-filter-results').innerText(),/3 favoritos exibidos/);
 // Restore the canonical details fixture expected by the nine-screen sweep.
 await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await window.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 // Visual evidence of all nine real screens, not just the four main destinations.
 // Use content size to exercise native BrowserWindow resizing, not a CSS-only mock.
 const screens=[
   ['Início','Seu universo de simulação, organizado.','inicio'],
   ['Jogos','Escolha seu simulador','jogos'],
   ['Catálogo de mods','Catálogo de mods','catalogo'],
   ['Minha biblioteca','Minha biblioteca','biblioteca'],
   ['Detalhes','Ônibus Urbano Clássico','detalhes'],
   ['Fila de tarefas','Fila de tarefas','fila'],
   ['Histórico','Histórico','historico'],
   ['Configurações','Configurações','configuracoes'],
   ['Segurança','Central de segurança','seguranca']
 ];
 const jsErrors=[];
 window.on('pageerror',error=>jsErrors.push(error.message));
 const screenshotManifest=[];
 const recordScreenshot=async(file)=>{
   const png=await window.screenshot({path:join(shots,file),animations:'disabled',fullPage:true});
   const size=await window.evaluate(()=>({
     viewportWidth:document.documentElement.clientWidth,
     viewportHeight:document.documentElement.clientHeight,
     devicePixelRatio:window.devicePixelRatio
   }));
   const native=await application.evaluate(({BrowserWindow})=>{
     const current=BrowserWindow.getAllWindows()[0];
     return current.getContentBounds();
   });
   screenshotManifest.push({
     file,
     imageWidthPx:png.readUInt32BE(16),
     imageHeightPx:png.readUInt32BE(20),
     ...size,
     nativeContentWidth:native.width,
     nativeContentHeight:native.height
   });
 };
 const navigate=async(name,heading)=>{
   await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name}).click();
   await window.getByRole('heading',{name:heading,exact:true}).waitFor({timeout:12000});
   const active=window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name});
   assert.match(await active.getAttribute('class')??'',/active/);
   assert.equal(await active.getAttribute('aria-current'),'page');
   assert.equal(await window.getByRole('navigation',{name:'Navegação principal'}).locator('[aria-current="page"]').count(),1);
 };
 for(const [name,heading,file] of screens){
   await navigate(name,heading);
   const displayedWidth=await window.evaluate(()=>document.documentElement.clientWidth);
   await recordScreenshot('06-'+file+'-initial-'+displayedWidth+'.png');
   assert.equal(await window.getByRole('heading',{name:heading,exact:true}).isVisible(),true);
 }
 // Native resize: 1024 and the app's declared 850px minimum.
 for(const [width,height] of [[1024,768],[850,650]]){
   await application.evaluate(({BrowserWindow},size)=>{
     const win=BrowserWindow.getAllWindows()[0];
     win.setContentSize(size.width,size.height);
   },{width,height});
   await window.waitForTimeout(180);
   const viewport=await window.evaluate(()=>({w:window.innerWidth,h:window.innerHeight}));
   assert.ok(viewport.w<=width+30&&viewport.w>=width-30,'Native window did not resize');
   for(const [name,heading,file] of screens){
     await navigate(name,heading);
     const dimensions=await window.evaluate(()=>({
       viewport:document.documentElement.clientWidth,
       width:document.documentElement.scrollWidth,
       mainWidth:document.querySelector('main')?.clientWidth??0
     }));
     assert.ok(dimensions.mainWidth>0,'Main content must remain rendered');
     // Pages must not introduce a horizontal document scrollbar at supported window sizes.
     const overflow=Math.max(0,dimensions.width-dimensions.viewport);
     console.log('WINDOWS VISUAL CHECK',width,name,'horizontal overflow px:',overflow);
     assert.ok(overflow<=3,'Horizontal document overflow on '+name+' at '+width+': '+overflow+'px');
     const cutControls=await window.evaluate(()=>{
       const viewport=document.documentElement.clientWidth;
       return [...document.querySelectorAll('button,input,select')].filter(el=>{
         const rect=el.getBoundingClientRect();
         const css=getComputedStyle(el);
         return rect.width>0&&rect.height>0&&css.display!=='none'&&css.visibility!=='hidden'&&
           (rect.left < -3 || rect.right > viewport+3);
       }).map(el=>({
         name:el.getAttribute('aria-label')??el.textContent?.slice(0,35),
         left:Math.round(el.getBoundingClientRect().left),
         right:Math.round(el.getBoundingClientRect().right)
       }));
     });
     assert.deepEqual(cutControls,[],'Interactive controls clipped on '+name+' at '+width);
     if(name==='Catálogo de mods'){
       const cards=await window.locator('.mod-card').evaluateAll(elements=>elements.map(card=>{
         const rect=card.getBoundingClientRect();
         const footer=card.querySelector('.mod-bottom')?.getBoundingClientRect();
         const title=card.querySelector('.text-button');
         const meta=card.querySelector('.meta');
         return {
           top:rect.top,bottom:rect.bottom,footerBottom:footer?.bottom??0,
           titleSize:title?parseFloat(getComputedStyle(title).fontSize):0,
           metaSize:meta?parseFloat(getComputedStyle(meta).fontSize):0
         };
       }));
       assert.ok(cards.length>0,'Catalog cards must remain rendered');
       for(const card of cards){
         assert.ok(card.titleSize>=14,'Catalog title too small on Windows at '+width);
         assert.ok(card.metaSize>=11,'Catalog metadata too small on Windows at '+width);
       }
       for(let a=0;a<cards.length;a++)for(let b=a+1;b<cards.length;b++){
         if(Math.abs(cards[a].top-cards[b].top)>2)continue;
         assert.ok(Math.abs(cards[a].footerBottom-cards[b].footerBottom)<=3,
           'Misaligned card footers on Windows at '+width);
       }
     }
     await recordScreenshot('07-'+file+'-'+width+'.png');
   }
 }
 // Chromium zoom tests text scaling inside the packaged runtime; does not claim to test Windows DPI.
 await application.evaluate(({BrowserWindow})=>{
   BrowserWindow.getAllWindows()[0].setContentSize(1024,768);
 });
 for(const factor of [1.25,1.5]){
   await application.evaluate(({BrowserWindow},zoom)=>{
     BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(zoom);
   },factor);
   await window.waitForTimeout(160);
   await navigate('Detalhes','Ônibus Urbano Clássico');
   assert.equal(await window.getByRole('button',{name:'Instalar (bloqueado)'}).isDisabled(),true);
   assert.equal(await window.getByRole('button',{name:'Remover (bloqueado)'}).isDisabled(),true);
   await window.getByRole('region',{name:'Relatório consolidado'}).waitFor({timeout:12000});
   await recordScreenshot('08-detalhes-zoom-'+Math.round(factor*100)+'.png');
 }
 await application.evaluate(({BrowserWindow})=>{
   BrowserWindow.getAllWindows()[0].webContents.setZoomFactor(1);
 });
 assert.deepEqual(jsErrors,[],'Renderer emitted uncaught JavaScript exceptions during screen sweep');
 await writeFile(join(shots,'screenshot-manifest.json'),JSON.stringify({
   note:'Initial width is measured from the runner, not assumed to be 1440px. 1024/850 are requested native content sizes. Recorded pixel dimensions include full-page height.',
   screenshots:screenshotManifest
 },null,2),'utf8');
 assert.equal(screenshotManifest.length,29,'Expected 9 initial + 18 resized + 2 zoom screenshots');
 console.log('WINDOWS NINE SCREENS: OK. 9 pages at measured initial size, requested 1024 and 850 content widths, plus 2 zoom screenshots.');

 console.log('WINDOWS PORTABLE EXE SMOKE: OK. EXE empacotado abriu; sandbox, IPC, inspeção sintética, relatório e bloqueios verificados.');
}finally{
 await application?.close();
 await rm(root,{recursive:true,force:true});
}
