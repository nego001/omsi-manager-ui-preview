import {test,expect} from '@playwright/test';

const navName='Navegação principal';
const warningName='Aviso sobre substituir o catálogo';
const freshCatalog={
 schemaVersion:1,
 mods:[{
  id:'ficticio',title:'Exemplo de importação',game:'omsi',
  category:'Ônibus',version:'1',size:'1 MB',
  description:'Metadados fictícios para testar substituição'
 }]
};

test('catalog replacement warns before clearing favorites, and invalid JSON cannot clear them',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:navName});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const warning=page.getByRole('note',{name:warningName});
 await expect(warning).toHaveCount(0);
 const card=page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})
 });
 await card.getByRole('button',{name:'Favoritar'}).click();
 await expect(warning).toContainText('descarta favoritos, seleções, resumos temporários');
 await expect(warning).toContainText('Exporte os resumos importantes');
 const picker=page.getByLabel('Arquivo JSON do catálogo');
 await picker.setInputFiles({
  name:'invalido.json',mimeType:'application/json',buffer:Buffer.from('{invalid')
 });
 await expect(page.getByRole('alert')).toBeVisible();
 await expect(warning).toBeVisible();
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await picker.setInputFiles({
  name:'novo.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(freshCatalog))
 });
 const confirm=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(confirm).toBeVisible();
 await expect(confirm.getByRole('heading',{name:'Confirmar substituição do catálogo'})).toBeFocused();
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await confirm.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(confirm).toHaveCount(0);
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await picker.setInputFiles({name:'novo.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(freshCatalog))});
 await expect(confirm).toBeVisible();
 await confirm.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(page.getByRole('button',{name:'Exemplo de importação',exact:true})).toBeFocused();
 await expect(warning).toHaveCount(0);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('saved session history alone triggers catalog-replacement warning after favorite removal',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:navName});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})
 });
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{
  name:'Selecionar Ônibus Urbano Clássico para análise conjunta'
 }).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})
 }).getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await expect(page.getByRole('note',{name:warningName})).toContainText('resumos temporários');
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
});
