import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {serializeDeclaredBatchSelection} from '../src/batch-selection-export';
import type {CatalogMod} from '../src/catalog';

const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const proposed={schemaVersion:1,mods:[{
 id:'after',title:'Somente metadado de exemplo',game:'omsi',category:'Ônibus',
 version:'1.0',size:'2 MB',description:'Registro fictício sem arquivos reais'
}]};
const base:CatalogMod={id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',
 version:'1.0',size:'240 MB',description:'Somente exemplo',safe:true};

test('serializador limita a exportação a declarações e rejeita IDs e campos inválidos',()=>{
 const input={...base,unsafePath:'/private/not-for-export',run:'install'};
 const json=serializeDeclaredBatchSelection([input]);
 const parsed=JSON.parse(json);
 expect(parsed).toMatchObject({
  schema:'omsi-manager-declared-batch-selection-v1',
  scope:'active-selection-metadata-only',source:'catalog-declarations',
  selectedCount:1,selectedMods:[{id:'omsi-bus',title:'Ônibus Urbano Clássico',
   game:'omsi',category:'Ônibus',version:'1.0'}],
  installationVerified:false,compatibilityVerified:false,restorableByPreview:false
 });
 expect(Object.keys(parsed.selectedMods[0])).toEqual(['id','title','game','category','version']);
 expect(json).not.toContain('unsafePath');
 expect(json).not.toContain('install');
 for(const entries of [[],[base,base],[{...base,id:'INVALID'}],
  [{...base,title:''}],[{...base,game:'unknown' as CatalogMod['game']}]]){
  expect(()=>serializeDeclaredBatchSelection(entries)).toThrow('DECLARED_SELECTION_INVALID');
 }
});

test('download de seleção ativa na prévia preserva dados ao cancelar e não restaura após confirmar',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const picker=page.getByLabel('Arquivo JSON do catálogo');
 await picker.setInputFiles({name:'proposed.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(proposed))});
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent).toContainText('Mods selecionados para análise conjunta: 1');
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  consent.getByRole('button',{name:'Baixar seleção ativa antes de substituir'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Selecao-Declarada.json');
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(exported).toMatchObject({
  schema:'omsi-manager-declared-batch-selection-v1',selectedCount:1,
  selectedMods:[{id:'omsi-bus',title:'Ônibus Urbano Clássico'}],
  installationVerified:false,compatibilityVerified:false,restorableByPreview:false
 });
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).toBeChecked();
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await picker.setInputFiles({name:'reproposed.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(proposed))});
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('sem seleção ativa, não exibe exportação vazia no pré-voo',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'proposed.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(proposed))
 });
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent).toBeVisible();
 await expect(consent.getByRole('button',{name:'Baixar seleção ativa antes de substituir'})).toHaveCount(0);
 await expect(consent.getByRole('button',{name:'Baixar lista de favoritos antes de substituir'})).toBeVisible();
});
