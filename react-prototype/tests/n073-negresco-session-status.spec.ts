import {test,expect} from '@playwright/test';
test('N07.3 simulator cards and footer distinguish support from inspected installations',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 const choices=page.getByRole('group',{name:'Escolher simulador em destaque'});
 await expect(choices.locator('.negresco-simulator-status[data-state=unknown]')).toHaveCount(3);
 await expect(choices.getByText('Não inspecionado',{exact:true})).toHaveCount(3);
 await expect(page.locator('.negresco-footer-facts')).toContainText('3 simuladores suportados');
 await expect(page.locator('.negresco-footer-facts')).toContainText('0 observados');
 await expect(page.locator('.negresco-footer-facts')).toContainText('0 nomes locais');
 await choices.getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'}).click();
 await expect(choices.getByRole('button',{name:'Mostrar Euro Truck Simulator 2 no destaque'})).toHaveAttribute('aria-pressed','true');
 await expect(choices.getByText('Selecionado',{exact:true})).toHaveCount(1);
 await expect(choices.getByText('Não inspecionado',{exact:true})).toHaveCount(3);
 for(const width of [1586,1024,850,390]){
  await page.setViewportSize({width,height:992});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
 }
});
