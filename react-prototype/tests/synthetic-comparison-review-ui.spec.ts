import {test,expect,type Page} from '@playwright/test';
async function openDemo(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 return {lab,panel:lab.getByRole('region',{name:'Comparação fictícia de revisões'})};
}
test('orientação padrão distingue três tipos de prioridade e mantém sete cartões',async({page})=>{
 const {panel}=await openDemo(page);
 await expect(panel.getByRole('heading',{name:'Orientação de conferência'})).toBeVisible();
 await expect(panel.getByTestId('synthetic-review-counts')).toContainText('Conferir primeiro');
 await expect(panel.getByTestId('synthetic-review-counts')).toContainText('Reanalisar');
 await expect(panel.getByTestId('synthetic-review-counts')).toContainText('Informativo');
 await expect(panel.getByRole('combobox',{name:'Exibir orientação'})).toHaveValue('all');
 await expect(panel.locator('.synthetic-compare-list>li')).toHaveCount(7);
 await expect(panel.locator('.synthetic-compare-list>li[data-priority="investigate-first"]')).toHaveCount(3);
 await expect(panel.locator('.synthetic-compare-list>li[data-priority="recheck-required"]')).toHaveCount(4);
 await expect(panel.getByText(/Não medem risco, gravidade ou integridade/)).toBeVisible();
});
test('pintura alterada orienta quatro especialistas a conferir primeiro sem declarar defeitos',async({page})=>{
 const {lab,panel}=await openDemo(page);
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 await expect(panel.locator('.synthetic-compare-list>li[data-priority="investigate-first"]')).toHaveCount(4);
 await expect(panel.locator('.synthetic-compare-list>li[data-priority="recheck-required"]')).toHaveCount(3);
 await expect(panel.locator('.synthetic-compare-list>li[data-cause="declared-impact"]')).toHaveCount(4);
 await expect(panel.getByTestId('synthetic-comparison-count')).toContainText('7 de 7');
});
test('filtro de prioridade mostra quatro especialistas, sem modificar totais da revisão',async({page})=>{
 const {lab,panel}=await openDemo(page);
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 const select=panel.getByRole('combobox',{name:'Exibir orientação'});
 await select.selectOption('investigate-first');
 await expect(panel.locator('.synthetic-compare-list>li')).toHaveCount(4);
 await expect(panel.getByTestId('synthetic-review-visible')).toContainText('4 de 7');
 await expect(panel.getByTestId('synthetic-comparison-count')).toContainText('7 de 7');
 await expect(lab.locator('.synthetic-diag-timeline>li[data-current="true"] .synthetic-diag-modules>li')).toHaveCount(7);
});
test('reanálise obrigatória não se transforma em falha de segurança fictícia',async({page})=>{
 const {lab,panel}=await openDemo(page);
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 await panel.getByRole('combobox',{name:'Exibir orientação'}).selectOption('recheck-required');
 await expect(panel.locator('.synthetic-compare-list>li')).toHaveCount(3);
 await expect(panel.locator('.synthetic-compare-list>li[data-priority="investigate-first"]')).toHaveCount(0);
 await expect(panel.locator('.synthetic-compare-list>li[data-priority="recheck-required"]')).toHaveCount(3);
 await expect(panel.getByTestId('synthetic-review-visible')).toContainText('3 de 7');
});
test('estado incompleto prioriza áudio ausente e separa dois indicadores iguais',async({page})=>{
 const {lab,panel}=await openDemo(page);
 await lab.getByRole('button',{name:'3. Áudio não analisado'}).click();
 const audio=panel.locator('.synthetic-compare-list>li[data-module="audio"]');
 await expect(audio).toHaveAttribute('data-cause','missing-report');
 await expect(audio.getByText('Relatório ausente',{exact:true})).toBeVisible();
 await expect(panel.locator('.synthetic-compare-list>li[data-priority="investigate-first"]')).toHaveCount(5);
 await panel.getByRole('combobox',{name:'Exibir orientação'}).selectOption('informational');
 await expect(panel.locator('.synthetic-compare-list>li')).toHaveCount(2);
 await expect(panel.locator('.synthetic-compare-list>li[data-cause="unchanged-indicators"]')).toHaveCount(2);
 await expect(panel.getByTestId('synthetic-comparison-count')).toContainText('5 de 7');
});
test('sem correspondência exibe mensagem e nunca apaga sete estados completos',async({page})=>{
 const {lab,panel}=await openDemo(page);
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 await panel.getByRole('combobox',{name:'Exibir orientação'}).selectOption('informational');
 await expect(panel.locator('.synthetic-compare-list>li')).toHaveCount(0);
 await expect(panel.getByText(/Nenhum especialista corresponde a esta orientação/)).toBeVisible();
 await expect(panel.getByTestId('synthetic-review-visible')).toContainText('0 de 7');
 await expect(panel.getByTestId('synthetic-comparison-count')).toContainText('7 de 7');
});
test('trocar revisões mantém seleção de apresentação e orientações são recalculadas',async({page})=>{
 const {panel}=await openDemo(page);
 await panel.getByRole('combobox',{name:'Exibir orientação'}).selectOption('investigate-first');
 await panel.getByRole('combobox',{name:'Revisão anterior'}).selectOption('1');
 await panel.getByRole('combobox',{name:'Revisão posterior'}).selectOption('2');
 await expect(panel.getByRole('combobox',{name:'Exibir orientação'})).toHaveValue('investigate-first');
 await expect(panel.locator('.synthetic-compare-list>li')).toHaveCount(5);
 await expect(panel.getByTestId('synthetic-review-visible')).toContainText('5 de 7');
});
test('filtro de timeline bloqueados não altera orientações de conferência',async({page})=>{
 const {lab,panel}=await openDemo(page);
 await lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'}).selectOption('blocked');
 await expect(lab.getByTestId('synthetic-filter-count')).toContainText('0 de 21');
 await expect(panel.locator('.synthetic-compare-list>li')).toHaveCount(7);
 await expect(panel.locator('.synthetic-compare-list>li[data-priority="investigate-first"]')).toHaveCount(3);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});
test('filtro de orientação é controlável pelo teclado e acessível por rótulo',async({page})=>{
 const {panel}=await openDemo(page);
 const select=panel.getByRole('combobox',{name:'Exibir orientação'});
 await select.focus();
 await page.keyboard.press('End');
 await page.keyboard.press('Tab');
 await expect(select).toHaveValue('informational');
 await expect(panel.getByTestId('synthetic-review-visible')).toContainText('0 de 7');
});
test('orientações não geram rolagem lateral em 390, 850 ou 1440 pixels',async({page})=>{
 const {panel}=await openDemo(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:920});
  await expect(panel).toBeVisible();
  const data=await page.evaluate(()=>{
   const w=document.documentElement.clientWidth;
   const list=[...document.querySelectorAll('.synthetic-compare-review,.synthetic-compare-review-counts>div,.synthetic-compare-review select,.synthetic-compare-list>li')].map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
   });
   return {w,overflow:document.documentElement.scrollWidth-w,list};
  });
  expect(data.overflow).toBeLessThanOrEqual(3);
  for(const r of data.list){expect(r.left).toBeGreaterThanOrEqual(-3);expect(r.right).toBeLessThanOrEqual(data.w+3);expect(r.height).toBeGreaterThan(12);}
 }
});
test('após visualização de prioridades as ações reais continuam bloqueadas',async({page})=>{
 const {panel}=await openDemo(page);
 await panel.getByRole('combobox',{name:'Exibir orientação'}).selectOption('investigate-first');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
