import {test,expect,type Page} from '@playwright/test';
async function laboratory(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const container=page.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const next=container.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();await next.click();
 const lifecycle=container.getByRole('region',{name:'Ciclo fictício do futuro leitor nativo'});
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 const panel=lifecycle.getByRole('region',{name:'Simulação de registro transacional'});
 await expect(panel).toBeVisible();
 return {panel,lifecycle,select:panel.getByRole('combobox',{name:'Falha a simular'})};
}
async function steps(panel:ReturnType<Page['getByRole']>,n:number){
 const next=panel.getByRole('button',{name:'Executar próxima etapa'});
 for(let i=0;i<n;i++)await next.click();
}
test('registro transacional aparece só após perda de ciclo fictício',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('region',{name:'Simulação de registro transacional'})).toHaveCount(0);
});
test('painel começa sem geração, escrita real ou arquivo válido',async({page})=>{
 const {panel}=await laboratory(page);
 await expect(panel).toHaveAttribute('data-disk-access','false');
 await expect(panel).toHaveAttribute('data-transactions-real','false');
 await expect(panel.getByTestId('synthetic-transaction-phase')).toHaveText('Sem registro confirmado');
 await expect(panel.getByTestId('synthetic-transaction-generation')).toHaveText('0');
 await expect(panel.getByTestId('synthetic-transaction-trusted')).toHaveText('0');
});
test('preparar, sinalizar intenção e confirmar exige três etapas',async({page})=>{
 const {panel}=await laboratory(page);
 await steps(panel,1);
 await expect(panel.getByTestId('synthetic-transaction-phase')).toHaveText('Rascunho preparado');
 await expect(panel.getByTestId('synthetic-transaction-generation')).toHaveText('0');
 await steps(panel,1);
 await expect(panel.getByTestId('synthetic-transaction-phase')).toHaveText('Confirmação pendente');
 await steps(panel,1);
 await expect(panel.getByTestId('synthetic-transaction-phase')).toHaveText('Registro fictício anotado');
 await expect(panel.getByTestId('synthetic-transaction-generation')).toHaveText('1');
 await expect(panel.getByTestId('synthetic-transaction-untrusted')).toContainText('não estão comprovadas');
 await expect(panel.getByRole('button',{name:'Executar próxima etapa'})).toBeDisabled();
});
test('queda antes da intenção descarta preparação e não aumenta geração',async({page})=>{
 const {panel,select}=await laboratory(page);
 await select.selectOption('before-intent');
 await steps(panel,3);
 await expect(panel.getByTestId('synthetic-transaction-phase')).toHaveText('Sem registro confirmado');
 await expect(panel.getByTestId('synthetic-transaction-recovery')).toHaveText('Preparação descartada');
 await expect(panel.getByTestId('synthetic-transaction-discarded')).toBeVisible();
 await expect(panel.getByTestId('synthetic-transaction-generation')).toHaveText('0');
});
test('queda durante confirmação descarta intenção não confirmada',async({page})=>{
 const {panel,select}=await laboratory(page);
 await select.selectOption('during-intent');
 await steps(panel,4);
 await expect(panel.getByTestId('synthetic-transaction-recovery')).toHaveText('Intenção incompleta descartada');
 await expect(panel.getByTestId('synthetic-transaction-discarded')).toBeVisible();
 await expect(panel.getByTestId('synthetic-transaction-trusted')).toHaveText('0');
});
test('queda após confirmação mantém resumo fictício e obriga nova análise',async({page})=>{
 const {panel,select}=await laboratory(page);
 await select.selectOption('after-commit');
 await steps(panel,5);
 await expect(panel.getByTestId('synthetic-transaction-phase')).toHaveText('Registro fictício anotado');
 await expect(panel.getByTestId('synthetic-transaction-recovery')).toContainText('sem confiança');
 await expect(panel.getByTestId('synthetic-transaction-generation')).toHaveText('1');
 await expect(panel.getByTestId('synthetic-transaction-trusted')).toHaveText('0');
});
test('token repetido e revisão antiga geram bloqueios independentes',async({page})=>{
 const {panel,select}=await laboratory(page);
 for(const mode of ['replay','stale'] as const){
  await select.selectOption(mode);
  await steps(panel,4);
  await expect(panel.getByTestId('synthetic-transaction-rejected')).toBeVisible();
  await expect(panel.getByTestId('synthetic-transaction-generation')).toHaveText('1');
 }
});
test('rascunho falso é rejeitado antes de qualquer geração',async({page})=>{
 const {panel,select}=await laboratory(page);
 await select.selectOption('fake');
 await steps(panel,1);
 await expect(panel.getByTestId('synthetic-transaction-rejected')).toContainText('não emitido');
 await expect(panel.getByTestId('synthetic-transaction-phase')).toHaveText('Sem registro confirmado');
});
test('reiniciar cenário apaga apenas transições fictícias',async({page})=>{
 const {panel,select}=await laboratory(page);
 await steps(panel,2);
 await panel.getByRole('button',{name:'Reiniciar teste transacional'}).click();
 await expect(panel.getByTestId('synthetic-transaction-progress')).toHaveText('Etapas simuladas: 0 de 3');
 await select.selectOption('during-intent');
 await expect(panel.getByTestId('synthetic-transaction-generation')).toHaveText('0');
});
test('simulação pode ser comandada por teclado sem abrir seletor de arquivos',async({page})=>{
 const {panel,select}=await laboratory(page);
 await select.focus();await page.keyboard.press('Home');await page.keyboard.press('Tab');
 await expect(panel.getByRole('button',{name:'Executar próxima etapa'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(panel.getByTestId('synthetic-transaction-phase')).toHaveText('Rascunho preparado');
 await expect(panel).not.toContainText('def/fake.sii');
});
test('painel transacional não transborda em 390, 850 e 1440 px',async({page})=>{
 const {panel}=await laboratory(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  await expect(panel).toBeVisible();
  const m=await page.evaluate(()=>{
   const width=document.documentElement.clientWidth;
   const els=[...document.querySelectorAll('.synthetic-transaction,.synthetic-transaction-metrics>div,.synthetic-transaction-actions button,.synthetic-transaction>label select')];
   return {width,overflow:document.documentElement.scrollWidth-width,
    boxes:els.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height}})};
  });
  expect(m.overflow).toBeLessThanOrEqual(3);
  for(const b of m.boxes){expect(b.left).toBeGreaterThanOrEqual(-3);expect(b.right).toBeLessThanOrEqual(m.width+3);expect(b.height).toBeGreaterThan(12);}
 }
});
test('nenhuma confirmação fictícia gera atividade real ou ativa mod instalável',async({page})=>{
 const {panel}=await laboratory(page);
 await steps(panel,3);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
