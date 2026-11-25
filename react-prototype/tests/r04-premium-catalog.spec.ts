import {test,expect} from '@playwright/test';
test('R04 catalog art and filter controls preserve declared-only detail actions',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods',exact:true}).click();
 const tabs=page.getByRole('group',{name:'Simuladores do catálogo'});
 await expect(tabs.getByRole('button',{name:'Todos os jogos',exact:true})).toHaveAttribute('aria-pressed','true');
 await tabs.getByRole('button',{name:'OMSI 2',exact:true}).click();
 await expect(tabs.getByRole('button',{name:'OMSI 2',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.mod-card')).toHaveCount(3);
 const art=page.locator('.mod-card .premium-mod-art[data-kind=vehicle]').first();
 await expect(art).toBeVisible();
 await expect(art).toContainText('VISUAL ILUSTRATIVO');
 await page.getByRole('button',{name:'Ver Ônibus Urbano Clássico',exact:true}).click();
 await expect(page.locator('#detail-mod-title')).toHaveText('Ônibus Urbano Clássico');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)',exact:true})).toBeDisabled();
 await expect(page.locator('.detail-verification-status')).toContainText('Compatibilidade não verificada');
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
 }
 await page.getByRole('button',{name:'Voltar ao catálogo',exact:true}).click();
 await expect(tabs.getByRole('button',{name:'OMSI 2',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.mod-card')).toHaveCount(3);
});
