import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const out=resolve('artifacts/windows-screenshots');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const pages=['inicio','catalogo','onibus','mapas','mods','historico','configuracoes'];
const sizes=[{label:'1366x768',width:1366,height:768},{label:'1920x1080',width:1920,height:1080}];
const results=[];
try{
 for(const size of sizes)for(const route of pages){
  const context=await browser.newContext({viewport:{width:size.width,height:size.height},deviceScaleFactor:1,colorScheme:'dark'});
  await context.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname==='127.0.0.1'&&u.port==='4173') await r.continue();else await r.abort()});
  const page=await context.newPage();
  const file=size.label+'-'+route+'.png';
  await page.goto('http://127.0.0.1:4173/#'+route,{waitUntil:'load'});
  await page.screenshot({path:resolve(out,file),animations:'disabled',fullPage:true});
  const title=await page.title();
  results.push({file,route,size:size.label,title});
  console.log('Screenshot:',file);
  await context.close();
 }
}finally{await browser.close()}
await writeFile(resolve(out,'results.json'),JSON.stringify({safe:true,previewOnly:true,results},null,2));
await writeFile(resolve(out,'index.html'),'<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width"><title>Capturas OMSI Manager</title><style>body{background:#111;color:#eee;font:16px Arial;margin:24px}img{max-width:100%;border:1px solid #333}section{margin-bottom:30px}</style><h1>Capturas Windows — UI isolada</h1>'+results.map(x=>'<section><h2>'+x.file+'</h2><img src="'+x.file+'"></section>').join('')+'</html>');
