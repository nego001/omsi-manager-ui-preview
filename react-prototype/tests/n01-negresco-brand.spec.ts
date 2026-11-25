import {test,expect} from '@playwright/test';
test('Negresco Tools visible brand preserves the nine-route shell',async({page})=>{
 await page.goto('/');
 await expect(page).toHaveTitle('Negresco Tools — Gerenciador de Simuladores');
 await expect(page.locator('.brand strong')).toHaveText('Negresco Tools');
 await expect(page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button')).toHaveCount(9);
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Segurança',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Instalação bloqueada',exact:true})).toBeVisible();
});
