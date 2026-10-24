import {test,expect} from '@playwright/test';

test('o destaque alterna simuladores e mantém somente uma capa por vez',async({page})=>{
 await page.goto('/');
 const hero=page.getByRole('region',{name:'Destaque de simuladores'});
 await expect(hero).toBeVisible();
 await expect(hero.locator('.hero-spotlight-art .game-cover')).toHaveCount(1);
 const choices=hero.getByRole('group',{name:'Escolher simulador em destaque'});
 const omsi=choices.getByRole('button',{name:'Mostrar OMSI 2 no destaque'});
 const ets2=choices.getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'});
 const ats=choices.getByRole('button',{name:'Mostrar American Truck Simulator no destaque'});
 await expect(omsi).toHaveAttribute('aria-pressed','true');
 await expect(ets2).toHaveAttribute('aria-pressed','false');
 await ets2.click();
 await expect(ets2).toHaveAttribute('aria-pressed','true');
 await expect(choices.locator('[aria-pressed="true"]')).toHaveCount(1);
 await expect(hero.getByRole('heading',{name:'Euro Truck Simulator 2'})).toBeVisible();
 await expect(hero.locator('.hero-spotlight-art .cover-fallback strong')).toHaveText('Euro Truck Simulator 2');
 await ats.click();
 await expect(hero.getByRole('heading',{name:'American Truck Simulator'})).toBeVisible();
 await expect(ats).toHaveAttribute('aria-pressed','true');
 await expect(hero.locator('.hero-spotlight-art .game-cover')).toHaveCount(1);
});

test('abrir catálogo pelo destaque filtra pelo jogo selecionado e não instala nada',async({page})=>{
 await page.goto('/');
 const hero=page.getByRole('region',{name:'Destaque de simuladores'});
 await hero.getByRole('group',{name:'Escolher simulador em destaque'}).getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'}).click();
 await hero.getByRole('button',{name:'Ver mods de Euro Truck Simulator 2'}).click();
 await expect(page.getByRole('heading',{name:'Catálogo de mods'})).toBeVisible();
 await expect(page.getByText('2 resultados')).toBeVisible();
 await expect(page.getByRole('button',{name:'Iluminação Noturna',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Iluminação Noturna',exact:true}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});

test('seletor do destaque é utilizável pelo teclado e não se perde no menu compacto',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Alternar menu'}).click();
 const hero=page.getByRole('region',{name:'Destaque de simuladores'});
 const ats=hero.getByRole('button',{name:'Mostrar American Truck Simulator no destaque'});
 await ats.focus();
 await page.keyboard.press('Enter');
 await expect(ats).toHaveAttribute('aria-pressed','true');
 await expect(hero.getByRole('heading',{name:'American Truck Simulator'})).toBeVisible();
 await page.keyboard.press('Shift+Tab');
 await expect(hero.getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'})).toBeFocused();
 await page.keyboard.press('Space');
 await expect(hero.getByRole('heading',{name:'Euro Truck Simulator 2'})).toBeVisible();
});

test('destaque panorâmico não cria rolagem horizontal e mantém ações no modo compacto',async({page})=>{
 await page.goto('/');
 for(const width of [1440,1024,850,390]){
  await page.setViewportSize({width,height:760});
  const hero=page.getByRole('region',{name:'Destaque de simuladores'});
  await expect(hero.getByRole('button',{name:'Explorar jogos'})).toBeVisible();
  await expect(hero.getByRole('button',{name:'Ver mods de OMSI 2'})).toBeVisible();
  const layout=await page.evaluate(()=>{
   const doc=document.documentElement,hero=document.querySelector('.hero');
   const actions=[...document.querySelectorAll('.hero-actions button,.featured-selector button')];
   return {
    horizontalOverflow:Math.max(0,doc.scrollWidth-doc.clientWidth),
    heroWidth:hero?.getBoundingClientRect().width??0,
    actions:actions.map(el=>({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right}))
   };
  });
  expect(layout.horizontalOverflow,'Overflow em '+width).toBeLessThanOrEqual(3);
  expect(layout.heroWidth).toBeGreaterThan(200);
  for(const action of layout.actions){
   expect(action.left,'Controle fora da área em '+width).toBeGreaterThanOrEqual(-3);
   expect(action.right,'Controle fora da área em '+width).toBeLessThanOrEqual(width+3);
  }
 }
});
