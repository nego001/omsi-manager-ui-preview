import {test,expect} from '@playwright/test';
test('web preview cannot launch file picker or content inspection',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Selecionar arquivo para pré-checagem'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Selecionar configuração OMSI (bloqueado)'})).toBeDisabled();
});
