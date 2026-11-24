import {test,expect} from '@playwright/test';
test('M143 settings groups preserve preferences and browser capability boundaries',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Configurações'}).click();
 for(const name of ['Aparência','Simuladores e descoberta','Plataforma','Privacidade e dados','Integrações e segurança'])
  await expect(page.getByRole('region',{name,exact:true})).toBeVisible();
 await expect(page.getByRole('checkbox',{name:/Detectar jogos ao iniciar/})).toHaveCount(0);
 await page.getByRole('checkbox',{name:/Cards compactos/}).check();
 await page.reload();
 await nav.getByRole('button',{name:'Configurações'}).click();
 await expect(page.getByRole('checkbox',{name:/Cards compactos/})).toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
 await page.getByRole('button',{name:'Abrir central de segurança'}).click();
 await expect(page.getByRole('heading',{name:'Central de segurança'})).toBeVisible();
 await nav.getByRole('button',{name:'Configurações'}).click();
 await page.getByRole('button',{name:'Gerenciar simuladores em Jogos'}).click();
 await expect(page.getByRole('heading',{name:'Escolha seu simulador'})).toBeVisible();
 await expect(page.locator('.inspection-game').first().getByRole('button',{name:'Selecionar pasta e inspecionar'})).toBeDisabled();
});
