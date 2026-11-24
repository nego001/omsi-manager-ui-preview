import {test,expect} from '@playwright/test';
test('M136 browser navigation between preview panels keeps native controls blocked',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Minha biblioteca'}).click();
 const meta=page.getByRole('region',{name:'Seleção nativa de configuração OMSI'});
 const demo=page.getByRole('region',{name:'Prévia de dependências OMSI'});
 const jump=meta.getByRole('button',{name:'Ver demonstração de dependências'});
 await jump.focus();await page.keyboard.press('Enter');
 await expect(demo.getByRole('heading',{name:'Diagnóstico de dependências OMSI'})).toBeFocused();
 await expect(demo.getByRole('button',{name:'Selecionar configuração OMSI (bloqueado)'})).toBeDisabled();
 await demo.getByRole('button',{name:'Voltar à pré-checagem OMSI'}).click();
 await expect(meta.getByRole('heading',{name:'Pré-checagem de configuração local'})).toBeFocused();
 await expect(meta.getByRole('button',{name:'Selecionar arquivo para pré-checagem'})).toBeDisabled();
 await expect(meta.getByRole('button',{name:'Voltar ao conteúdo local'})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(3);
});
