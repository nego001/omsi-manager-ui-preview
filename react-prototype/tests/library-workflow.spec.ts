import {test,expect,type Page} from '@playwright/test';

async function favorite(page:Page,title:string){
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
}

test('buscar favoritos mantém a Biblioteca e preserva filtros ao consultar Detalhes',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await favorite(page,'Ônibus Urbano Clássico');
 await favorite(page,'Serra do Vale');
 await favorite(page,'Caminhão Rodoviário');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const query=page.getByRole('textbox',{name:'Buscar favoritos'});
 await expect(query).toHaveAttribute('placeholder','Buscar favoritos...');
 await query.fill('serra');
 await expect(nav.getByRole('button',{name:'Minha biblioteca'})).toHaveAttribute('aria-current','page');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByRole('button',{name:'Serra do Vale',exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('omsi');
 await page.getByRole('combobox',{name:'Filtrar categoria na biblioteca'}).selectOption('Mapas');
 await page.getByRole('button',{name:'Serra do Vale',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Serra do Vale',exact:true})).toBeVisible();
 await expect(page.getByText('Compatibilidade não verificada',{exact:false}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Minha biblioteca'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Buscar favoritos'})).toHaveValue('serra');
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('omsi');
 await expect(page.getByRole('combobox',{name:'Filtrar categoria na biblioteca'})).toHaveValue('Mapas');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await page.getByRole('textbox',{name:'Buscar favoritos'}).fill('inexistente');
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(page.getByRole('textbox',{name:'Buscar favoritos'})).toHaveValue('');
 await expect(page.getByText('3 favoritos exibidos')).toBeVisible();
});

test('ordem dos favoritos é separada da ordem do catálogo e restauração limpa preferências de sessão',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await favorite(page,'Serra do Vale');
 await favorite(page,'Caminhão Rodoviário');
 await favorite(page,'Ônibus Urbano Clássico');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const titles=page.locator('.mod-card .text-button');
 await expect(titles).toHaveText(['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']);
 const sort=page.getByRole('combobox',{name:'Ordenar biblioteca'});
 await sort.selectOption('title');
 await expect(titles).toHaveText(['Caminhão Rodoviário','Ônibus Urbano Clássico','Serra do Vale']);
 await sort.selectOption('game');
 await expect(titles).toHaveText(['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']);
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await expect(page.getByRole('textbox',{name:'Buscar mods'})).toBeVisible();
 await page.getByRole('textbox',{name:'Buscar mods'}).fill('Serra');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('textbox',{name:'Buscar favoritos'})).toHaveValue('');
 await expect(sort).toHaveValue('game');
 await expect(page.getByText('3 favoritos exibidos')).toBeVisible();
});

test('voltar do detalhe retorna ao início quando o mod partiu do destaque',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ônibus Urbano Clássico'})).toBeVisible();
 await page.getByRole('button',{name:'Voltar ao início'}).click();
 await expect(page.getByRole('heading',{name:'Seu universo de simulação, organizado.'})).toBeVisible();
});

test('busca da biblioteca e ordenação não recortam os controles em janela pequena',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await favorite(page,'Ônibus Urbano Clássico');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await page.setViewportSize({width:390,height:740});
 await expect(page.getByRole('textbox',{name:'Buscar favoritos'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Ordenar biblioteca'})).toBeVisible();
 const layout=await page.evaluate(()=>{
  const viewport=document.documentElement.clientWidth;
  const visible=[...document.querySelectorAll('.library-toolbar select,.search input')].map(el=>{
   const rect=el.getBoundingClientRect();
   return {left:rect.left,right:rect.right,width:rect.width};
  });
  return {viewport,overflow:Math.max(0,document.documentElement.scrollWidth-viewport),visible};
 });
 expect(layout.overflow).toBeLessThanOrEqual(3);
 for(const rect of layout.visible){
  expect(rect.left).toBeGreaterThanOrEqual(-3);
  expect(rect.right).toBeLessThanOrEqual(layout.viewport+3);
  expect(rect.width).toBeGreaterThan(60);
 }
});
