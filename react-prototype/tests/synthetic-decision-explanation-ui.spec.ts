import {test,expect,type Page} from '@playwright/test';
async function demo(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const root=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 return {root,decision:root.getByRole('region',{name:'Parecer sintético da revisão'})};
}
test('parecer inicial não oferece selo de aprovação e mostra motivo explícito',async({page})=>{
 const {root,decision}=await demo(page);
 await expect(decision).toHaveAttribute('data-confirmed','false');
 await expect(decision.getByRole('heading',{name:'Por que ainda não é possível confirmar?'})).toBeVisible();
 await expect(decision.getByTestId('synthetic-decision-headline')).toContainText('Revisão 3 (atual)');
 await expect(decision.getByTestId('synthetic-evidence-reports')).toHaveText('0 de 7');
 await expect(decision.getByTestId('synthetic-evidence-waiting')).toHaveText('7');
 await expect(decision.locator('[data-reason="reanalysis-pending"]')).toBeVisible();
 await expect(root.getByText(/O histórico real de atividades acima permanece vazio/)).toBeVisible();
});
test('análise inicial distingue candidato fictício de compatibilidade real',async({page})=>{
 const {root,decision}=await demo(page);
 await root.getByRole('button',{name:'1. Análise inicial'}).click();
 await expect(decision.getByTestId('synthetic-decision-headline')).toContainText('Candidato sintético');
 await expect(decision.getByTestId('synthetic-evidence-reports')).toHaveText('7 de 7');
 await expect(decision.getByTestId('synthetic-evidence-observations')).toHaveText('3');
 await expect(decision.locator('[data-reason="candidate-provisional"]')).toBeVisible();
 await expect(decision.locator('[data-reason="compatibility-unverified"]')).toBeVisible();
 await expect(decision.locator('[data-reason="installation-unverified"]')).toBeVisible();
 await expect(decision.getByText('Sem validação real')).toBeVisible();
});
test('mudança de pintura exige sete relatórios mesmo com sinais declarados',async({page})=>{
 const {root,decision}=await demo(page);
 await root.getByRole('button',{name:'2. Pintura alterada'}).click();
 await expect(decision.getByTestId('synthetic-evidence-reports')).toHaveText('0 de 7');
 await expect(decision.getByTestId('synthetic-evidence-waiting')).toHaveText('7');
 await expect(decision.locator('[data-reason="reanalysis-pending"]')).toBeVisible();
 await expect(decision.locator('[data-reason="report-missing"]')).toHaveCount(0);
});
test('relatório de áudio ausente aparece como motivo sem culpar textura',async({page})=>{
 const {root,decision}=await demo(page);
 await root.getByRole('button',{name:'3. Áudio não analisado'}).click();
 await expect(decision.getByTestId('synthetic-decision-headline')).toContainText('relatório incompleto');
 await expect(decision.getByTestId('synthetic-evidence-reports')).toHaveText('6 de 7');
 await expect(decision.getByTestId('synthetic-evidence-waiting')).toHaveText('1');
 await expect(decision.locator('[data-reason="report-missing"]')).toBeVisible();
 await decision.getByText('Consultar os sete relatórios declarados').click();
 const audio=decision.locator('.synthetic-decision-evidence li[data-module="audio"]');
 await expect(audio).toHaveAttribute('data-status','missing');
 await expect(audio).toContainText('Nenhum relatório fictício recebido');
 await expect(audio).not.toContainText('textura');
});
test('evidências dos sete especialistas podem ser expandidas pelo teclado',async({page})=>{
 const {decision}=await demo(page);
 const summary=decision.locator('.synthetic-decision-evidence summary');
 await summary.focus();
 await page.keyboard.press('Enter');
 await expect(summary.locator('..')).toHaveAttribute('open','');
 await expect(decision.locator('.synthetic-decision-evidence li')).toHaveCount(7);
 await expect(decision.locator('.synthetic-decision-evidence li[data-status="pending"]')).toHaveCount(7);
 await page.keyboard.press('Enter');
 await expect(summary.locator('..')).not.toHaveAttribute('open','');
});
test('filtros de timeline e comparação não alteram o parecer completo',async({page})=>{
 const {root,decision}=await demo(page);
 await root.getByRole('combobox',{name:'Filtrar especialistas fictícios'}).selectOption('blocked');
 await root.getByRole('combobox',{name:'Exibir orientação'}).selectOption('informational');
 await expect(root.getByTestId('synthetic-filter-count')).toContainText('0 de 21');
 await expect(decision.getByTestId('synthetic-evidence-waiting')).toHaveText('7');
 await expect(decision.locator('[data-reason="reanalysis-pending"]')).toBeVisible();
 await expect(decision.locator('[data-reason="real-bytes-unverified"]')).toBeVisible();
});
test('parecer mantém elementos dentro de 390, 850 e 1440 pixels',async({page})=>{
 const {decision}=await demo(page);
 await decision.locator('.synthetic-decision-evidence summary').click();
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  await expect(decision).toBeVisible();
  const data=await page.evaluate(()=>{
   const w=document.documentElement.clientWidth;
   const els=[...document.querySelectorAll('.synthetic-decision,.synthetic-decision-stats>div,.synthetic-decision-reasons li,.synthetic-decision-evidence li')];
   return {w,overflow:document.documentElement.scrollWidth-w,items:els.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
   })};
  });
  expect(data.overflow).toBeLessThanOrEqual(3);
  for(const item of data.items){
   expect(item.left).toBeGreaterThanOrEqual(-3);
   expect(item.right).toBeLessThanOrEqual(data.w+3);
   expect(item.height).toBeGreaterThan(12);
  }
 }
});
test('parecer não revela nomes privados, não registra atividades e não libera instalação',async({page})=>{
 const {root,decision}=await demo(page);
 await expect(decision).not.toContainText('ambient.ogg');
 await expect(decision).not.toContainText('skins/');
 await expect(decision).not.toContainText('synthetic-entry');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await expect(decision.getByText(/Instalar, editar, remover e atualizar continuam bloqueados/)).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
