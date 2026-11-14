import {test,expect} from '@playwright/test';

const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const proposed={schemaVersion:1,mods:[
 {id:'omsi-bus',title:'Ônibus Urbano Clássico revisado',game:'omsi',
  category:'Ônibus',version:'8.0',size:'240 MB',
  description:'Metadados fictícios de revisão, sem mod real'},
 {id:'only-new',title:'Novo declarado',game:'ets2',category:'Sons',
  version:'1.0',size:'1 MB',description:'Registro de exemplo'}
]};
test('prévia mostra reutilização de ID e mudanças de versão sem afirmar instalação',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'reused-id.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(proposed))
 });
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const compare=consent.getByRole('group',{name:'Comparação declarativa entre catálogos'});
 await expect(compare).toBeVisible();
 await expect(compare).toContainText('ID mantido com metadados alterados: 1');
 await expect(compare).toContainText('IDs adicionados: 1');
 await expect(compare).toContainText('Ônibus Urbano Clássico revisado');
 await expect(compare).toContainText('versão');
 await expect(compare).toContainText('Novos IDs são registros do JSON');
 await expect(compare).toContainText('não representa comparação de arquivos instalados');
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(compare).toHaveCount(0);
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('nova proposta substitui a comparação anterior e confirmação continua separada',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 const input=page.getByLabel('Arquivo JSON do catálogo');
 await input.setInputFiles({name:'first.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(proposed))});
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const compare=consent.getByRole('group',{name:'Comparação declarativa entre catálogos'});
 await expect(compare).toContainText('ID mantido com metadados alterados: 1');
 await input.setInputFiles({name:'second.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:[{
   id:'entirely-new',title:'Outro catálogo',game:'ats',category:'Sons',
   version:'1',size:'1 MB',description:'Apenas metadados'
  }]}))});
 await expect(compare).toContainText('ID mantido com metadados alterados: 0');
 await expect(compare).toContainText('IDs adicionados: 1');
 await expect(compare).toContainText('Outro catálogo');
 await expect(compare).not.toContainText('Ônibus Urbano Clássico revisado');
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(page.getByRole('button',{name:'Outro catálogo',exact:true})).toBeVisible();
 await expect(compare).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
