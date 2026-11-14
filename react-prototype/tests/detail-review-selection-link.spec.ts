import {test,expect,type Page} from '@playwright/test';
const group=(page:Page)=>page.getByRole('region',{name:'Análise conjunta declarativa'});
const panel=(page:Page)=>page.getByRole('region',{name:'Seleção declarativa nos Detalhes'});
async function add(page:Page,titles:string[]){
 await page.goto('/');
 const n=page.getByRole('navigation',{name:'Navegação principal'});
 await n.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of titles){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await n.getByRole('button',{name:'Minha biblioteca'}).click();
}
test('revisão via Detalhes foca seção sem iniciar análise automaticamente',async({page})=>{
 await add(page,['Ônibus Urbano Clássico','Serra do Vale']);
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 await expect(panel(page).getByRole('button',{name:/Revisar seleção na Biblioteca/})).toHaveCount(0);
 await panel(page).getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta nos Detalhes'}).check();
 await panel(page).getByRole('button',{name:'Revisar seleção na Biblioteca (1)'}).click();
 await expect(group(page)).toBeFocused();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).toBeChecked();
 await group(page).getByRole('button',{name:'Analisar seleção'}).click();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
});
test('atalho por teclado conserva Só selecionados no celular de 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await add(page,['Ônibus Urbano Clássico','Serra do Vale']);
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('checkbox',{name:'Mostrar apenas selecionados para análise'}).check();
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 const button=panel(page).getByRole('button',{name:'Revisar seleção na Biblioteca (1)'});
 await button.focus();await page.keyboard.press('Enter');
 await expect(group(page)).toBeFocused();
 await expect(page.getByRole('checkbox',{name:'Mostrar apenas selecionados para análise'})).toBeChecked();
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toHaveCount(0);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('origem Catálogo e seleção vazia não mostram o atalho',async({page})=>{
 await add(page,['Ônibus Urbano Clássico']);
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 await expect(panel(page).getByRole('button',{name:/Revisar seleção na Biblioteca/})).toHaveCount(0);
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 await expect(panel(page)).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Revisar seleção na Biblioteca/})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});
