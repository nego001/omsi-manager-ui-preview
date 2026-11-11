import {test,expect,type Page} from '@playwright/test';

// The History stores only temporary JSON catalog summaries, never actual installs.
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>page.locator('.mod-card').filter({
 has:page.getByRole('button',{name:title,exact:true})
});
async function savedExample(page:Page,otherFavorite=false){
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 if(otherFavorite)
  await card(page,'Caminhão Rodoviário').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await card(page,'Ônibus Urbano Clássico')
  .getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
}
test('reopening a saved selection from History returns keyboard focus to the batch review',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await savedExample(page);
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toBeVisible();
 await page.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 const batch=page.getByRole('region',{name:'Análise conjunta declarativa'});
 await expect(batch).toBeFocused();
 await expect(batch).toContainText('1 selecionado(s)');
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
 await expect(page.locator('.toast[role="status"]')).toContainText('Nada foi instalado.');
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('reopening a saved selection with no remaining favorites focuses the empty state',async({page})=>{
 await savedExample(page);
 await card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'}).click();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await page.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Explorar catálogo'})).toBeFocused();
 await expect(page.locator('.toast[role="status"]')).toContainText('Nenhum favorito deste resumo está disponível');
});

test('reopening a saved selection preserves filters and identifies hidden items',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await savedExample(page,true);
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('ets2');
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await page.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 const batch=page.getByRole('region',{name:'Análise conjunta declarativa'});
 await expect(batch).toBeFocused();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('ets2');
 await expect(batch).toContainText('1 fora dos filtros atuais');
 await expect(batch).toContainText('A análise conjunta também incluirá 1 favorito selecionado que não aparece');
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
});
