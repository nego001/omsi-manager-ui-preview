import {test,expect} from '@playwright/test';

const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:import('@playwright/test').Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const proposed={schemaVersion:1,mods:[{
 id:'fictional',title:'Metadado proposto',game:'omsi',
 category:'Ônibus',version:'1.0',size:'2 MB',
 description:'Registro demonstrativo, não corresponde a um arquivo real'
}]};

test('preflight displays live counts for favorites, selection and stored reports without changing state',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await card(page,'Serra do Vale').getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'}).check();
 await page.getByRole('button',{name:'Analisar seleção'}).click();
 await page.getByRole('region',{name:'Resultado da análise conjunta'})
  .getByRole('button',{name:'Guardar resumo nesta sessão'}).click();
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'proposal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(proposed))
 });
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const impact=consent.getByRole('group',{name:'Dados da sessão que serão descartados'});
 await expect(impact).toContainText('Favoritos declarados: 2');
 await expect(impact).toContainText('Mods selecionados para análise conjunta: 1');
 await expect(impact).toContainText('Resumos temporários, incluindo desfazer: 1');
 await expect(impact).toContainText('Consultas externas carregadas: 0');
 await expect(impact).toContainText('o catálogo ainda não foi substituído');
 await expect(consent.getByRole('heading',{name:'Confirmar substituição do catálogo'})).toBeFocused();
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await expect(consent).toHaveCount(0);
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
 await expect(page.getByRole('checkbox',{name:'Selecionar Ônibus Urbano Clássico para análise conjunta'})).toBeChecked();
 await nav(page).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('button',{name:'Rever seleção do resumo 1'})).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('preflight count changes while pending and clearing still requires separate consent',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const urban=card(page,'Ônibus Urbano Clássico');
 await urban.getByRole('button',{name:'Favoritar'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'proposal.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(proposed))
 });
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 const impact=consent.getByRole('group',{name:'Dados da sessão que serão descartados'});
 await expect(impact).toContainText('Favoritos declarados: 1');
 await urban.getByRole('button',{name:'Retirar dos favoritos'}).click();
 await expect(impact).toContainText('Favoritos declarados: 0');
 await expect(consent.getByRole('button',{name:'Baixar lista de favoritos antes de substituir'})).toHaveCount(0);
 await expect(consent).toBeVisible();
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(page.getByRole('button',{name:'Metadado proposto',exact:true})).toBeVisible();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
