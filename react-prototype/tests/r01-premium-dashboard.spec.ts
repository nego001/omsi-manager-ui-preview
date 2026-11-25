import {test,expect} from '@playwright/test';
test('R01 premium dashboard displays real empty-session counts and preserves navigation offline',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 const stats=page.getByRole('region',{name:'Indicadores da sessão'});
 await expect(stats.locator('strong')).toHaveText(['0','0','0','0']);
 await expect(page.getByRole('region',{name:'Biblioteca local no início'})).toContainText('Nenhum nome local exibível');
 await expect(page.getByRole('region',{name:'Diagnóstico no início'}).getByText('Sem observação local',{exact:true})).toHaveCount(3);
 await expect(page.getByRole('region',{name:'Atividades recentes no início'})).toContainText('Nenhuma atividade local registrada.');
 for(const width of [1440,1024,850,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
 }
 await page.getByRole('button',{name:'Revisar diagnóstico'}).click();
 await expect(page.locator('#premium-diagnostic-heading')).toBeFocused();
 await expect(page.getByRole('button',{name:'Selecionar arquivo para pré-checagem'})).toBeDisabled();
});
