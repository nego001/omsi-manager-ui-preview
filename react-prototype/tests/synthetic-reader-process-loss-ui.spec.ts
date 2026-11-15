import {test,expect,type Page} from '@playwright/test';
async function lab(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const root=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const container=root.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const next=container.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();await next.click();
 const lifecycle=container.getByRole('region',{name:'Ciclo fictício do futuro leitor nativo'});
 return {root,lifecycle};
}
async function finishSteps(page:Page){
 const {lifecycle}=await lab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 const step=lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'});
 await step.click();await step.click();
 return lifecycle;
}
test('perda inesperada no meio do fluxo mostra limpeza não comprovada',async({page})=>{
 const {lifecycle}=await lab(page);
 await lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'}).selectOption('process-loss');
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toContainText('recuperação pendente');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Pendente');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-recovery')).toContainText('Não é possível confirmar');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-unverified-cleanup')).toContainText('Fechamento não comprovado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-discarded')).toBeVisible();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-native-open')).toHaveText('0');
});
test('reconhecer sessão abandonada não equivale a limpeza bem sucedida',async({page})=>{
 const {lifecycle}=await lab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await lifecycle.getByRole('button',{name:'Reconhecer sessão abandonada'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Fechado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Pendente');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-unverified-cleanup')).toBeVisible();
 await expect(lifecycle.getByRole('button',{name:'Fechar e limpar'})).toBeDisabled();
});
test('interromper durante fechamento de duas etapas nunca publica sucesso',async({page})=>{
 const lifecycle=await finishSteps(page);
 await lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'}).selectOption('close-interruption');
 // Switching scenario resets the fixture timeline.
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 const step=lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'});
 await step.click();await step.click();
 await lifecycle.getByRole('button',{name:'Iniciar fechamento em duas etapas'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toContainText('resultado ainda não publicado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Pendente');
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-reason')).toContainText('meio do fechamento');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-discarded')).toBeVisible();
 await expect(lifecycle.getByRole('button',{name:'Concluir fechamento fictício'})).toBeDisabled();
});
test('fechamento em duas etapas só termina após confirmação',async({page})=>{
 const lifecycle=await finishSteps(page);
 await lifecycle.getByRole('button',{name:'Iniciar fechamento em duas etapas'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toContainText('Fechamento iniciado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Pendente');
 await lifecycle.getByRole('button',{name:'Concluir fechamento fictício'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Fechado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Concluída');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-reason')).toContainText('completa');
});
test('reabrir sessão já fechada não reinicia análise nem limpa novamente',async({page})=>{
 const {lifecycle}=await lab(page);
 await lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'}).selectOption('replay');
 await lifecycle.getByRole('button',{name:'Fechar e limpar'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Fechado');
 await lifecycle.getByRole('button',{name:'Tentar reabrir sessão encerrada'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-replay-denied')).toContainText('Reabertura recusada');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Fechado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-progress')).toHaveText('0 de 2');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-native-open')).toHaveText('0');
});
test('reiniciar depois de falha cria apenas novo exemplo, sem arquivo real',async({page})=>{
 const {lifecycle}=await lab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await lifecycle.getByRole('button',{name:'Reiniciar ciclo'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Ainda não aberto');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-native-open')).toHaveText('0');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-recovery')).toHaveCount(0);
});
test('controles de fechamento são acessíveis pelo teclado sem permissão real',async({page})=>{
 const lifecycle=await finishSteps(page);
 const button=lifecycle.getByRole('button',{name:'Iniciar fechamento em duas etapas'});
 await button.focus();await page.keyboard.press('Enter');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toContainText('Fechamento iniciado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-native-open')).toHaveText('0');
});
test('avisos de perda não transbordam em 390, 850 e 1440 pixels',async({page})=>{
 const {lifecycle}=await lab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  const m=await page.evaluate(()=>{
   const width=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-lifecycle,.synthetic-lifecycle-actions button,.synthetic-lifecycle-uncertain')];
   return {width,overflow:document.documentElement.scrollWidth-width,
    rects:nodes.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height}})};
  });
  expect(m.overflow).toBeLessThanOrEqual(3);
  for(const r of m.rects){expect(r.left).toBeGreaterThanOrEqual(-3);expect(r.right).toBeLessThanOrEqual(m.width+3);expect(r.height).toBeGreaterThan(12);}
 }
});
test('perda simulada não gera atividades, nem ativa instalação e remoção',async({page})=>{
 const {lifecycle}=await lab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
