import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const source=readFileSync(resolve('examples/catalog.dependencies.example.json'),'utf8');
const upload={name:'return-dependencies.json',mimeType:'application/json',buffer:Buffer.from(source)};
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const context=(page:Page)=>page.getByRole('region',{name:'Consulta de dependência declarada'});
async function start(page:Page){
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(upload);
 await page.getByRole('button',{name:'OMSI 2',exact:true}).click();
 await page.getByRole('combobox',{name:'Filtrar categoria'}).selectOption('Sons');
 await page.getByRole('combobox',{name:'Ordenar catálogo'}).selectOption('title');
 await page.getByRole('textbox',{name:'Buscar mods'}).fill('of-1721');
 await page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true}).click();
 await page.getByRole('textbox',{name:'Versão hipotética do jogo'}).fill('1.52');
 await page.locator('ol.relation-timeline>li').first().getByText('Ver dados declarados').click();
 await page.getByRole('button',{name:/Localizar dependência Pacote base OMSI/}).click();
 await expect(context(page)).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toHaveValue('omsi-core');
}
test('voltar ao diagnóstico preserva versão hipotética e filtros originais do Catálogo',async({page})=>{
 await start(page);
 await expect(context(page)).toContainText('Sons do OF-1721 (exemplo)');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await page.getByRole('button',{name:'Pacote base OMSI',exact:true}).click();
 await expect(page.locator('.properties').getByText('omsi-core',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await context(page).getByRole('button',{name:'Voltar ao diagnóstico original'}).click();
 await expect(page.getByRole('heading',{name:'Sons do OF-1721 (exemplo)',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Simulação de dependências'})).toBeFocused();
 await expect(page.getByRole('textbox',{name:'Versão hipotética do jogo'})).toHaveValue('1.52');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await expect(context(page)).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toHaveValue('of-1721');
 await expect(page.getByRole('combobox',{name:'Filtrar categoria'})).toHaveValue('Sons');
 await expect(page.getByRole('combobox',{name:'Ordenar catálogo'})).toHaveValue('title');
 await expect(page.getByRole('button',{name:'OMSI 2',exact:true})).toHaveClass(/selected/);
 await expect(page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true})).toBeVisible();
});
test('cancelar consulta só restaura filtros, com teclado e sem modificação de favoritos',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await start(page);
 const cancel=context(page).getByRole('button',{name:'Restaurar filtros do Catálogo'});
 await cancel.focus();await page.keyboard.press('Enter');
 await expect(context(page)).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toHaveValue('of-1721');
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toBeFocused();
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Filtrar categoria'})).toHaveValue('Sons');
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('importar novo catálogo ou restaurar demo invalida contexto antigo',async({page})=>{
 await start(page);
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 await expect(context(page)).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toBeVisible();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(upload);
 await page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true}).click();
 await page.locator('ol.relation-timeline>li').first().getByText('Ver dados declarados').click();
 await page.getByRole('button',{name:/Localizar dependência Pacote base OMSI/}).click();
 await expect(context(page)).toBeVisible();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'new-catalog.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:[{
   id:'other-mod',title:'Outro mod fictício',game:'omsi',category:'Sons',
   version:'1.0',description:'Apenas metadados de teste.',size:'0 B'}]}))
 });
 await expect(context(page)).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Outro mod fictício',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Voltar ao diagnóstico original'})).toHaveCount(0);
});
