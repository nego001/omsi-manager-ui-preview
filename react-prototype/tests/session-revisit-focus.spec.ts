import {test,expect,type Page} from '@playwright/test';
import {readFile} from 'node:fs/promises';

// The History stores only temporary JSON catalog summaries, never actual installs.
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>page.locator('.mod-card').filter({
 has:page.getByRole('button',{name:title,exact:true})
});
async function savedExample(page:Page,otherFavorite=false){
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 if(otherFavorite)
  await card(page,'Caminhão Rodoviário').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await card(page,'Ônibus Urbano Clássico')
  .getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
}
test('reopening a saved selection from History returns keyboard focus to the batch review',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await savedExample(page);
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toBeVisible();
 await page.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 const batch=page.getByRole('region',{name:'Análise conjunta declarativa'});
 await expect(batch).toBeFocused();
 await expect(batch).toContainText('1 selecionado(s)');
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
 await expect(page.locator('.toast[role="status"]')).toContainText('Nada foi instalado.');
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('reopening a saved selection with no remaining favorites focuses the empty state',async({page})=>{
 await savedExample(page);
 await card(page,'Ônibus Urbano Clássico')
  .getByRole('button',{name:'Retirar dos favoritos'}).click();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await page.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Explorar catálogo'})).toBeFocused();
 await expect(page.locator('.toast[role="status"]')).toContainText('Nenhum favorito deste resumo está disponível');
});

test('reopening a saved selection preserves filters and identifies hidden items',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await savedExample(page,true);
 await page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'}).selectOption('ets2');
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await page.getByRole('button',{name:'Rever seleção do resumo 1'}).click();
 const batch=page.getByRole('region',{name:'Análise conjunta declarativa'});
 await expect(batch).toBeFocused();
 await expect(page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'})).toHaveValue('ets2');
 await expect(batch).toContainText('1 fora dos filtros atuais');
 await expect(batch).toContainText('A análise conjunta também incluirá 1 favorito selecionado que não aparece');
 await expect(page.getByRole('region',{name:'Resultado da análise conjunta'})).toBeVisible();
});

test('deleting a saved summary focuses Undo, then the restored summary',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await savedExample(page);
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 const remove=page.getByRole('button',{name:'Excluir resumo 1 desta sessão'});
 await remove.focus();
 await page.keyboard.press('Enter');
 const undo=page.getByRole('button',{name:'Desfazer exclusão do último resumo'});
 await expect(undo).toBeFocused();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toHaveCount(0);
 await undo.click();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeFocused();
 await expect(remove).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('undo restores one summary without disturbing a different saved summary',async({page})=>{
 await savedExample(page);
 // Save the same hypothetical selection again as a separate session snapshot.
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await page.getByRole('button',{name:'Excluir resumo 2 desta sessão'}).click();
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toBeFocused();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 await page.getByRole('button',{name:'Desfazer exclusão do último resumo'}).click();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 2'})).toBeFocused();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
});

test('clearing the whole History focuses heading and permanently discards session summaries',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await savedExample(page);
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 await page.getByRole('button',{name:'Limpar resumos da sessão'}).click();
 await expect(page.getByRole('heading',{name:'Histórico',exact:true})).toBeFocused();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toHaveCount(0);
 await expect(page.locator('.toast[role="status"]')).toContainText('Resumos temporários desta sessão limpos');
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('clearing all also invalidates pending single-summary undo',async({page})=>{
 await savedExample(page);
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await page.getByRole('button',{name:'Excluir resumo 2 desta sessão'}).click();
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toBeFocused();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 await page.getByRole('button',{name:'Limpar resumos da sessão'}).click();
 await expect(page.getByRole('heading',{name:'Histórico',exact:true})).toBeFocused();
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 2'})).toHaveCount(0);
});

test('discarding an exported report returns focus to the JSON picker without modifying session history',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await savedExample(page);
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button',{name:'Exportar resumo 1 em JSON'}).click()
 ]);
 const buffer=await readFile(await download.path());
 const picker=page.getByLabel('Arquivo JSON de resumos exportados');
 await picker.setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer});
 await expect(page.getByText('Arquivo consultado: 1 resumo(s) declarado(s)')).toBeVisible();
 await page.getByRole('button',{name:'Descartar consulta'}).click();
 await expect(picker).toBeFocused();
 await expect(page.getByText('Arquivo consultado: 1 resumo(s) declarado(s)')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 await picker.setInputFiles({name:'novamente.json',mimeType:'application/json',buffer});
 await expect(page.getByText('Arquivo consultado: 1 resumo(s) declarado(s)')).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('discarding an exported comparison restores the same JSON picker focus',async({page})=>{
 await savedExample(page);
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button',{name:'Exportar comparação em JSON'}).click()
 ]);
 const buffer=await readFile(await download.path());
 const picker=page.getByLabel('Arquivo JSON de resumos exportados');
 await picker.setInputFiles({name:download.suggestedFilename(),mimeType:'application/json',buffer});
 await expect(page.getByRole('region',{name:'Consulta de comparação JSON exportada'})).toBeVisible();
 await page.getByRole('button',{name:'Descartar comparação consultada'}).click();
 await expect(picker).toBeFocused();
 await expect(page.getByRole('region',{name:'Consulta de comparação JSON exportada'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 2'})).toBeVisible();
});

test('invalid JSON selection clears prior valid reviewed report without erasing session summaries',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await savedExample(page);
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button',{name:'Exportar resumo 1 em JSON'}).click()
 ]);
 const valid=await readFile(await download.path());
 const picker=page.getByLabel('Arquivo JSON de resumos exportados');
 await picker.setInputFiles({name:'valid.json',mimeType:'application/json',buffer:valid});
 await expect(page.getByText('Arquivo consultado: 1 resumo(s) declarado(s)')).toBeVisible();
 await picker.setInputFiles({
  name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{invalid json')
 });
 await expect(page.getByRole('alert')).toContainText('Arquivo incompatível ou adulterado');
 await expect(page.getByText('Arquivo consultado: 1 resumo(s) declarado(s)')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Descartar consulta'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 await picker.setInputFiles({name:'valid-again.json',mimeType:'application/json',buffer:valid});
 await expect(page.getByText('Arquivo consultado: 1 resumo(s) declarado(s)')).toBeVisible();
 await expect(page.getByRole('alert')).toHaveCount(0);
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('rejected comparison and oversized replacement never leave old comparison visible',async({page})=>{
 await savedExample(page);
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button',{name:'Exportar comparação em JSON'}).click()
 ]);
 const valid=await readFile(await download.path());
 const picker=page.getByLabel('Arquivo JSON de resumos exportados');
 const comparison=page.getByRole('region',{name:'Consulta de comparação JSON exportada'});
 await picker.setInputFiles({name:'valid-comparison.json',mimeType:'application/json',buffer:valid});
 await expect(comparison).toBeVisible();
 await picker.setInputFiles({
  name:'rejected-comparison.json',mimeType:'application/json',
  buffer:Buffer.from('{"schema":"omsi-manager-declared-comparison-v1","installationVerified":true}')
 });
 await expect(page.getByRole('alert')).toContainText('Arquivo incompatível ou adulterado');
 await expect(comparison).toHaveCount(0);
 await picker.setInputFiles({name:'valid-again.json',mimeType:'application/json',buffer:valid});
 await expect(comparison).toBeVisible();
 await picker.setInputFiles({
  name:'too-large.json',mimeType:'application/json',buffer:Buffer.alloc(131073,0x20)
 });
 await expect(page.getByRole('alert')).toContainText('Arquivo excede o limite de 128 KiB');
 await expect(comparison).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 2'})).toBeVisible();
});
