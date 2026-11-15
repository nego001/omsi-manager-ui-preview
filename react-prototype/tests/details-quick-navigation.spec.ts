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
