import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const destinations=[
 ['home','Início'],
 ['games','Jogos'],
 ['catalog','Catálogo de mods'],
 ['library','Minha biblioteca'],
 ['details','Detalhes'],
 ['queue','Fila de tarefas'],
 ['history','Histórico'],
 ['settings','Configurações'],
 ['security','Segurança']
] as const;
test('registrar capturas das nove telas no protótipo isolado', async ({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 mkdirSync('test-results/screenshots',{recursive:true});
 for(const [id,label] of destinations) {
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:label}).click();
  await expect(page.getByRole('main')).toBeVisible();
  await page.screenshot({path:`test-results/screenshots/${id}.png`,fullPage:true,animations:'disabled'});
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.screenshot({path:'test-results/screenshots/catalog-mobile.png',fullPage:true,animations:'disabled'});
});
