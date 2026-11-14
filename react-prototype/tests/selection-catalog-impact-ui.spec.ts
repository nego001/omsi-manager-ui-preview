import {test,expect} from '@playwright/test';
type Page=import('@playwright/test').Page;
const nav=(page:Page)=>page.getByRole('navigation',{name:'Navegação principal'});
const card=(page:Page,title:string)=>
 page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
const demo=[
 {id:'omsi-bus',title:'Ônibus Urbano Clássico',game:'omsi',category:'Ônibus',
 version:'1.0',description:'Veículo fictício usado apenas para validar o catálogo e os estados da interface.',size:'240 MB'},
 {id:'omsi-map',title:'Serra do Vale',game:'omsi',category:'Mapas',
 version:'0.9',description:'Mapa de demonstração. Nenhum arquivo real do jogo é acessado.',size:'1,2 GB'},
 {id:'omsi-sound',title:'Pacote de Sons',game:'omsi',category:'Sons',
 version:'1.1',description:'Prévia de um pacote de áudio fictício para os cartões.',size:'96 MB'}
];
const proposal=(page:Page,entries:object[],name='proposta.json')=>
 page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name,mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:entries}))
 });
async function selectFavorites(page:Page,titles:string[]){
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of titles)await card(page,title).getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 for(const title of titles)
  await page.getByRole('checkbox',{name:'Selecionar '+title+' para análise conjunta'}).check();
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
}
test('seleção mostra impactos alterado/ausente/igual sem aplicar catálogo a 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const titles=['Ônibus Urbano Clássico','Serra do Vale','Pacote de Sons'];
 await selectFavorites(page,titles);
 await proposal(page,[{...demo[0],version:'9.0'},demo[1]]);
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent.getByText('Ver impacto da seleção ativa (3)')).toBeVisible();
 await consent.locator('summary').filter({hasText:'Ver impacto da seleção ativa'}).click();
 const group=consent.getByRole('group',{name:'Impacto da proposta na seleção ativa'});
 await expect(group).toContainText('Mesmo ID e dados iguais: 1');
 await expect(group).toContainText('Mesmo ID com dados alterados: 1');
 await expect(group).toContainText('Selecionados ausentes na proposta: 1');
 await expect(group).toContainText('Ônibus Urbano Clássico');
 await expect(group).toContainText('Serra do Vale');
 await expect(group).toContainText('Pacote de Sons');
 await expect(group).toContainText('Toda a seleção ativa (3 mods) será descartada');
 await consent.getByRole('button',{name:'Cancelar substituição do catálogo'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 for(const title of titles)
  await expect(page.getByRole('checkbox',{name:'Selecionar '+title+' para análise conjunta'})).toBeChecked();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
test('trocar proposta recalcula a seleção, confirmação descarta mesmo IDs iguais',async({page})=>{
 await page.goto('/');
 await selectFavorites(page,['Ônibus Urbano Clássico','Serra do Vale']);
 await proposal(page,[{...demo[0],version:'9.0'}],'first.json');
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await consent.locator('summary').filter({hasText:'Ver impacto da seleção ativa'}).click();
 const group=consent.getByRole('group',{name:'Impacto da proposta na seleção ativa'});
 await expect(group).toContainText('Mesmo ID com dados alterados: 1');
 await expect(group).toContainText('Selecionados ausentes na proposta: 1');
 await proposal(page,[demo[0],demo[1]],'second.json');
 // New file choice unmounts the old consent prompt until File.text resolves.
 // Reopen the deliberately collapsed details panel for the new proposal.
 await expect(consent.getByRole('group',{name:'Comparação declarativa entre catálogos'}))
  .toContainText('ID mantido com metadados alterados: 0');
 await consent.locator('summary').filter({hasText:'Ver impacto da seleção ativa'}).click();
 await expect(group).toContainText('Mesmo ID e dados iguais: 2');
 await expect(group).toContainText('Mesmo ID com dados alterados: 0');
 await expect(group).toContainText('Selecionados ausentes na proposta: 0');
 await consent.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('heading',{name:'Biblioteca vazia'})).toBeVisible();
});
test('sem seleção ativa não polui a confirmação com seção vazia',async({page})=>{
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 await card(page,'Ônibus Urbano Clássico').getByRole('button',{name:'Favoritar'}).click();
 await proposal(page,[demo[0]]);
 const consent=page.getByRole('region',{name:'Confirmar substituição do catálogo'});
 await expect(consent).toBeVisible();
 await expect(consent.getByText(/Ver impacto da seleção ativa/)).toHaveCount(0);
 await expect(consent.getByRole('group',{name:'Impacto da proposta nos favoritos'})).toBeVisible();
});
