import {test,expect,type Page} from '@playwright/test';
async function laboratory(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const container=lab.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const next=container.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();await next.click();
 const lifecycle=container.getByRole('region',{name:'Ciclo fictício do futuro leitor nativo'});
 const recovery=lifecycle.getByRole('region',{name:'Recuperação fictícia de sessão abandonada'});
 const audit=lifecycle.getByRole('region',{name:'Registro sequencial fictício da recuperação'});
 return {lab,lifecycle,recovery,audit};
}
async function orphan(page:Page){
 const c=await laboratory(page);
 await c.lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await c.lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await c.lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await expect(c.audit).toBeVisible();
 return c;
}
test('registro não aparece antes de uma perda de processo no laboratório',async({page})=>{
 const {lifecycle,audit}=await laboratory(page);
 await expect(audit).toHaveCount(0);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await expect(audit).toHaveCount(0);
});
test('perda cria dois eventos em ordem e invalida revisão antiga',async({page})=>{
 const {audit}=await orphan(page);
 await expect(audit).toHaveAttribute('data-persistent','false');
 await expect(audit).toHaveAttribute('data-verified','false');
 await expect(audit.getByTestId('synthetic-audit-count')).toHaveText('2');
 await expect(audit.getByTestId('synthetic-audit-old')).toHaveText('1 · Substituída');
 await expect(audit.getByTestId('synthetic-audit-new')).toHaveText('Pendente');
 await expect(audit.locator('[data-event]')).toHaveCount(2);
 await expect(audit.locator('[data-sequence="1"]')).toHaveAttribute('data-event','orphan-detected');
 await expect(audit.locator('[data-sequence="2"]')).toHaveAttribute('data-event','old-evidence-invalidated');
});
test('reconhecimento acrescenta evento sem restaurar a revisão invalidada',async({page})=>{
 const {audit,recovery}=await orphan(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await expect(audit.getByTestId('synthetic-audit-count')).toHaveText('3');
 await expect(audit.locator('[data-sequence="3"]')).toHaveAttribute('data-event','orphan-acknowledged');
 await expect(audit.getByTestId('synthetic-audit-reusable')).toHaveText('0');
});
test('tentativa de replay recusada aparece depois do reconhecimento na sequência',async({page})=>{
 const {audit,recovery}=await orphan(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await recovery.getByRole('button',{name:'Testar reutilização da sessão antiga'}).click();
 await expect(audit.getByTestId('synthetic-audit-count')).toHaveText('4');
 await expect(audit.locator('[data-sequence="4"]')).toHaveAttribute('data-event','old-evidence-rejected');
 await expect(audit.getByTestId('synthetic-audit-new')).toHaveText('Pendente');
});
test('nova triagem inventada ganha revisão declarativa 2, nunca confirmação real',async({page})=>{
 const {audit,recovery}=await orphan(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await recovery.getByRole('button',{name:'Testar reutilização da sessão antiga'}).click();
 await recovery.getByRole('button',{name:'Executar nova triagem independente fictícia'}).click();
 await expect(audit.getByTestId('synthetic-audit-count')).toHaveText('5');
 await expect(audit.getByTestId('synthetic-audit-new')).toHaveText('2 · Fictícia');
 await expect(audit.locator('[data-sequence="5"]')).toHaveAttribute('data-event','new-evidence-recorded');
 await expect(audit.getByTestId('synthetic-audit-reusable')).toHaveText('0');
 await expect(audit.getByTestId('synthetic-audit-notice')).toContainText('não é uma auditoria criptográfica');
});
test('reconhecimento pelo ciclo principal também aparece como evento no registro',async({page})=>{
 const {audit,lifecycle}=await orphan(page);
 await lifecycle.getByRole('button',{name:'Reconhecer sessão abandonada'}).click();
 await expect(audit.locator('[data-event="previously-acknowledged"]')).toHaveCount(1);
 await expect(audit.getByTestId('synthetic-audit-count')).toHaveText('3');
});
test('reiniciar ciclo destrói apenas o registro fictício da tela',async({page})=>{
 const {audit,lifecycle}=await orphan(page);
 await lifecycle.getByRole('button',{name:'Reiniciar ciclo'}).click();
 await expect(audit).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});
test('registro não transborda em larguras 390, 850 e 1440 px',async({page})=>{
 const {audit,recovery}=await orphan(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  const layout=await page.evaluate(()=>{
   const width=document.documentElement.clientWidth;
   const els=[...document.querySelectorAll('.synthetic-recovery-audit,.synthetic-recovery-audit-metrics>div,.synthetic-recovery-audit-events li')];
   return {width,overflow:document.documentElement.scrollWidth-width,
    boxes:els.map(x=>{const r=x.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})};
  });
  expect(layout.overflow).toBeLessThanOrEqual(3);
  for(const r of layout.boxes){expect(r.left).toBeGreaterThanOrEqual(-3);expect(r.right).toBeLessThanOrEqual(layout.width+3);expect(r.height).toBeGreaterThan(12);}
 }
});
test('registro não expõe caminhos nem habilita operações reais',async({page})=>{
 const {audit,recovery}=await orphan(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await recovery.getByRole('button',{name:'Executar nova triagem independente fictícia'}).click();
 await expect(audit).not.toContainText('def/fixture.sii');
 await expect(audit).not.toContainText('sound/fixture.ogg');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
