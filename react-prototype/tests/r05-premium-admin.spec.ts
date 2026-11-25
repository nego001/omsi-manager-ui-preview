import {test,expect} from '@playwright/test';
test('R05 admin screens retain real preferences and blocked operations',async({page})=>{
 await page.route('https://shared.fastly.steamstatic.com/**',route=>route.abort());
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Fila de tarefas',exact:true}).click();
 await expect(page.getByText('Fila bloqueada por segurança',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Consultar proteções da fila'}).click();
 await expect(page.getByRole('heading',{name:'Central de segurança',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Instalação bloqueada',exact:true})).toBeVisible();
 await nav.getByRole('button',{name:'Histórico',exact:true}).click();
 await expect(page.getByRole('region',{name:'Indicadores do histórico'}).locator('strong')).toHaveText(['0','0']);
 await expect(page.getByLabel('Arquivo JSON de resumos exportados')).toBeVisible();
 await nav.getByRole('button',{name:'Configurações',exact:true}).click();
 const compact=page.getByRole('checkbox',{name:/Cards compactos/});
 await expect(compact).not.toBeChecked();
 await compact.check();
 await page.reload();
 await nav.getByRole('button',{name:'Configurações',exact:true}).click();
 await expect(compact).toBeChecked();
 await compact.uncheck();
 for(const width of [1440,1024,390]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
 }
 await page.getByRole('button',{name:'Abrir central de segurança',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Desinstalação bloqueada',exact:true})).toBeVisible();
});
