import {test,expect,type Page} from '@playwright/test';
async function open(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const container=lab.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const next=container.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();await next.click();
 const lifecycle=container.getByRole('region',{name:'Ciclo fictício do futuro leitor nativo'});
 const panel=lifecycle.getByRole('region',{name:'Simulação de retomada após reinicialização'});
 return {lifecycle,panel,recovery:lifecycle.getByRole('region',{name:'Recuperação fictícia de sessão abandonada'})};
}
async function orphan(page:Page){
 const v=await open(page);
 await v.lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await v.lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await v.lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await expect(v.panel).toBeVisible();
 return v;
}
test('simulador de reinicialização só aparece após uma perda fictícia',async({page})=>{
 const {panel,lifecycle}=await open(page);
 await expect(panel).toHaveCount(0);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await expect(panel).toHaveCount(0);
});
test('registro antigo tem dois eventos e zero evidências reutilizáveis',async({page})=>{
 const {panel}=await orphan(page);
 await expect(panel).toHaveAttribute('data-restarted','false');
 await expect(panel).toHaveAttribute('data-persistent','false');
 await expect(panel.getByTestId('synthetic-restart-total')).toHaveText('2');
 await expect(panel.getByTestId('synthetic-restart-retained')).toHaveText('2');
 await expect(panel.getByTestId('synthetic-restart-dropped')).toHaveText('0');
 await expect(panel.getByTestId('synthetic-restart-reusable')).toHaveText('0');
});
test('cópia válida obriga nova triagem e não simula reinício físico',async({page})=>{
 const {panel}=await orphan(page);
 await panel.getByRole('button',{name:'Simular reinicialização do registro'}).click();
 await expect(panel.getByTestId('synthetic-restart-status')).toHaveText('Nova análise obrigatória');
 await expect(panel.getByTestId('synthetic-restart-reason')).toContainText('sessão anterior terminou incompleta');
 await expect(panel.getByTestId('synthetic-restart-guard')).toContainText('nenhuma operação foi autorizada');
 await expect(panel.getByRole('button',{name:'Simular reinicialização do registro'})).toBeDisabled();
});
test('sequência truncada é recusada, sem publicar evento antigo',async({page})=>{
 const {panel}=await orphan(page);
 await panel.getByRole('combobox',{name:'Registro que será simulado'}).selectOption('missing-event');
 await panel.getByRole('button',{name:'Simular reinicialização do registro'}).click();
 await expect(panel.getByTestId('synthetic-restart-status')).toHaveText('Registro rejeitado');
 await expect(panel.getByTestId('synthetic-restart-reusable')).toHaveText('0');
});
test('permissão artificial e versão desconhecida são rejeitadas',async({page})=>{
 const {panel}=await orphan(page);
 const select=panel.getByRole('combobox',{name:'Registro que será simulado'});
 await select.selectOption('fake-approval');
 await panel.getByRole('button',{name:'Simular reinicialização do registro'}).click();
 await expect(panel.getByTestId('synthetic-restart-status')).toHaveText('Registro rejeitado');
 await select.selectOption('future-version');
 await panel.getByRole('button',{name:'Simular reinicialização do registro'}).click();
 await expect(panel.getByTestId('synthetic-restart-reason')).toContainText('Versão do registro não reconhecida');
});
test('mesmo após triagem fictícia concluída, registro copiado não recebe confiança',async({page})=>{
 const {panel,recovery}=await orphan(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await recovery.getByRole('button',{name:'Executar nova triagem independente fictícia'}).click();
 await panel.getByRole('button',{name:'Simular reinicialização do registro'}).click();
 await expect(panel.getByTestId('synthetic-restart-status')).toHaveText('Nova análise obrigatória');
 await expect(panel.getByTestId('synthetic-restart-reason')).toContainText('não comprova origem ou integridade');
 await expect(panel.getByTestId('synthetic-restart-reusable')).toHaveText('0');
});
test('limpar resultado e trocar cenário não modifica recuperação existente',async({page})=>{
 const {panel,recovery}=await orphan(page);
 await panel.getByRole('button',{name:'Simular reinicialização do registro'}).click();
 await panel.getByRole('button',{name:'Limpar resultado da simulação'}).click();
 await expect(panel.getByTestId('synthetic-restart-status')).toHaveCount(0);
 await panel.getByRole('combobox',{name:'Registro que será simulado'}).selectOption('future-version');
 await expect(panel.getByTestId('synthetic-restart-status')).toHaveCount(0);
 await expect(recovery.getByTestId('synthetic-recovery-phase')).toHaveText('Reconhecimento pendente');
});
test('teclado executa simulação sem arquivo de usuário',async({page})=>{
 const {panel}=await orphan(page);
 const select=panel.getByRole('combobox',{name:'Registro que será simulado'});
 await select.focus();await page.keyboard.press('Home');await page.keyboard.press('Tab');
 await expect(panel.getByRole('button',{name:'Simular reinicialização do registro'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(panel.getByTestId('synthetic-restart-status')).toBeVisible();
 await expect(panel).not.toContainText('def/fixture.sii');
});
test('layout de reinicialização fictícia não transborda em 390, 850 ou 1440 px',async({page})=>{
 const {panel}=await orphan(page);
 await panel.getByRole('button',{name:'Simular reinicialização do registro'}).click();
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  const m=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-restart,.synthetic-restart-metrics>div,.synthetic-restart-actions button,.synthetic-restart>label select')];
   return {viewport,overflow:document.documentElement.scrollWidth-viewport,boxes:nodes.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
   })};
  });
  expect(m.overflow).toBeLessThanOrEqual(3);
  for(const b of m.boxes){expect(b.left).toBeGreaterThanOrEqual(-3);expect(b.right).toBeLessThanOrEqual(m.viewport+3);expect(b.height).toBeGreaterThan(12);}
 }
});
test('simular registro reiniciado não cria atividades nem habilita instalação e remoção',async({page})=>{
 const {panel}=await orphan(page);
 await panel.getByRole('button',{name:'Simular reinicialização do registro'}).click();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
