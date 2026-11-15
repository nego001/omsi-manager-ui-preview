import {test,expect} from '@playwright/test';

async function favorite(
 page:import('@playwright/test').Page,title:string
){
 const card=page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:title,exact:true})
 });
 await card.getByRole('button',{name:'Favoritar'}).click();
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
}

test('catálogo encontra ônibus sem acento, com caixa mista e espaços extras',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 const search=page.getByRole('textbox',{name:'Buscar mods'});
 await search.fill('  ONIBUS    urbano ');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Serra do Vale',exact:true})).toHaveCount(0);
 await search.fill('  OMSI   MAPAS   SERRA  ');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Serra do Vale',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toHaveCount(0);
 await search.fill(' nao existe ');
 await expect(page.getByText('0 resultados')).toBeVisible();
 await expect(page.getByText('Nenhum mod corresponde aos filtros.')).toBeVisible();
});

test('biblioteca combina busca sem acentos, jogo e categoria sem perder favoritos',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await favorite(page,'Ônibus Urbano Clássico');
 await favorite(page,'Serra do Vale');
 await favorite(page,'Caminhão Rodoviário');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const search=page.getByRole('textbox',{name:'Buscar favoritos'});
 await search.fill('  mapas   SERRA ');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByRole('button',{name:'Serra do Vale',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toHaveCount(0);
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('ets2');
 await expect(page.getByRole('heading',{name:'Nenhum favorito nesses filtros'})).toBeVisible();
 await page.getByRole('button',{name:'Limpar filtros da biblioteca'}).click();
 await expect(search).toHaveValue('');
 await expect(page.getByText('3 favoritos exibidos')).toBeVisible();
 await expect(page.locator('.library-mod-status')).toHaveCount(3);
 await search.fill('CAMINHOES rodoviario');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByRole('button',{name:'Caminhão Rodoviário',exact:true})).toBeVisible();
 await expect(page.getByText('Arquivos dos mods não inspecionados. Status real desconhecido.')).toBeVisible();
 await expect(page.locator('.library-mod-status')).toHaveCount(1);
});

test('busca por metadados não habilita instalação nos detalhes',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'})
  .getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('textbox',{name:'Buscar mods'}).fill('onibus');
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await expect(page.getByText('Arte ilustrativa do catálogo, não é uma imagem extraída deste mod.')).toBeVisible();
});
