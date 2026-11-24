import {test,expect} from '@playwright/test';
test('M142 central diagnosis displays unknown scope and navigates without native capability',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
 const center=page.getByRole('region',{name:'Central de diagnóstico local'});
 await expect(center.getByText('Sem observação local',{exact:true})).toHaveCount(3);
 await expect(center.getByText('0 de 3',{exact:true})).toBeVisible();
 await expect(center.getByRole('button',{name:'Consultar conteúdo local'})).toHaveCount(0);
 await center.getByRole('button',{name:'Consultar pré-checagem OMSI'}).click();
 await expect(page.getByRole('heading',{name:'Pré-checagem de configuração local'})).toBeFocused();
 await expect(page.getByRole('button',{name:'Selecionar arquivo para pré-checagem'})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
});
