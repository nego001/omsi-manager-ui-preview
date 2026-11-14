import {test,expect,type Page} from '@playwright/test';
const mods=[
 {id:'source',title:'Mod Origem',game:'omsi',category:'Sons',version:'1.0',size:'1 MB',
  description:'Registro de teste com dependência local.',requires:['dep']},
 {id:'dep',title:'Dependência A',game:'omsi',category:'Sons',version:'1.0',size:'2 MB',
  description:'Dependência de teste.'},
 {id:'dep-extra',title:'Dependência Extra',game:'omsi',category:'Sons',version:'1.0',size:'3 MB',
  description:'Outro registro cujo ID contém o primeiro ID.'}
] as const;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const context=(page:Page)=>page.getByRole('region',{name:'Consulta de dependência declarada'});
async function gotoLookup(page:Page){
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'ids-proximos.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
 await expect(page.getByText('Origem: Importado: ids-proximos.json')).toBeVisible();
 await page.getByRole('button',{name:'Mod Origem',exact:true}).click();
 const timeline=page.locator('ol.relation-timeline>li').first();
 await timeline.getByText('Ver dados declarados').click();
 await timeline.getByRole('button',{name:'Localizar dependência Dependência A (ID dep) no Catálogo'}).click();
 await expect(context(page)).toBeVisible();
}
test('consulta por ID é exata, enquanto pesquisa editada continua parcial',async({page})=>{
 await gotoLookup(page);
 const search=page.getByRole('textbox',{name:'Buscar mods'});
 await expect(search).toHaveValue('dep');
 await expect(search).toBeFocused();
 await expect(context(page)).toContainText('Correspondência exata do ID declarado: dep');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Dependência A',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Dependência Extra',exact:true})).toHaveCount(0);
 await search.fill('de');
 await expect(context(page).getByText('Correspondência exata do ID declarado:',{exact:false})).toHaveCount(0);
 await expect(page.getByText('2 resultados')).toBeVisible();
 await expect(page.getByRole('button',{name:'Dependência Extra',exact:true})).toBeVisible();
 await search.fill('dep');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Dependência Extra',exact:true})).toHaveCount(0);
});
test('retorno ao diagnóstico desativa busca exata e mantém instalador bloqueado',async({page})=>{
 await gotoLookup(page);
 await page.getByRole('button',{name:'Dependência A',exact:true}).click();
 await expect(page.locator('.properties').getByText('dep',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await context(page).getByRole('button',{name:'Voltar ao diagnóstico original'}).click();
 await expect(page.getByRole('heading',{name:'Mod Origem',exact:true})).toBeVisible();
 await expect(page.getByRole('region',{name:'Simulação de dependências'})).toBeFocused();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await expect(context(page)).toHaveCount(0);
 await page.getByRole('textbox',{name:'Buscar mods'}).fill('dep');
 await expect(page.getByText('2 resultados')).toBeVisible();
});
test('atalho exato e cancelamento funcionam a 390px e via teclado',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await gotoLookup(page);
 await expect(context(page)).toContainText('Correspondência exata do ID declarado: dep');
 await expect(page.getByText('1 resultado')).toBeVisible();
 const button=context(page).getByRole('button',{name:'Restaurar filtros do Catálogo'});
 await button.focus();await page.keyboard.press('Enter');
 await expect(context(page)).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toHaveValue('');
 await page.getByRole('textbox',{name:'Buscar mods'}).fill('dep');
 await expect(page.getByText('2 resultados')).toBeVisible();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
