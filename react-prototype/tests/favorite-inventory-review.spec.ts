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
 const [reportDownload]=await Promise.all([
  page.waitForEvent('download'),
  review.getByRole('button',{name:'Exportar conferência em JSON'}).click()
 ]);
 expect(reportDownload.suggestedFilename()).toBe('OMSI-Manager-Conferencia-de-Favoritos.json');
 const report=JSON.parse(await readFile(await reportDownload.path(),'utf8'));
 expect(report.schema).toBe('omsi-manager-declared-favorites-comparison-v1');
 expect(report.source).toBe('catalog-declarations');
 expect(report.comparison).toBe('exported-inventory-vs-active-catalog');
 expect(report).toMatchObject({
  compatibilityVerified:false,installationVerified:false,restorableByPreview:false,
  counts:{total:3,exact:1,changed:1,missing:1},
  exact:[{id:'omsi-bus',version:'1.0'}],
  changed:[{
   exported:{id:'omsi-map',version:'0.9'},
   differences:[{field:'version',exported:'0.9',current:'2.0'}]
  }],
  missing:[{id:'ets-truck',version:'2.0'}]
 });
 expect(Object.keys(report)).toEqual([
  'schema','source','comparison','compatibilityVerified','installationVerified',
  'restorableByPreview','counts','exact','changed','missing'
 ]);
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
 await expect(page.getByRole('button',{name:'Exportar conferência em JSON'})).toHaveCount(0);
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
 const [reportDownload]=await Promise.all([
  page.waitForEvent('download'),
  result.getByRole('button',{name:'Exportar conferência em JSON'}).click()
 ]);
 const raw=await readFile(await reportDownload.path(),'utf8');
 const report=JSON.parse(raw);
 expect(report).toMatchObject({
  compatibilityVerified:false,installationVerified:false,restorableByPreview:false,
  counts:{total:1,exact:0,changed:1,missing:0},
  changed:[{exported:{id:'omsi-bus',title:unsafeTitle},
   differences:[
    {field:'title',exported:unsafeTitle,current:'Ônibus Urbano Clássico'},
    {field:'game',exported:'ets2',current:'omsi'},
    {field:'category',exported:'Sons',current:'Ônibus'},
    {field:'version',exported:'9.0',current:'1.0'}
   ]}]
 });
 expect(raw).not.toContain('modPath');
 expect(raw).not.toContain('installPath');
 expect(await page.evaluate(()=>('hacked' in window))).toBe(false);
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('favorite review search finds matching entries beyond the initial 20 and leaves JSON complete',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 const entries=Array.from({length:26},(_,i)=>({
  id:'missing_'+String(i).padStart(2,'0'),
  title:'Pacote Fictício '+String(i).padStart(2,'0'),
  game:'omsi',category:'Sons',version:'1.0'
 }));
 const payload={schema:'omsi-manager-declared-favorites-list-v1',
  source:'catalog-declarations',compatibilityVerified:false,
  installationVerified:false,restorableByPreview:false,items:entries};
 await page.getByLabel('Arquivo JSON da lista de favoritos').setInputFiles({
  name:'twenty-six-missing.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(payload))
 });
 const result=page.getByRole('region',{name:'Resultado da conferência de favoritos'});
 await expect(result).toContainText('0 coincidem · 0 mudaram · 26 ausentes');
 const missing=result.locator('.library-inventory-result-group').filter({hasText:'Ausentes: 26'});
 await expect(missing.getByText(/Pacote Fictício 25/)).toHaveCount(0);
 const search=page.getByRole('searchbox',{name:'Buscar registros na conferência'});
 await search.fill('pacote ficticio 25');
 await expect(result.getByRole('status')).toContainText('1 de 26 registro(s)');
 await expect(missing.getByText(/Pacote Fictício 25/)).toBeVisible();
 await expect(missing.getByText(/Pacote Fictício 01/)).toHaveCount(0);
 await expect(result).toContainText('0 coincidem · 0 mudaram · 26 ausentes');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  result.getByRole('button',{name:'Exportar conferência em JSON'}).click()
 ]);
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report.counts).toEqual({total:26,exact:0,changed:0,missing:26});
 expect(report.missing).toHaveLength(26);
 expect(report.missing[25]).toMatchObject({id:'missing_25',title:'Pacote Fictício 25'});
 await search.fill('not-a-matching-id');
 await expect(result).toContainText('Nenhum registro corresponde à busca');
 await expect(result.getByRole('status')).toContainText('0 de 26 registro(s)');
 await search.fill('');
 await expect(result.getByRole('status')).toHaveCount(0);
 await expect(missing.locator('li')).toHaveCount(20);
 const showMore=missing.getByRole('button',{name:'Mostrar mais ausentes (6 restantes)'});
 await showMore.focus();
 await expect(showMore).toBeFocused();
 await showMore.press('Enter');
 await expect(missing.locator('li')).toHaveCount(26);
 const showLess=missing.getByRole('button',{name:'Mostrar menos ausentes (voltar a 20)'});
 await expect(showLess).toBeFocused();
 await showLess.press('Enter');
 await expect(missing.locator('li')).toHaveCount(20);
 await expect(showMore).toBeFocused();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('favorite review search matches current name and ID, resets on invalid file or navigation',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 const valid={schema:'omsi-manager-declared-favorites-list-v1',
  source:'catalog-declarations',compatibilityVerified:false,
  installationVerified:false,restorableByPreview:false,
  items:[{id:'omsi-bus',title:'Nome anterior',game:'omsi',
   category:'Ônibus',version:'1.0'}]};
 const picker=page.getByLabel('Arquivo JSON da lista de favoritos');
 await picker.setInputFiles({name:'renamed.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(valid))});
 const result=page.getByRole('region',{name:'Resultado da conferência de favoritos'});
 const search=page.getByRole('searchbox',{name:'Buscar registros na conferência'});
 await expect(result).toContainText('0 coincidem · 1 mudaram · 0 ausentes');
 await search.fill('ONIBUS URBANO CLASSICO');
 await expect(result.getByRole('status')).toContainText('1 de 1 registro(s)');
 await expect(result).toContainText('Nome anterior');
 await search.fill('omsi-bus');
 await expect(result.getByRole('status')).toContainText('1 de 1 registro(s)');
 await search.fill('inexistente');
 await expect(result).toContainText('Nenhum registro corresponde à busca');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  result.getByRole('button',{name:'Exportar conferência em JSON'}).click()
 ]);
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report.counts).toEqual({total:1,exact:0,changed:1,missing:0});
 await picker.setInputFiles({name:'broken.json',mimeType:'application/json',
  buffer:Buffer.from('{')});
 await expect(result).toHaveCount(0);
 await expect(page.getByRole('alert')).toContainText('incompatível ou adulterada');
 await picker.setInputFiles({name:'valid-again.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(valid))});
 await expect(result).toBeVisible();
 await expect(search).toHaveValue('');
 await nav(page).getByRole('button',{name:'Jogos'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(result).toHaveCount(0);
 await picker.setInputFiles({name:'valid-return.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(valid))});
 await expect(search).toHaveValue('');
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});

test('favorite comparison loads next 20 entries per click and resets on search or new file',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 const entries=Array.from({length:45},(_,index)=>({
  id:'missing_'+String(index).padStart(2,'0'),
  title:'Registro de Exemplo '+String(index).padStart(2,'0'),
  game:'omsi',category:'Sons',version:'1.0'
 }));
 const payload={schema:'omsi-manager-declared-favorites-list-v1',
  source:'catalog-declarations',compatibilityVerified:false,
  installationVerified:false,restorableByPreview:false,items:entries};
 const picker=page.getByLabel('Arquivo JSON da lista de favoritos');
 const upload=async(name:string)=>picker.setInputFiles({
  name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))
 });
 await upload('many-favorites.json');
 const result=page.getByRole('region',{name:'Resultado da conferência de favoritos'});
 const missing=result.locator('.library-inventory-result-group').filter({hasText:'Ausentes: 45'});
 await expect(result).toContainText('0 coincidem · 0 mudaram · 45 ausentes');
 await expect(missing.locator('li')).toHaveCount(20);
 await expect(missing.getByText(/Registro de Exemplo 44/)).toHaveCount(0);
 await missing.getByRole('button',{name:'Mostrar mais ausentes (25 restantes)'}).click();
 await expect(missing.locator('li')).toHaveCount(40);
 await missing.getByRole('button',{name:'Mostrar mais ausentes (5 restantes)'}).click();
 await expect(missing.locator('li')).toHaveCount(45);
 await expect(missing.getByText(/Registro de Exemplo 44/)).toBeVisible();
 const showLess=missing.getByRole('button',{name:'Mostrar menos ausentes (voltar a 20)'});
 await expect(showLess).toBeVisible();
 await showLess.focus();
 await showLess.press('Enter');
 await expect(missing.locator('li')).toHaveCount(20);
 await expect(missing.getByRole('button',{name:'Mostrar mais ausentes (25 restantes)'})).toBeFocused();
 const search=page.getByRole('searchbox',{name:'Buscar registros na conferência'});
 await search.fill('EXEMPLO 44');
 await expect(missing.locator('li')).toHaveCount(1);
 await expect(result.getByRole('status')).toContainText('1 de 45');
 await search.fill('');
 await expect(missing.locator('li')).toHaveCount(20);
 await expect(missing.getByRole('button',{name:'Mostrar mais ausentes (25 restantes)'})).toBeVisible();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  result.getByRole('button',{name:'Exportar conferência em JSON'}).click()
 ]);
 const report=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(report.counts).toEqual({total:45,exact:0,changed:0,missing:45});
 expect(report.missing).toHaveLength(45);
 await upload('same-list-new-review.json');
 await expect(missing.locator('li')).toHaveCount(20);
 await expect(missing.getByRole('button',{name:'Mostrar mais ausentes (25 restantes)'})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
