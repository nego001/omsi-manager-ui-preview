import {test,expect} from '@playwright/test';

test('a interface funciona em janela estreita sem liberar operações',async ({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Segurança'}).click();
 await expect(page.getByRole('heading',{name:'Central de segurança'})).toBeVisible();
 await expect(page.getByText('Instalação bloqueada',{exact:true})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('não oferece ponte Electron ou APIs Node no navegador',async ({page})=>{
 await page.goto('/');
 const globals=await page.evaluate(()=>({
   requirePresent:'require' in window,
   electronPresent:'electron' in window,
   nodeProcessPresent:typeof (window as Window & {process?:unknown}).process!=='undefined'
 }));
 expect(globals).toEqual({requirePresent:false,electronPresent:false,nodeProcessPresent:false});
});
