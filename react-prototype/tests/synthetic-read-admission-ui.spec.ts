import {test,expect,type Page} from '@playwright/test';
async function panel(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const root=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const readiness=root.getByRole('region',{name:'Requisitos para validação real futura'});
 return {root,readiness,admission:readiness.getByRole('region',{name:'Simulação de bloqueio de leitura'})};
}
test('cenário plausível continua bloqueado, sem bytes lidos ou botão de autorizar',async({page})=>{
 const {admission,readiness}=await panel(page);
 await expect(admission).toHaveAttribute('data-access','denied');
 await expect(admission.getByTestId('synthetic-admission-state')).toHaveText('Bloqueado');
 await expect(admission.getByTestId('synthetic-admission-bytes')).toHaveText('0');
 await expect(admission.getByTestId('synthetic-admission-count')).toHaveText('3');
 await expect(admission.locator('[data-reason="missing-native-consent"]')).toBeVisible();
 await expect(admission.locator('[data-reason="missing-native-confinement"]')).toBeVisible();
 await expect(admission.locator('[data-reason="no-reader-backend"]')).toBeVisible();
 await expect(admission.getByRole('button')).toHaveCount(0);
 await expect(readiness.getByTestId('synthetic-readiness-completed')).toHaveText('0');
});
test('ausência de consentimento acrescenta bloqueio explícito sem conceder acesso',async({page})=>{
 const {admission}=await panel(page);
 await admission.getByRole('combobox',{name:'Cenário de contrato'}).selectOption('missing-consent');
 await expect(admission.locator('[data-reason="no-consent"]')).toBeVisible();
 await expect(admission.getByTestId('synthetic-admission-count')).toHaveText('4');
 await expect(admission.getByTestId('synthetic-admission-bytes')).toHaveText('0');
});
test('escopo amplo também é escrita e continua bloqueado',async({page})=>{
 const {admission}=await panel(page);
 await admission.getByRole('combobox',{name:'Cenário de contrato'}).selectOption('broader-scope');
 await expect(admission.locator('[data-reason="broad-scope"]')).toBeVisible();
 await expect(admission.locator('[data-reason="write-or-execute"]')).toBeVisible();
 await expect(admission.getByTestId('synthetic-admission-state')).toHaveText('Bloqueado');
});
test('travessia de caminho e links são reconhecidos como duas violações distintas',async({page})=>{
 const {admission}=await panel(page);
 await admission.getByRole('combobox',{name:'Cenário de contrato'}).selectOption('unsafe-path');
 await expect(admission.locator('[data-reason="traversal-indicated"]')).toBeVisible();
 await expect(admission.locator('[data-reason="unsafe-links"]')).toBeVisible();
 await expect(admission).not.toContainText('C:\\');
 await expect(admission.getByTestId('synthetic-admission-bytes')).toHaveText('0');
});
test('orçamentos excedidos e cancelamento são estados fechados separados',async({page})=>{
 const {admission}=await panel(page);
 const select=admission.getByRole('combobox',{name:'Cenário de contrato'});
 await select.selectOption('exceeds-limits');
 await expect(admission.locator('[data-reason="resource-limit"]')).toBeVisible();
 await select.selectOption('cancelled');
 await expect(admission.locator('[data-reason="cancelled"]')).toBeVisible();
 await expect(admission.locator('[data-reason="revoked-consent"]')).toBeVisible();
});
test('revisão antiga não é aceita como consentimento válido',async({page})=>{
 const {admission}=await panel(page);
 await admission.getByRole('combobox',{name:'Cenário de contrato'}).selectOption('stale');
 await expect(admission.locator('[data-reason="stale-revision"]')).toBeVisible();
 await expect(admission.getByTestId('synthetic-admission-state')).toHaveText('Bloqueado');
});
test('troca de estágio não substitui evidências nem gera permissão',async({page})=>{
 const {root,readiness,admission}=await panel(page);
 const select=admission.getByRole('combobox',{name:'Cenário de contrato'});
 await select.selectOption('missing-consent');
 await root.getByRole('button',{name:'1. Análise inicial'}).click();
 await expect(select).toHaveValue('missing-consent');
 await expect(admission.locator('[data-reason="no-consent"]')).toBeVisible();
 await expect(admission.getByTestId('synthetic-admission-bytes')).toHaveText('0');
 await expect(readiness.getByTestId('synthetic-readiness-unverified')).toHaveText('12');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});
test('seletor de cenário funciona por teclado sem interagir com arquivos',async({page})=>{
 const {admission}=await panel(page);
 const select=admission.getByRole('combobox',{name:'Cenário de contrato'});
 await select.focus();
 await page.keyboard.press('End');
 await page.keyboard.press('Tab');
 await expect(select).toHaveValue('stale');
 await expect(admission.getByTestId('synthetic-admission-state')).toHaveText('Bloqueado');
});
test('nenhum cartão de admissão transborda em 390, 850 e 1440 pixels',async({page})=>{
 const {admission}=await panel(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  await expect(admission).toBeVisible();
  const data=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-admission,.synthetic-admission-stats>div,.synthetic-admission-reasons li,.synthetic-admission>label select')];
   return {viewport,overflow:document.documentElement.scrollWidth-viewport,rects:nodes.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
   })};
  });
  expect(data.overflow).toBeLessThanOrEqual(3);
  for(const r of data.rects){
   expect(r.left).toBeGreaterThanOrEqual(-3);
   expect(r.right).toBeLessThanOrEqual(data.viewport+3);
   expect(r.height).toBeGreaterThan(12);
  }
 }
});
test('após simular todos os bloqueios o instalador e remoção permanecem desabilitados',async({page})=>{
 const {admission}=await panel(page);
 await admission.getByRole('combobox',{name:'Cenário de contrato'}).selectOption('conservative');
 await expect(admission.getByTestId('synthetic-admission-state')).toHaveText('Bloqueado');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
