import {test,expect,type Page} from '@playwright/test';
async function start(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const screen=page.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const next=screen.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();await next.click();
 const lifecycle=screen.getByRole('region',{name:'Ciclo fictício do futuro leitor nativo'});
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 const matrix=lifecycle.getByRole('region',{name:'Matriz fictícia de falhas de armazenamento'});
 const panel=matrix.getByRole('region',{name:'Política fictícia de revisão da quarentena'});
 return {matrix,panel,scenario:matrix.getByRole('combobox',{name:'Cenário fictício'})};
}
async function quarantine(page:Page){
 const x=await start(page);
 await x.scenario.selectOption('repeated');
 const next=x.matrix.getByRole('button',{name:'Executar falha ou etapa seguinte'});
 for(let i=0;i<6;i++)await next.click();
 await expect(x.panel).toBeVisible();
 return x;
}
test('política só aparece depois da falha, corrupção ou esgotamento declarado',async({page})=>{
 const {panel,matrix}=await start(page);
 await expect(panel).toHaveCount(0);
 await matrix.getByRole('button',{name:'Executar falha ou etapa seguinte'}).click();
 await expect(panel).toHaveCount(0);
});
test('após três falhas mostra matriz original em quarentena',async({page})=>{
 const {panel}=await quarantine(page);
 await expect(panel).toHaveAttribute('data-real-unlock','false');
 await expect(panel).toHaveAttribute('data-real-review','false');
 await expect(panel.getByTestId('synthetic-quarantine-phase')).toHaveText('Reanálise pendente');
 await expect(panel.getByTestId('synthetic-quarantine-failures')).toHaveText('3');
 await expect(panel.getByTestId('synthetic-quarantine-declarations')).toHaveText('0');
 await expect(panel.getByTestId('synthetic-quarantine-old')).toHaveText('0');
 await expect(panel.getByTestId('synthetic-quarantine-still-locked')).toContainText('permanece em quarentena');
});
test('reanálise antes de reconhecimento é recusada pela política',async({page})=>{
 const {panel}=await quarantine(page);
 await panel.getByRole('button',{name:'Conferir nova triagem fictícia'}).click();
 await expect(panel.getByTestId('synthetic-quarantine-decision')).toContainText('precisa ser reconhecido');
 await expect(panel.getByTestId('synthetic-quarantine-phase')).toHaveText('Reanálise pendente');
});
test('cópia antiga e nova análise incompleta são rejeitadas após reconhecimento',async({page})=>{
 const {panel}=await quarantine(page);
 await panel.getByRole('button',{name:'Reconhecer abandono no exemplo'}).click();
 await panel.getByRole('button',{name:'Tentar reutilizar sessão antiga'}).click();
 await expect(panel.getByTestId('synthetic-quarantine-decision')).toContainText('Sessão antiga');
 await panel.getByRole('button',{name:'Enviar reanálise incompleta'}).click();
 await expect(panel.getByTestId('synthetic-quarantine-decision')).toContainText('incompleta');
 await expect(panel.getByTestId('synthetic-quarantine-declarations')).toHaveText('0');
});
test('reanálise independente aceita somente declarações fictícias, sem desbloquear',async({page})=>{
 const {panel,matrix}=await quarantine(page);
 await panel.getByRole('button',{name:'Reconhecer abandono no exemplo'}).click();
 await panel.getByRole('button',{name:'Tentar reutilizar sessão antiga'}).click();
 await panel.getByRole('button',{name:'Conferir nova triagem fictícia'}).click();
 await expect(panel.getByTestId('synthetic-quarantine-phase')).toHaveText('Nova triagem fictícia revista');
 await expect(panel.getByTestId('synthetic-quarantine-declarations')).toHaveText('2');
 await expect(panel.getByTestId('synthetic-quarantine-decision')).toContainText('não foi removida');
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Quarentena');
 await expect(panel.getByTestId('synthetic-quarantine-still-locked')).toBeVisible();
});
test('corrupção fictícia também exige revisão antes de nova análise',async({page})=>{
 const {matrix,panel}=await start(page);
 const next=matrix.getByRole('button',{name:'Executar falha ou etapa seguinte'});
 for(let i=0;i<3;i++)await next.click();
 await expect(panel).toBeVisible();
 await expect(panel.getByTestId('synthetic-quarantine-phase')).toHaveText('Reanálise pendente');
 await expect(panel.getByTestId('synthetic-quarantine-failures')).toHaveText('0');
});
test('reiniciar matriz encerra visualização da política e descarta revisão',async({page})=>{
 const {matrix,panel}=await quarantine(page);
 await panel.getByRole('button',{name:'Reconhecer abandono no exemplo'}).click();
 await panel.getByRole('button',{name:'Conferir nova triagem fictícia'}).click();
 await matrix.getByRole('button',{name:'Reiniciar matriz fictícia'}).click();
 await expect(panel).toHaveCount(0);
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Disponível');
});
test('novo painel não transborda nas três larguras de tela',async({page})=>{
 const {panel}=await quarantine(page);
 await panel.getByRole('button',{name:'Reconhecer abandono no exemplo'}).click();
 await panel.getByRole('button',{name:'Enviar reanálise incompleta'}).click();
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:920});
  await expect(panel).toBeVisible();
  const x=await page.evaluate(()=>{
   const w=document.documentElement.clientWidth;
   const els=[...document.querySelectorAll('.synthetic-quarantine-review,.synthetic-quarantine-metrics>div,.synthetic-quarantine-actions button')];
   return {w,overflow:document.documentElement.scrollWidth-w,
    rects:els.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})};
  });
  expect(x.overflow).toBeLessThanOrEqual(3);
  for(const r of x.rects){expect(r.left).toBeGreaterThanOrEqual(-3);expect(r.right).toBeLessThanOrEqual(x.w+3);expect(r.height).toBeGreaterThan(12);}
 }
});
test('política pode ser usada pelo teclado e não habilita instalação nem remoção',async({page})=>{
 const {panel}=await quarantine(page);
 const button=panel.getByRole('button',{name:'Reconhecer abandono no exemplo'});
 await button.focus();await page.keyboard.press('Enter');
 await panel.getByRole('button',{name:'Conferir nova triagem fictícia'}).click();
 await expect(panel.getByTestId('synthetic-quarantine-phase')).toContainText('revista');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
