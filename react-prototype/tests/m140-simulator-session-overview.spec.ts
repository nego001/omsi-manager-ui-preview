import {test,expect} from '@playwright/test';
test('M140 browser overview keeps three simulators unknown and navigates without selecting folders',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos',exact:true}).click();
 const overview=page.getByRole('region',{name:'Central dos simuladores'});
 await expect(overview.getByRole('article')).toHaveCount(3);
 await expect(overview.getByText('Sem observação nesta sessão',{exact:true})).toHaveCount(3);
 await overview.getByRole('button',{name:'Ir à inspeção de OMSI 2'}).click();
 await expect(page.locator('#simulator-inspection-omsi')).toBeFocused();
 await expect(page.locator('.inspection-game').first().getByRole('button',{name:'Selecionar pasta e inspecionar'})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
});
