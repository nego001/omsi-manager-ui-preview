import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';

const titles=(page:import('@playwright/test').Page)=>
 page.locator('.mod-grid .mod-card .text-button').allTextContents();

test('ordenação do Catálogo altera cartões e navegação em Detalhes sem mudar dados',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'})
  .getByRole('button',{name:'Catálogo de mods'}).click();
 const sort=page.getByRole('combobox',{name:'Ordenar catálogo'});
 await expect(sort).toHaveValue('catalog');
 expect(await titles(page)).toEqual([
  'Ônibus Urbano Clássico','Serra do Vale','Pacote de Sons',
  'Caminhão Rodoviário','Iluminação Noturna','Long Haul Classic','Motor & Estrada'
 ]);
 await sort.selectOption('game');
 expect(await titles(page)).toEqual([
  'Ônibus Urbano Clássico','Pacote de Sons','Serra do Vale',
  'Caminhão Rodoviário','Iluminação Noturna','Long Haul Classic','Motor & Estrada'
 ]);
 const chips=page.getByRole('group',{name:'Filtros ativos do catálogo'});
 await expect(chips).toContainText('Ordem: Jogo e nome');
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 const scope=page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'});
 await expect(scope).toContainText('1 de 7 · Catálogo');
 await scope.getByRole('button',{name:'Próximo mod: Pacote de Sons'}).click();
 await expect(page.getByRole('heading',{name:'Pacote de Sons',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await expect(page.getByRole('button',{name:'Pacote de Sons',exact:true})).toBeFocused();
 await expect(sort).toHaveValue('game');
 const chip=chips.getByRole('button',{name:'Remover ordenação do catálogo'});
 await chip.focus();
 await page.keyboard.press('Enter');
 await expect(chips).toHaveCount(0);
 await expect(sort).toHaveValue('catalog');
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toBeFocused();
 expect((await titles(page)).slice(0,3)).toEqual(['Ônibus Urbano Clássico','Serra do Vale','Pacote de Sons']);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('ordenação alfabética e busca filtrada preservam JSON importado e favoritos',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(resolve('examples/catalog.example.json'));
 const title='Ônibus urbano OF-1721';
 const favorite=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
 await favorite.getByRole('button',{name:'Favoritar'}).click();
 const sort=page.getByRole('combobox',{name:'Ordenar catálogo'});
 await sort.selectOption('title');
 expect(await titles(page)).toEqual(['Mapa rodoviário demonstrativo','Ônibus urbano OF-1721','Pacote de som de motor']);
 await page.getByRole('button',{name:'Euro Truck Simulator 2',exact:true}).click();
 await page.getByRole('combobox',{name:'Filtrar categoria'}).selectOption('Ônibus');
 await expect(page.locator('.catalog-empty-filter')).toBeVisible();
 await page.getByRole('button',{name:'Mostrar todos os mods'}).click();
 await expect(sort).toHaveValue('title');
 await expect(page.getByRole('button',{name:'Mapa rodoviário demonstrativo',exact:true})).toBeFocused();
 expect(await titles(page)).toEqual(['Mapa rodoviário demonstrativo','Ônibus urbano OF-1721','Pacote de som de motor']);
 await expect(page.getByText('Origem: Importado: catalog.example.json')).toBeVisible();
 await expect(favorite.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(resolve('examples/catalog.example.json'));
 await expect(sort).toHaveValue('catalog');
 expect(await titles(page)).toEqual(['Ônibus urbano OF-1721','Pacote de som de motor','Mapa rodoviário demonstrativo']);
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toHaveCount(0);
});
