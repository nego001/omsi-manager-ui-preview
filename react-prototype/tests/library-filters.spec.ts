import {test,expect} from '@playwright/test';

async function addFavorite(page:import('@playwright/test').Page,title:string){
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
}

test('biblioteca filtra favoritos por jogo e categoria sem confundir com instalações',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await addFavorite(page,'Ônibus Urbano Clássico');
 await addFavorite(page,'Serra do Vale');
 await addFavorite(page,'Caminhão Rodoviário');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const summary=page.getByRole('region',{name:'Resumo da biblioteca'});
 await expect(summary.getByText('3', {exact:true})).toBeVisible();
 await expect(page.getByText('3 favoritos exibidos')).toBeVisible();
 await expect(page.getByText('Arquivos dos mods não inspecionados. Status real desconhecido.')).toBeVisible();
 await expect(page.locator('.library-mod-status')).toHaveCount(3);
 const game=page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'});
 const category=page.getByRole('combobox',{name:'Filtrar categoria na biblioteca'});
 await game.selectOption('omsi');
 await expect(page.getByText('2 favoritos exibidos')).toBeVisible();
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Caminhão Rodoviário',exact:true})).toHaveCount(0);
 await category.selectOption('Mapas');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByRole('button',{name:'Serra do Vale',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toHaveCount(0);
 await category.selectOption('Gráficos');
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(page.getByText('3 favoritos exibidos')).toBeVisible();
 await expect(game).toHaveValue('all');
 await expect(category).toHaveValue('Todos');
 await expect(page.locator('.library-mod-status')).toHaveCount(3);
});

test('tela Detalhes usa visual do próprio mod demonstrativo e avisa que não é captura real',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Ônibus Urbano Clássico',exact:true})).toBeVisible();
 await expect(page.locator('.detail-art .mod-cover')).toHaveCount(1);
 await expect(page.locator('.detail-art img')).toHaveCount(0);
 await expect(page.getByText('Arte ilustrativa do catálogo, não é uma imagem extraída deste mod.')).toBeVisible();
 await expect(page.getByText('Compatibilidade não verificada',{exact:false}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});

test('filtros da biblioteca permanecem utilizáveis em 390 e 850 pixels',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await addFavorite(page,'Ônibus Urbano Clássico');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 for(const width of [390,850]){
  await page.setViewportSize({width,height:820});
  const selects=page.locator('.library-toolbar select');
  await expect(selects).toHaveCount(4);
  const layout=await page.evaluate(()=>{
   const doc=document.documentElement;
   return {overflow:Math.max(0,doc.scrollWidth-doc.clientWidth),controls:[...document.querySelectorAll('.library-toolbar select')].map(el=>{
    const rect=el.getBoundingClientRect();return {left:rect.left,right:rect.right};
   })};
  });
  expect(layout.overflow,'Rolagem horizontal biblioteca '+width).toBeLessThanOrEqual(3);
  expect(layout.controls.every(x=>x.left>=-3&&x.right<=width+3)).toBe(true);
  await expect(page.getByText('1 favorito exibido')).toBeVisible();
 }
});

test('limpar filtros aparece com resultados e restaura a coleção sem apagar favoritos',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await addFavorite(page,'Ônibus Urbano Clássico');
 await addFavorite(page,'Serra do Vale');
 await addFavorite(page,'Caminhão Rodoviário');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const clear=page.getByRole('button',{name:'Limpar filtros da biblioteca'});
 await expect(clear).toHaveCount(0);
 const game=page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'});
 const category=page.getByRole('combobox',{name:'Filtrar categoria na biblioteca'});
 const alerts=page.getByRole('combobox',{name:'Filtrar alertas declarados'});
 const sort=page.getByRole('combobox',{name:'Ordenar biblioteca'});
 const search=page.getByRole('textbox',{name:'Buscar favoritos'});
 await game.selectOption('omsi');
 await category.selectOption('Mapas');
 await search.fill('  SERRA ');
 await sort.selectOption('title');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(clear).toHaveText('Limpar filtros (4)');
 await expect(page.getByRole('button',{name:'Serra do Vale',exact:true})).toBeVisible();
 await clear.click();
 await expect(clear).toHaveCount(0);
 await expect(game).toHaveValue('all');
 await expect(category).toHaveValue('Todos');
 await expect(alerts).toHaveValue('all');
 await expect(sort).toHaveValue('catalog');
 await expect(search).toHaveValue('');
 await expect(page.getByText('3 favoritos exibidos')).toBeVisible();
 await expect(page.locator('.library-mod-status')).toHaveCount(3);
 await expect(page.getByText('Arquivos dos mods não inspecionados. Status real desconhecido.')).toBeVisible();
});

test('limpar filtros ativo somente por ordenação ou alerta funciona no celular',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await addFavorite(page,'Ônibus Urbano Clássico');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const sort=page.getByRole('combobox',{name:'Ordenar biblioteca'});
 const alerts=page.getByRole('combobox',{name:'Filtrar alertas declarados'});
 const clear=page.getByRole('button',{name:'Limpar filtros da biblioteca'});
 await sort.selectOption('title');
 await expect(clear).toHaveText('Limpar filtros (1)');
 await alerts.selectOption('blocking');
 await expect(clear).toHaveText('Limpar filtros (2)');
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await expect(clear).toHaveCount(1);
 await clear.click();
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(sort).toHaveValue('catalog');
 await expect(alerts).toHaveValue('all');
 await expect(clear).toHaveCount(0);
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 expect(overflow).toBeLessThanOrEqual(3);
});
