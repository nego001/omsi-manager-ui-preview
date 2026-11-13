import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const proposed={schemaVersion:1,mods:[{
 id:'preflight-only',title:'Novo registro declarativo',game:'omsi',
 category:'Ônibus',version:'1.0',size:'1 MB',
 description:'Metadado sintético, não é um mod instalado'
}]};
async function createReport(page:import('@playwright/test').Page){
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
}
async function propose(page:import('@playwright/test').Page){
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'new-catalog.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify(proposed))
 });
 return page.getByRole('region',{name:'Confirmar substituição do catálogo'});
}
test('prévia exporta todos os resumos ativos sem confirmar nem remover os dados',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await createReport(page);
 const consent=await propose(page);
 await expect(consent).toBeVisible();
 await expect(consent).toContainText('Resumos temporários, incluindo desfazer: 1');
 await expect(consent.getByRole('button',{name:'Baixar último resumo removido antes de substituir'})).toHaveCount(0);
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  consent.getByRole('button',{name:'Baixar resumos da sessão antes de substituir'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Resumos-da-sessao.json');
 const data=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(data).toMatchObject({
  schema:'omsi-manager-declared-session-archive-v1',
  reportCount:1,scope:'catalog-metadata-only',source:'session-memory',
  installationVerified:false,compatibilityVerified:false,
  reports:[{reportId:1,selectedCount:1,installationVerified:false,
   compatibilityVerified:false,selectedMods:[{id:'omsi-bus',title:'Ônibus Urbano Clássico'}]}]
 });
 await expect(consent).toBeVisible();
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('prévia permite salvar separadamente o último resumo removido antes da perda consentida',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await createReport(page);
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await page.getByRole('button',{name:'Excluir resumo 1 desta sessão'}).click();
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toBeVisible();
 const consent=await propose(page);
 await expect(consent).toContainText('Resumos temporários, incluindo desfazer: 1');
 await expect(consent.getByRole('button',{name:'Baixar resumos da sessão antes de substituir'})).toHaveCount(0);
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  consent.getByRole('button',{name:'Baixar último resumo removido antes de substituir'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Resumo-1.json');
 const data=JSON.parse(await readFile(await download.path(),'utf8'));
 expect(data).toMatchObject({
  schema:'omsi-manager-declared-session-report-v1',
  reportId:1,selectedCount:1,scope:'catalog-metadata-only',
  installationVerified:false,compatibilityVerified:false,
  selectedMods:[{id:'omsi-bus',title:'Ônibus Urbano Clássico'}]
 });
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(page.getByRole('button',{name:'Novo registro declarativo',exact:true})).toBeVisible();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('button',{name:'Desfazer exclusão do último resumo'})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toHaveCount(0);
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
