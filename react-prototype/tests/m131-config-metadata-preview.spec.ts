import {test,expect} from '@playwright/test';
test('M131 separates metadata-only local preview from fictional diagnosis at narrow widths',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
 const local=page.getByRole('region',{name:'Seleção nativa de configuração OMSI'});
 const demo=page.getByRole('region',{name:'Prévia de dependências OMSI'});
 await expect(local.getByText('METADADOS LOCAIS · SOMENTE LEITURA')).toBeVisible();
 await expect(local.getByText('64 KiB',{exact:true})).toBeVisible();
 await expect(local.getByRole('button',{name:'Selecionar arquivo para pré-checagem'})).toBeDisabled();
 await expect(demo.getByText('DEMONSTRAÇÃO FICTÍCIA · somente leitura')).toBeVisible();
 await expect(demo.getByRole('button',{name:'Selecionar configuração OMSI (bloqueado)'})).toBeDisabled();
 for(const width of [390,850]){
  await page.setViewportSize({width,height:820});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
 }
});
