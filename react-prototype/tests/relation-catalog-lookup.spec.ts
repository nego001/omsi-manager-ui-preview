import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const example=readFileSync(resolve('examples/catalog.dependencies.example.json'),'utf8');
const file={name:'dependencias-ficticias.json',mimeType:'application/json',buffer:Buffer.from(example)};
async function setup(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(file);
 await expect(page.getByText('Origem: Importado: dependencias-ficticias.json')).toBeVisible();
 return nav;
}
const timeline=(page:Page)=>page.locator('ol.relation-timeline>li');

test('dependência indireta abre busca pelo ID declarado sem fazer análise real',async({page})=>{
 await setup(page);
 await page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true}).click();
 const stages=timeline(page);
 await expect(stages).toHaveCount(3);
 await stages.first().getByText('Ver dados declarados').click();
 const locate=stages.first().getByRole('button',{name:'Localizar dependência Pacote base OMSI (ID omsi-core) no Catálogo'});
 await locate.click();
 const search=page.getByRole('textbox',{name:'Buscar mods'});
 await expect(search).toBeFocused();
 await expect(search).toHaveValue('omsi-core');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Pacote base OMSI',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Pacote base OMSI',exact:true}).click();
 await expect(page.locator('.properties').getByText('omsi-core',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('Biblioteca e filtros sobrevivem à consulta de ID no Catálogo em 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const nav=await setup(page);
 for(const title of ['Sons do OF-1721 (exemplo)','Pacote base OMSI']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('of-1721');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true}).click();
 const stage=timeline(page).first();
 await stage.getByText('Ver dados declarados').click();
 const jump=stage.getByRole('button',{name:/Localizar dependência Pacote base OMSI/});
 await jump.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toBeFocused();
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toHaveValue('omsi-core');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('omsi');
 await expect(page.getByRole('textbox',{name:'Buscar favoritos'})).toHaveValue('of-1721');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('dependência circular não inventa registros ausentes nem botão para o mod selecionado',async({page})=>{
 const circular=JSON.stringify({schemaVersion:1,mods:[
  {id:'a',title:'Mod A',game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',description:'Demo',requires:['b','ghost']},
  {id:'b',title:'Mod B',game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',description:'Demo',requires:['a']}
 ]});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'referencia-ausente.json',mimeType:'application/json',buffer:Buffer.from(circular)});
 await page.getByRole('button',{name:'Mod A',exact:true}).click();
 const stages=timeline(page);
 await expect(stages).toHaveCount(2);
 await stages.nth(0).getByText('Ver dados declarados').click();
 await expect(stages.nth(0).getByRole('button',{name:/Localizar dependência Mod B/})).toBeVisible();
 await stages.nth(1).getByText('Ver dados declarados').click();
 await expect(stages.nth(1).locator('.relation-stage-catalog-jump')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Simulação de dependências'})).toContainText('ID ausente: ghost');
 await expect(page.getByRole('button',{name:/Localizar dependência.*ghost/})).toHaveCount(0);
});
