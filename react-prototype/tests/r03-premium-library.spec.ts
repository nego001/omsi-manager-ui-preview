import {test,expect} from '@playwright/test';
test('R03 library presents real favorites and read-only shortcuts with offline artwork',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Minha biblioteca',exact:true}).click();
 const summary=page.getByRole('region',{name:'Resumo da biblioteca'});
 await expect(summary.locator('strong')).toHaveText(['0','0']);
 await page.getByRole('button',{name:'Ir ao diagnóstico local',exact:true}).click();
 await expect(page.locator('#premium-diagnostic-heading')).toBeFocused();
 await expect(page.getByRole('button',{name:'Selecionar arquivo para pré-checagem'})).toBeDisabled();
 await nav.getByRole('button',{name:'Início',exact:true}).click();
 await page.getByRole('button',{name:'Favoritar',exact:true}).first().click();
 await nav.getByRole('button',{name:'Minha biblioteca',exact:true}).click();
 await expect(summary.locator('strong')).toHaveText(['1','1']);
 const game=page.getByRole('region',{name:'Resumo de favoritos por simulador'}).locator('button[data-game]').first();
 await game.click();
 await expect(game).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Ir aos filtros da biblioteca',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toBeFocused();
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
 }
});
