import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});

test('exported favorite inventory is reviewed as exact changed and missing without restoring favorites',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']){
  await card(page,title).getByRole('button',{name:'Favoritar'}).click();
 }
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button',{name:'Exportar lista de favoritos em JSON'}).click()
 ]);
 const buffer=await readFile(await download.path());
 const picker=page.getByLabel('Arquivo JSON da lista de favoritos');
 const review=page.getByRole('region',{name:'Resultado da conferência de favoritos'});
 await picker.setInputFiles({name:'saved-list.json',mimeType:'application/json',buffer});
 await expect(review).toContainText('3 coincidem · 0 mudaram · 0 ausentes');
 await expect(review).toContainText('Não comprova instalação');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'different-catalog.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:[
   {id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',
    version:'1.0',size:'240 MB',description:'Mesmo identificador e versão'},
   {id:'omsi-map',title:'Serra do Vale',game:'omsi',category:'Mapas',
    version:'2.0',size:'1 GB',description:'Versão declarada diferente'}
  ]}))
 });
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await picker.setInputFiles({name:'saved-list-after-change.json',mimeType:'application/json',buffer});
 await expect(review).toContainText('1 coincidem · 1 mudaram · 1 ausentes');
 await expect(review.getByText('Coincidem: 1')).toBeVisible();
 await expect(review.getByText('Mudaram: 1')).toBeVisible();
 const changed=review.locator('.library-inventory-result-group')
  .filter({hasText:'Mudaram: 1'});
 await expect(changed).toContainText('Versão:');
 await expect(changed).toContainText('Exportado: 0.9');
 await expect(changed).toContainText('Atual: 2.0');
 await expect(changed).not.toContainText('Nome:');
 await expect(review.getByText('Ausentes: 1')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await review.getByRole('button',{name:'Descartar conferência da lista'}).click();
 await expect(picker).toBeFocused();
 await expect(review).toHaveCount(0);
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('malformed, altered and oversized favorite lists fail closed without adding favorites',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 const picker=page.getByLabel('Arquivo JSON da lista de favoritos');
 const review=page.getByRole('region',{name:'Resultado da conferência de favoritos'});
 const valid={schema:'omsi-manager-declared-favorites-list-v1',
  source:'catalog-declarations',compatibilityVerified:false,
  installationVerified:false,restorableByPreview:false,
  items:[{id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',
   category:'Ônibus',version:'1.0'}]};
 await picker.setInputFiles({name:'valid.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(valid))});
 await expect(review).toContainText('1 coincidem');
 await picker.setInputFiles({name:'forged.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({...valid,installationVerified:true}))});
 await expect(page.getByRole('alert')).toContainText('incompatível ou adulterada');
 await expect(review).toHaveCount(0);
 await picker.setInputFiles({name:'extra-field.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({...valid,items:[{...valid.items[0],path:'C:/fake'}]}))});
 await expect(page.getByRole('alert')).toContainText('incompatível ou adulterada');
 await picker.setInputFiles({name:'too-large.json',mimeType:'application/json',
  buffer:Buffer.alloc(131073,0x20)});
 await expect(page.getByRole('alert')).toContainText('128 KiB');
 await expect(review).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await picker.setInputFiles({name:'valid-again.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(valid))});
 await expect(review).toContainText('1 coincidem');
 await nav(page).getByRole('button',{name:'Jogos'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(review).toHaveCount(0);
});

test('favorite inventory details show all changed fields as inert text, without altering favorites',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 const unsafeTitle='<img src=x onerror=window.hacked=true>';
 const payload={
  schema:'omsi-manager-declared-favorites-list-v1',
  source:'catalog-declarations',
  compatibilityVerified:false,installationVerified:false,
  restorableByPreview:false,
  items:[{id:'omsi-bus',title:unsafeTitle,game:'ets2',
   category:'Sons',version:'9.0'}]
 };
 await page.getByLabel('Arquivo JSON da lista de favoritos').setInputFiles({
  name:'changed-fields.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(payload))
 });
 const result=page.getByRole('region',{name:'Resultado da conferência de favoritos'});
 await expect(result).toContainText('0 coincidem · 1 mudaram · 0 ausentes');
 const changed=result.locator('.library-inventory-result-group')
  .filter({hasText:'Mudaram: 1'});
 await expect(changed).toContainText('Nome:');
 await expect(changed).toContainText('Exportado: '+unsafeTitle);
 await expect(changed).toContainText('Atual: Ônibus Urbano Clássico');
 await expect(changed).toContainText('Jogo:');
 await expect(changed).toContainText('Exportado: ets2');
 await expect(changed).toContainText('Atual: omsi');
 await expect(changed).toContainText('Categoria:');
 await expect(changed).toContainText('Exportado: Sons');
 await expect(changed).toContainText('Atual: Ônibus');
 await expect(changed).toContainText('Versão:');
 await expect(changed).toContainText('Exportado: 9.0');
 await expect(changed).toContainText('Atual: 1.0');
 await expect(changed.locator('img')).toHaveCount(0);
 expect(await page.evaluate(()=>('hacked' in window))).toBe(false);
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
