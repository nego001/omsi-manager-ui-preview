import {test,expect,type Page} from '@playwright/test';

const catalogNav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
async function favorite(page:Page,title:string){
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
}
async function setupLibrary(page:Page,titles:string[]){
 await page.goto('/');
 const nav=catalogNav(page);
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const name of titles)await favorite(page,name);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
}
const region=(page:Page)=>page.getByRole('region',{name:'Seleção declarativa nos Detalhes'});

test('Detalhes marcam favoritos OMSI para análise e mantêm seleção ao navegar e retornar',async({page})=>{
 await setupLibrary(page,['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']);
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 const panel=region(page);
 await expect(panel).toContainText('0 favoritos selecionados nesta sessão');
 const bus=panel.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta nos Detalhes'});
 await bus.check();
 await expect(bus).toBeChecked();
 await expect(panel).toContainText('1 favorito selecionado nesta sessão');
 await page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'})
  .getByRole('button',{name:'Próximo mod: Serra do Vale'}).click();
 const map=panel.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta nos Detalhes'});
 await expect(map).not.toBeChecked();
 await map.check();
 await expect(panel).toContainText('2 favoritos selecionados nesta sessão');
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).toBeChecked();
 await expect(page.getByRole('checkbox',{name:'Selecionar Serra do Vale para análise conjunta'})).toBeChecked();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('omsi');
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
});

test('desmarcar no Detalhes respeita Só selecionados e não reativa análise oculta',async({page})=>{
 await setupLibrary(page,['Ônibus Urbano Clássico','Serra do Vale']);
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('checkbox',{name:'Mostrar apenas selecionados para análise'}).check();
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 const panel=region(page);
 const check=panel.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta nos Detalhes'});
 await expect(check).toBeChecked();
 await check.uncheck();
 await expect(panel).toContainText('0 favoritos selecionados nesta sessão');
 await expect(page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'}))
  .toContainText('Fora dos filtros atuais · Biblioteca');
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await page.getByRole('button',{name:'Mostrar todos os favoritos'}).click();
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).not.toBeChecked();
});

test('remover dos favoritos elimina a seleção e não a recupera ao refavoritar; layout móvel',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await setupLibrary(page,['Ônibus Urbano Clássico']);
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 const panel=region(page);
 await panel.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta nos Detalhes'}).check();
 await page.getByRole('button',{name:'Remover dos favoritos',exact:true}).click();
 await expect(panel).toHaveCount(0);
 await page.getByRole('button',{name:'Adicionar aos favoritos',exact:true}).click();
 await expect(panel).toBeVisible();
 await expect(panel.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta nos Detalhes'}))
  .not.toBeChecked();
 await expect(panel).toContainText('0 favoritos selecionados nesta sessão');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('Detalhes abertos pelo catálogo não oferecem seleção da Biblioteca',async({page})=>{
 await page.goto('/');
 await catalogNav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 await expect(region(page)).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});
