import {test,expect} from '@playwright/test';
test('M144 browser history does not invent activity',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico',exact:true}).click();
 const activity=page.getByRole('region',{name:'Atividades locais da sessão'});
 await expect(activity.getByText('Nenhuma atividade local registrada nesta sessão.')).toBeVisible();
 await expect(activity.getByRole('button',{name:'Limpar atividades locais'})).toBeDisabled();
 await activity.getByRole('button',{name:'Consultar biblioteca local'}).click();
 await expect(page.getByRole('heading',{name:'Minha biblioteca',exact:true})).toBeVisible();
});
