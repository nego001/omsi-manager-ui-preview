import {test,expect} from '@playwright/test';
const nav=(page:import('@playwright/test').Page)=>
 page.getByRole('navigation',{name:'Navegação principal'});

test('atalhos dos Detalhes preservam contexto e movem foco entre seções a 390px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const card=page.locator('.mod-card')
  .filter({has:page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await nav(page).getByRole('button',{name:'Minha biblioteca'}).click();
 await card.getByRole('button',{name:'Ver Ônibus Urbano Clássico'}).click();
 const shortcuts=page.getByRole('navigation',{name:'Atalhos dos detalhes do mod'});
 const checks=page.getByRole('region',{name:'Etapas de verificação do mod'});
 const relations=page.locator('#relacoes-declaradas');
 const incoming=page.locator('#relacoes-recebidas');
 await expect(shortcuts.getByRole('button')).toHaveCount(3);
 await shortcuts.getByRole('button',{name:'Estado da análise'}).click();
 await expect(checks).toBeFocused();
 await shortcuts.getByRole('button',{name:'Dependências e conflitos'}).click();
 await expect(relations).toBeFocused();
 await shortcuts.getByRole('button',{name:'Referências recebidas'}).click();
 await expect(incoming).toBeFocused();
 await expect(page.getByText('Compatibilidade não verificada').first()).toBeVisible();
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
});

test('contagens nos atalhos seguem o mod selecionado e só descrevem o JSON',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const base={game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',
  description:'Dados de teste estritamente declarativos'};
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'duas-referencias.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:[
   {...base,id:'example-bus',title:'Ônibus A',requires:['missing']},
   {...base,id:'example-ref',title:'Ônibus B',
    requires:['example-bus'],conflictsWith:['example-bus']}
  ]}))
 });
 const bus=page.locator('.mod-card').filter({
  has:page.getByRole('button',{name:'Ônibus A',exact:true})
 });
 await bus.getByRole('button',{name:'Ver Ônibus A'}).click();
 const shortcuts=page.getByRole('navigation',{name:'Atalhos dos detalhes do mod'});
 await expect(shortcuts.getByRole('button',{name:/Referências recebidas/}))
  .toContainText('1 registro(s) que mencionam este ID (JSON)');
 await expect(shortcuts.getByRole('button',{name:/Referências recebidas/}))
  .toContainText('Dependências: 1 · Conflitos: 1');
 await expect(shortcuts.getByRole('button',{name:/Dependências e conflitos/}))
  .toContainText(/Bloqueios: \d+ · Avisos: \d+ \(JSON\)/);
 await shortcuts.getByRole('button',{name:/Referências recebidas/}).click();
 await expect(page.locator('#relacoes-recebidas')).toBeFocused();
 await page.getByRole('button',{name:'Próximo mod: Ônibus B'}).click();
 await expect(shortcuts.getByRole('button',{name:/Referências recebidas/}))
  .toContainText('0 registro(s) que mencionam este ID (JSON)');
 await expect(shortcuts.getByRole('button',{name:/Referências recebidas/}))
  .toContainText('Dependências: 0 · Conflitos: 0');
 await expect(shortcuts.getByRole('button',{name:/Dependências e conflitos/}))
  .toContainText(/Bloqueios: \d+ · Avisos: \d+ \(JSON\)/);
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('filtro de referências altera apenas a lista visível e reinicia ao mudar mod',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const base={game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',
  description:'Exemplo fictício somente de metadados'};
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'filtro-referencias.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:[
   {...base,id:'target',title:'Destino fictício'},
   {...base,id:'source',title:'Origem fictícia',
    requires:['target'],conflictsWith:['target']}
  ]}))
 });
 await page.getByRole('button',{name:'Ver Destino fictício'}).click();
 const incoming=page.locator('#relacoes-recebidas');
 const filter=incoming.getByRole('combobox',{name:'Filtrar tipo de referência recebida'});
 const shortcuts=page.getByRole('navigation',{name:'Atalhos dos detalhes do mod'});
 await expect(filter).toHaveValue('all');
 await expect(incoming.getByRole('combobox',{name:'Filtrar origem das referências recebidas'}))
  .toBeDisabled();
 await expect(incoming.getByRole('status')).toContainText('Exibindo 2 de 2');
 await expect(incoming.locator('.relation-incoming-groups li')).toHaveCount(2);
 await filter.selectOption('requires');
 await expect(incoming.getByRole('status')).toContainText('Exibindo 1 de 2');
 await expect(incoming.locator('.relation-incoming-groups li')).toHaveCount(1);
 await expect(incoming).toContainText('Declara dependência direta deste ID (1)');
 await expect(incoming).not.toContainText('Outros registros que declaram conflito');
 await expect(shortcuts.getByRole('button',{name:/Referências recebidas/}))
  .toContainText('Dependências: 1 · Conflitos: 1');
 await filter.selectOption('conflicts');
 await expect(incoming.locator('.relation-incoming-groups li')).toHaveCount(1);
 await expect(incoming).toContainText('Outros registros que declaram conflito com este ID (1)');
 await expect(incoming).not.toContainText('Declara dependência direta deste ID');
 await page.getByRole('button',{name:'Próximo mod: Origem fictícia'}).click();
 await expect(page.getByRole('heading',{name:'Origem fictícia',exact:true})).toBeFocused();
 await expect(filter).toHaveCount(0);
 await expect(incoming).toContainText('Nenhuma referência recebida nesses campos do catálogo.');
 await page.getByRole('button',{name:'Mod anterior: Destino fictício'}).click();
 await expect(filter).toHaveValue('all');
 await expect(incoming.locator('.relation-incoming-groups li')).toHaveCount(2);
 await filter.selectOption('requires');
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await page.getByRole('button',{name:'Ver Destino fictício'}).click();
 await expect(filter).toHaveValue('all');
 await expect(incoming.locator('.relation-incoming-groups li')).toHaveCount(2);
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('filtro de outro simulador combina com tipo sem duplicar referências ou alterar metadados',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 await nav(page).getByRole('button',{name:'Catálogo de mods'}).click();
 const base={game:'omsi',category:'Ônibus',version:'1.0',size:'1 MB',
  description:'Somente dados fictícios para visualização de relações'};
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'referencias-entre-simuladores.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods:[
   {...base,id:'target',title:'Destino OMSI'},
   {...base,id:'same-source',title:'Origem OMSI',
    requires:['target'],conflictsWith:['target']},
   {...base,id:'ets-source',title:'Origem ETS2',game:'ets2',
    category:'Caminhões',requires:['target']},
   {...base,id:'ats-source',title:'Origem ATS',game:'ats',
    category:'Caminhões',conflictsWith:['target']}
  ]}))
 });
 await page.getByRole('button',{name:'Ver Destino OMSI'}).click();
 const incoming=page.locator('#relacoes-recebidas');
 const type=incoming.getByRole('combobox',{name:'Filtrar tipo de referência recebida'});
 const origin=incoming.getByRole('combobox',{name:'Filtrar origem das referências recebidas'});
 const status=incoming.locator('.relation-incoming-filter [role="status"]');
 const items=incoming.locator('.relation-incoming-groups li');
 const shortcut=page.getByRole('navigation',{name:'Atalhos dos detalhes do mod'})
  .getByRole('button',{name:/Referências recebidas/});
 await expect(type).toHaveValue('all');
 await expect(origin).toHaveValue('all');
 await expect(status).toContainText('Exibindo 4 de 4');
 await expect(items).toHaveCount(4);
 await expect(shortcut).toContainText('3 registro(s) que mencionam este ID (JSON)');
 await expect(shortcut).toContainText('Dependências: 2 · Conflitos: 2');
 await origin.selectOption('same-game');
 await expect(status).toContainText('Exibindo 2 de 4');
 await expect(items).toHaveCount(2);
 await expect(items.first()).toContainText('Origem OMSI');
 await expect(items.last()).toContainText('Origem OMSI');
 await expect(incoming.locator('.relation-incoming-groups')).not.toContainText('Origem ETS2');
 await expect(incoming.locator('.relation-incoming-groups')).not.toContainText('Origem ATS');
 await type.selectOption('requires');
 await expect(status).toContainText('Exibindo 1 de 4');
 await expect(items.first()).toContainText('Origem OMSI');
 await type.selectOption('all');
 await origin.selectOption('cross-game');
 await expect(status).toContainText('Exibindo 2 de 4');
 await expect(items).toHaveCount(2);
 await expect(incoming.locator('.relation-cross-game-summary'))
  .toContainText('2 referência(s) diretas recebidas de outros simuladores');
 await expect(items).not.toContainText('Origem OMSI');
 await type.selectOption('requires');
 await expect(status).toContainText('Exibindo 1 de 4');
 await expect(items).toHaveCount(1);
 await expect(items.first()).toContainText('Origem ETS2');
 await type.selectOption('conflicts');
 await expect(status).toContainText('Exibindo 1 de 4');
 await expect(items.first()).toContainText('Origem ATS');
 await origin.selectOption('all');
 await expect(status).toContainText('Exibindo 2 de 4');
 await expect(items).toHaveCount(2);
 await expect(shortcut).toContainText('Dependências: 2 · Conflitos: 2');
 await page.getByRole('button',{name:'Próximo mod: Origem OMSI'}).click();
 await expect(page.getByRole('heading',{name:'Origem OMSI',exact:true})).toBeFocused();
 await expect(origin).toHaveCount(0);
 await page.getByRole('button',{name:'Mod anterior: Destino OMSI'}).click();
 await expect(type).toHaveValue('all');
 await expect(origin).toHaveValue('all');
 await expect(items).toHaveCount(4);
 const overflow=await page.evaluate(()=>
  Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
