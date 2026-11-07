import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const raw=readFileSync(resolve('examples/catalog.dependencies.example.json'),'utf8');
const file={name:'inbound-library-demo.json',mimeType:'application/json',buffer:Buffer.from(raw)};
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const favoriteCard=(page:Page,title:string)=>page.locator('.mod-card')
 .filter({has:page.getByRole('button',{name:title,exact:true})});
async function prepare(page:Page){
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(file);
 for(const title of ['Pacote base OMSI','Sons do OF-1721 (exemplo)','Pacote alternativo (exemplo)'])
  await favoriteCard(page,title).getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
}
test('library cards count direct incoming metadata without inflating declared blocker counts',async({page})=>{
 await prepare(page);
 const base=favoriteCard(page,'Pacote base OMSI');
 await expect(base.getByRole('note')).toContainText('1 dependência(s) recebida(s)');
 await expect(base.getByRole('note')).toContainText('0 conflito(s) declarado(s) por outros');
 const sound=favoriteCard(page,'Sons do OF-1721 (exemplo)');
 await expect(sound.getByRole('note')).toContainText('0 dependência(s) recebida(s)');
 await expect(sound.getByRole('note')).toContainText('1 conflito(s) declarado(s) por outros');
 const alternative=favoriteCard(page,'Pacote alternativo (exemplo)');
 await expect(alternative.locator('.library-incoming-references')).toHaveCount(0);
 await expect(page.getByText('Ausência de alertas declarados não comprova compatibilidade nem instalação.',{exact:false})).toBeVisible();
});
test('library incoming link opens right section with keyboard focus and preserves library filters',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await prepare(page);
 const search=page.getByRole('textbox',{name:'Buscar favoritos'});
 await search.fill('omsi-core');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 const button=page.getByRole('button',{name:'Consultar referências recebidas de Pacote base OMSI'});
 await button.focus();
 await page.keyboard.press('Enter');
 const section=page.getByRole('region',{name:'Referências recebidas no catálogo'});
 await expect(section).toBeFocused();
 await expect(section).toContainText('Ônibus OF-1721 (exemplo)');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(search).toHaveValue('omsi-core');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(button).toBeFocused();
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('incoming references follow the validated imported catalog, not cached prior data',async({page})=>{
 await prepare(page);
 await expect(favoriteCard(page,'Pacote base OMSI').locator('.library-incoming-references')).toHaveCount(1);
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const newSource=JSON.stringify({schemaVersion:1,mods:[
  {id:'single',title:'Registro único',game:'omsi',category:'Ônibus',version:'1',size:'1 MB',description:'Exemplo fictício'}
 ]});
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'single-only.json',mimeType:'application/json',buffer:Buffer.from(newSource)});
 await favoriteCard(page,'Registro único').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.locator('.library-incoming-references')).toHaveCount(0);
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
});
