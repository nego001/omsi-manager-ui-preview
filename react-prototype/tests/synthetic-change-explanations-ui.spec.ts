import {test,expect,type Page} from '@playwright/test';
async function lab(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const root=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const panel=root.getByRole('region',{name:'Comparação fictícia de revisões'});
 return {root,panel,story:panel.getByRole('region',{name:'Relações declaradas entre mudanças e especialistas'})};
}
test('terceira revisão explica OGG sem criar causa real ou vazamento de path',async({page})=>{
 const {story}=await lab(page);
 await expect(story.getByRole('heading',{name:'O que pode estar relacionado às mudanças?'})).toBeVisible();
 await expect(story.locator('.synthetic-declaration-link-list>li')).toHaveCount(1);
 const ogg=story.locator('.synthetic-declaration-link-list>li[data-suffix="ogg"]');
 await expect(ogg).toContainText('Formato .OGG');
 await expect(ogg.locator('ul>li')).toHaveText(['Estrutura','Definições','Áudio']);
 await expect(story.getByTestId('synthetic-declaration-counts')).toContainText('Incluídas: 1');
 await expect(story.getByTestId('synthetic-causation-guard')).toContainText('não uma causa comprovada');
 await expect(story).not.toContainText('ambient.ogg');
});
test('pintura alterada aponta DDS para estrutura, definições, recursos e imagens',async({page})=>{
 const {root,story}=await lab(page);
 await root.getByRole('button',{name:'2. Pintura alterada'}).click();
 const dds=story.locator('.synthetic-declaration-link-list>li[data-suffix="dds"]');
 await expect(dds).toHaveCount(1);
 await expect(dds.locator('ul>li')).toHaveText(['Estrutura','Definições','Recursos','Imagens']);
 await expect(story.getByTestId('synthetic-declaration-counts')).toContainText('Retiradas: 0');
 await expect(story).not.toContainText('paint.dds');
});
test('reanálise incompleta mantém alteração DDS, sem afirmar que áudio ausente foi causado por textura',async({page})=>{
 const {root,panel,story}=await lab(page);
 await root.getByRole('button',{name:'3. Áudio não analisado'}).click();
 await expect(story.locator('.synthetic-declaration-link-list>li[data-suffix="dds"]')).toHaveCount(1);
 await expect(story.locator('.synthetic-declaration-link-list>li[data-suffix="ogg"]')).toHaveCount(0);
 await expect(panel.locator('.synthetic-compare-list>li[data-module="audio"]')).toHaveAttribute('data-cause','missing-report');
 await expect(story.getByTestId('synthetic-causation-guard')).toContainText('Todos os sete especialistas');
});
test('comparação não consecutiva lista DDS e OGG mas não expõe nomes de arquivos',async({page})=>{
 const {panel,story}=await lab(page);
 await panel.getByRole('combobox',{name:'Revisão anterior'}).selectOption('1');
 await expect(story.locator('.synthetic-declaration-link-list>li')).toHaveCount(2);
 await expect(story.locator('.synthetic-declaration-link-list>li[data-suffix="dds"]')).toHaveCount(1);
 await expect(story.locator('.synthetic-declaration-link-list>li[data-suffix="ogg"]')).toHaveCount(1);
 await expect(story.getByTestId('synthetic-declaration-counts')).toContainText('Incluídas: 2');
 await expect(story).not.toContainText('skins/');
 await expect(story).not.toContainText('audio/');
});
test('filtros de timeline e orientação não alteram explicações declaradas da revisão',async({page})=>{
 const {root,panel,story}=await lab(page);
 await root.getByRole('combobox',{name:'Filtrar especialistas fictícios'}).selectOption('blocked');
 await panel.getByRole('combobox',{name:'Exibir orientação'}).selectOption('informational');
 await expect(root.getByTestId('synthetic-filter-count')).toContainText('0 de 21');
 await expect(panel.getByTestId('synthetic-review-visible')).toContainText('0 de 7');
 await expect(story.locator('.synthetic-declaration-link-list>li')).toHaveCount(1);
 await expect(story.locator('.synthetic-declaration-link-list>li[data-suffix="ogg"]')).toHaveCount(1);
});
test('somente uma revisão não apresenta falsa explicação de diferenças',async({page})=>{
 const {root,panel}=await lab(page);
 await root.getByRole('button',{name:'1. Análise inicial'}).click();
 await expect(panel.getByRole('region',{name:'Relações declaradas entre mudanças e especialistas'})).toHaveCount(0);
 await expect(panel.getByText('Apenas uma revisão disponível neste cenário.',{exact:false})).toBeVisible();
});
test('rótulos das relações não afirmam causalidade e não autorizam operações reais',async({page})=>{
 const {story}=await lab(page);
 await expect(story.getByTestId('synthetic-causation-guard')).toContainText('Nenhum byte real foi analisado');
 await expect(story).toContainText('Especialistas potencialmente envolvidos');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('bloco das relações mantém largura em 390, 850 e 1440 pixels',async({page})=>{
 const {story}=await lab(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  await expect(story).toBeVisible();
  const info=await page.evaluate(()=>{
   const width=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-declaration-links,.synthetic-declaration-link-list>li,.synthetic-declaration-links-total,.synthetic-declaration-link-list ul li')];
   return {width,overflow:document.documentElement.scrollWidth-width,rects:nodes.map(n=>{const r=n.getBoundingClientRect();return [r.left,r.right,r.height];})};
  });
  expect(info.overflow).toBeLessThanOrEqual(3);
  for(const [left,right,height] of info.rects){
   expect(left).toBeGreaterThanOrEqual(-3);expect(right).toBeLessThanOrEqual(info.width+3);expect(height).toBeGreaterThan(12);
  }
 }
});
