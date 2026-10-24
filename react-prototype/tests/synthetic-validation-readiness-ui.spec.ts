import {test,expect,type Page} from '@playwright/test';
async function laboratory(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 return {lab,plan:lab.getByRole('region',{name:'Requisitos para validação real futura'})};
}
test('exibe doze requisitos não avaliados sem botão de aprovação',async({page})=>{
 const {plan}=await laboratory(page);
 await expect(plan).toHaveAttribute('data-approved','false');
 await expect(plan.getByRole('heading',{name:'O que falta para validar um mod real?'})).toBeVisible();
 await expect(plan.getByTestId('synthetic-readiness-total')).toHaveText('12');
 await expect(plan.getByTestId('synthetic-readiness-completed')).toHaveText('0');
 await expect(plan.getByTestId('synthetic-readiness-unverified')).toHaveText('12');
 await expect(plan.locator('[data-requirement]')).toHaveCount(12);
 await expect(plan.locator('[data-status="not-evaluated"]')).toHaveCount(12);
 await expect(plan.getByRole('checkbox')).toHaveCount(0);
 await expect(plan.getByRole('button',{name:/aprovar|autorizar|validar requisito|instalar/i})).toHaveCount(0);
});
test('quatro etapas exibem requisitos concretos de origem, integridade, jogo e recuperação',async({page})=>{
 const {plan}=await laboratory(page);
 await expect(plan.locator('.synthetic-readiness-phase')).toHaveCount(4);
 await expect(plan.locator('[data-requirement="bounded-path-isolation"]')).toBeVisible();
 await expect(plan.locator('[data-requirement="real-cryptographic-digest"]')).toBeVisible();
 await expect(plan.locator('[data-requirement="real-game-compatibility"]')).toBeVisible();
 await expect(plan.locator('[data-requirement="backup-and-rollback"]')).toBeVisible();
 await expect(plan.locator('[data-requirement="prewrite-recheck"]')).toBeVisible();
});
test('filtro de integridade mostra apenas três itens mantendo doze não avaliados',async({page})=>{
 const {plan}=await laboratory(page);
 const select=plan.getByRole('combobox',{name:'Mostrar requisitos por etapa'});
 await select.selectOption('integrity');
 await expect(plan.locator('[data-requirement]')).toHaveCount(3);
 await expect(plan.locator('.synthetic-readiness-phase[data-phase="integrity"]')).toBeVisible();
 await expect(plan.getByTestId('synthetic-readiness-visible')).toHaveText(/3 de 12 requisitos/);
 await expect(plan.getByTestId('synthetic-readiness-completed')).toHaveText('0');
 await expect(plan.getByTestId('synthetic-readiness-unverified')).toHaveText('12');
});
test('um candidato fictício com sete relatórios não marca provas reais como prontas',async({page})=>{
 const {lab,plan}=await laboratory(page);
 await lab.getByRole('button',{name:'1. Análise inicial'}).click();
 await expect(lab.getByTestId('synthetic-evidence-reports')).toHaveText('7 de 7');
 await expect(plan.locator('[data-status="not-evaluated"]')).toHaveCount(12);
 await expect(plan.getByTestId('synthetic-readiness-completed')).toHaveText('0');
 await expect(plan).toContainText('Os relatórios fictícios da revisão 1 não concluem nenhum deles.');
});
test('filtro persiste entre cenários sem transformar pendência em aprovação',async({page})=>{
 const {lab,plan}=await laboratory(page);
 const select=plan.getByRole('combobox',{name:'Mostrar requisitos por etapa'});
 await select.selectOption('execution');
 await lab.getByRole('button',{name:'3. Áudio não analisado'}).click();
 await expect(select).toHaveValue('execution');
 await expect(plan.locator('[data-requirement]')).toHaveCount(3);
 await expect(plan.getByTestId('synthetic-readiness-completed')).toHaveText('0');
 await expect(plan.getByTestId('synthetic-readiness-unverified')).toHaveText('12');
 await expect(lab.getByTestId('synthetic-evidence-waiting')).toHaveText('1');
});
test('explicações abrem pelo teclado sem permitir marcar requisitos',async({page})=>{
 const {plan}=await laboratory(page);
 const row=plan.locator('[data-requirement="physical-windows-validation"]');
 const summary=row.getByText('Por que isso importa?');
 await summary.focus();
 await page.keyboard.press('Enter');
 await expect(row.locator('details')).toHaveAttribute('open','');
 await expect(row).toContainText('Máquina virtual de CI não substitui');
 await page.keyboard.press('Enter');
 await expect(row.locator('details')).not.toHaveAttribute('open','');
 await expect(plan.getByRole('button',{name:/aprovar|autorizar|validar requisito|instalar/i})).toHaveCount(0);
});
test('requisitos e aviso não transbordam na largura de 390, 850 e 1440 px',async({page})=>{
 const {plan}=await laboratory(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  await expect(plan).toBeVisible();
  const result=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-readiness,.synthetic-readiness-summary>div,.synthetic-readiness-phase li,.synthetic-readiness-filter select')];
   return {viewport,overflow:document.documentElement.scrollWidth-viewport,
    boxes:nodes.map(node=>{const r=node.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height}})};
  });
  expect(result.overflow).toBeLessThanOrEqual(3);
  for(const r of result.boxes){expect(r.left).toBeGreaterThanOrEqual(-3);expect(r.right).toBeLessThanOrEqual(result.viewport+3);expect(r.height).toBeGreaterThan(12);}
 }
});
test('futura lista de requisitos não habilita instalar nem cria atividade real',async({page})=>{
 const {lab,plan}=await laboratory(page);
 await plan.getByRole('combobox',{name:'Mostrar requisitos por etapa'}).selectOption('execution');
 await expect(plan.getByTestId('synthetic-readiness-guard')).toContainText('não é uma aprovação');
 await expect(plan.getByTestId('synthetic-readiness-guard')).toContainText('continuam bloqueados');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
