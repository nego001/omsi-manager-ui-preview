import {test,expect} from '@playwright/test';
test('navegação das nove telas e bloqueios', async ({page})=>{
 await page.goto('/');
 for(const [name,heading] of [['Jogos','Escolha seu simulador'],['Catálogo de mods','Catálogo de mods'],['Minha biblioteca','Minha biblioteca'],['Detalhes','Ônibus Urbano Clássico'],['Fila de tarefas','Fila de tarefas'],['Histórico','Histórico'],['Configurações','Configurações'],['Segurança','Central de segurança'],['Início','Seu universo de simulação, organizado.']] as const){
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name}).click();
  await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
 }
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('jogo, filtro e detalhes selecionados',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
 await page.getByRole('button',{name:/Euro Truck Simulator 2.*Ver mods/}).click();
 await expect(page.getByText('2 resultados')).toBeVisible();
 await page.getByRole('button',{name:'Iluminação Noturna'}).click();
 await expect(page.getByRole('heading',{name:'Iluminação Noturna'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});
test('favoritos não executam instalação',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Favoritar'}).first().click();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico'})).toBeVisible();
 await expect(page.getByText('Os favoritos são temporários')).toBeVisible();
});
test('pesquisa e filtros não atravessam jogos',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'OMSI 2',exact:true}).click();
 await expect(page.getByText('3 resultados')).toBeVisible();
 await page.getByRole('combobox',{name:'Filtrar categoria'}).selectOption('Mapas');
 await expect(page.getByText('1 resultado')).toBeVisible();
 await expect(page.getByRole('button',{name:'Serra do Vale'})).toBeVisible();
});
