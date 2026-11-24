import {test,expect} from '@playwright/test';
test('M145 session panels share visual rhythm while demonstration stays distinct',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const meta=page.getByRole('region',{name:'Seleção nativa de configuração OMSI'});
 const demo=page.getByRole('region',{name:'Prévia de dependências OMSI'});
 const center=page.getByRole('region',{name:'Central de diagnóstico local'});
 for(const panel of [meta,demo,center]){
  await expect(panel).toBeVisible();
  expect(await panel.evaluate(el=>getComputedStyle(el).paddingTop)).toBe('12px');
  expect(await panel.evaluate(el=>getComputedStyle(el).borderRadius)).toBe('12px');
 }
 expect(await demo.evaluate(el=>getComputedStyle(el).borderTopStyle)).toBe('dashed');
 await expect(meta.getByRole('button',{name:'Selecionar arquivo para pré-checagem'})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
 await nav.getByRole('button',{name:'Configurações'}).click();
 const platform=page.getByRole('region',{name:'Plataforma',exact:true});
 await expect(platform).toContainText('Instalação e remoção de mods permanecem bloqueadas');
 await expect(page.getByRole('region',{name:'Aparência',exact:true})).toBeVisible();
});
