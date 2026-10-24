import {test,expect,type Page} from '@playwright/test';
async function openLab(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const container=lab.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const button=container.getByRole('button',{name:'Verificar próxima declaração'});
 await button.click();await button.click();
 const lifecycle=container.getByRole('region',{name:'Ciclo fictício do futuro leitor nativo'});
 const recovery=lifecycle.getByRole('region',{name:'Recuperação fictícia de sessão abandonada'});
 return {lab,lifecycle,recovery};
}
async function lose(page:Page){
 const p=await openLab(page);
 await p.lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await p.lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await p.lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await expect(p.recovery).toBeVisible();
 return p;
}
test('recuperação não aparece antes de ocorrer perda de processo',async({page})=>{
 const {lifecycle,recovery}=await openLab(page);
 await expect(recovery).toHaveCount(0);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await expect(recovery).toHaveCount(0);
});
test('registro de perda invalida evidências antigas e exige reconhecimento',async({page})=>{
 const {recovery}=await lose(page);
 await expect(recovery).toHaveAttribute('data-real-recovery','false');
 await expect(recovery.getByTestId('synthetic-recovery-phase')).toHaveText('Reconhecimento pendente');
 await expect(recovery.getByTestId('synthetic-recovery-old')).toHaveText('0');
 await expect(recovery.getByTestId('synthetic-recovery-fresh')).toHaveText('0');
 await expect(recovery.getByTestId('synthetic-recovery-real')).toHaveText('0');
 await expect(recovery.getByRole('button',{name:'Executar nova triagem independente fictícia'})).toBeDisabled();
});
test('reconhecer abandono não reutiliza relatório nem atesta limpeza',async({page})=>{
 const {lifecycle,recovery}=await lose(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await expect(recovery.getByTestId('synthetic-recovery-phase')).toHaveText('Nova triagem necessária');
 await expect(recovery.getByTestId('synthetic-recovery-old')).toHaveText('0');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-unverified-cleanup')).toContainText('Fechamento não comprovado');
 await expect(recovery.getByRole('button',{name:'Testar reutilização da sessão antiga'})).toBeEnabled();
});
test('reutilizar sessão antiga mostra bloqueio e mantém possibilidade de refazer análise',async({page})=>{
 const {recovery}=await lose(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await recovery.getByRole('button',{name:'Testar reutilização da sessão antiga'}).click();
 await expect(recovery.getByTestId('synthetic-recovery-rejected')).toContainText('Reutilização recusada');
 await expect(recovery.getByTestId('synthetic-recovery-phase')).toHaveText('Nova triagem necessária');
 await expect(recovery.getByTestId('synthetic-recovery-fresh')).toHaveText('0');
 await expect(recovery.getByRole('button',{name:'Executar nova triagem independente fictícia'})).toBeEnabled();
});
test('reanálise independente registra só duas declarações fictícias novas',async({page})=>{
 const {lifecycle,recovery}=await lose(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await recovery.getByRole('button',{name:'Testar reutilização da sessão antiga'}).click();
 await recovery.getByRole('button',{name:'Executar nova triagem independente fictícia'}).click();
 await expect(recovery.getByTestId('synthetic-recovery-phase')).toHaveText('Nova análise fictícia recebida');
 await expect(recovery.getByTestId('synthetic-recovery-fresh')).toHaveText('2');
 await expect(recovery.getByTestId('synthetic-recovery-old')).toHaveText('0');
 await expect(recovery.getByTestId('synthetic-recovery-real')).toHaveText('0');
 await expect(recovery.getByTestId('synthetic-recovery-observed')).toContainText('continuam não verificadas');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Pendente');
});
test('recuperação também se aplica ao fechamento interrompido em duas etapas',async({page})=>{
 const {lifecycle,recovery}=await openLab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 const step=lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'});
 await step.click();await step.click();
 await lifecycle.getByRole('button',{name:'Iniciar fechamento em duas etapas'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 await expect(recovery.getByTestId('synthetic-recovery-phase')).toHaveText('Reconhecimento pendente');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-reason')).toContainText('meio do fechamento');
});
test('reconhecimento pelo ciclo principal é compreendido pelo painel de recuperação',async({page})=>{
 const {lifecycle,recovery}=await lose(page);
 await lifecycle.getByRole('button',{name:'Reconhecer sessão abandonada'}).click();
 await expect(recovery.getByTestId('synthetic-recovery-phase')).toHaveText('Nova triagem necessária');
 await expect(recovery.getByTestId('synthetic-recovery-old')).toHaveText('0');
});
test('alterar cenário reinicia recuperação sem reter relato anterior',async({page})=>{
 const {lifecycle,recovery}=await lose(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await recovery.getByRole('button',{name:'Executar nova triagem independente fictícia'}).click();
 await expect(recovery.getByTestId('synthetic-recovery-fresh')).toHaveText('2');
 await lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'}).selectOption('error');
 await expect(recovery).toHaveCount(0);
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Ainda não aberto');
});
test('recuperação opera pelo teclado sem oferecer autorização de mods',async({page})=>{
 const {recovery}=await lose(page);
 const acknowledge=recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'});
 await acknowledge.focus();await page.keyboard.press('Enter');
 await expect(recovery.getByTestId('synthetic-recovery-phase')).toHaveText('Nova triagem necessária');
 await expect(recovery.getByRole('button',{name:/autorizar|instalar|validar mod real/i})).toHaveCount(0);
});
test('layout de recuperação permanece dentro de 390, 850 e 1440 px',async({page})=>{
 const {recovery}=await lose(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  const data=await page.evaluate(()=>{
   const width=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-recovery,.synthetic-recovery-metrics>div,.synthetic-recovery-actions button')];
   return {width,overflow:document.documentElement.scrollWidth-width,
    boxes:nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})};
  });
  expect(data.overflow).toBeLessThanOrEqual(3);
  for(const r of data.boxes){expect(r.left).toBeGreaterThanOrEqual(-3);expect(r.right).toBeLessThanOrEqual(data.width+3);expect(r.height).toBeGreaterThan(12);}
 }
});
test('reconstrução fictícia não registra atividade real nem libera instalação e remoção',async({page})=>{
 const {recovery}=await lose(page);
 await recovery.getByRole('button',{name:'Reconhecer perda no registro fictício'}).click();
 await recovery.getByRole('button',{name:'Executar nova triagem independente fictícia'}).click();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
