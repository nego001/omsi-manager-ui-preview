import {test,expect,type Page} from '@playwright/test';
async function openLab(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const container=page.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const next=container.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();await next.click();
 const lifecycle=container.getByRole('region',{name:'Ciclo fictício do futuro leitor nativo'});
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Simular perda do processo'}).click();
 const matrix=lifecycle.getByRole('region',{name:'Matriz fictícia de falhas de armazenamento'});
 await expect(matrix).toBeVisible();
 return {matrix,select:matrix.getByRole('combobox',{name:'Cenário fictício'})};
}
async function advance(panel:ReturnType<Page['getByRole']>,n:number){
 for(let i=0;i<n;i++)await panel.getByRole('button',{name:'Executar falha ou etapa seguinte'}).click();
}
test('matriz está ausente antes de perda sintética do processo',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('region',{name:'Matriz fictícia de falhas de armazenamento'})).toHaveCount(0);
});
test('painel começa disponível, sem arquivo, lock nativo ou prova real',async({page})=>{
 const {matrix}=await openLab(page);
 await expect(matrix).toHaveAttribute('data-native-lock','false');
 await expect(matrix).toHaveAttribute('data-real-storage','false');
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Disponível');
 await expect(matrix.getByTestId('synthetic-matrix-failures')).toHaveText('0');
 await expect(matrix.getByTestId('synthetic-matrix-dropped')).toHaveText('0');
});
test('cópia corrompida é rejeitada sem criar autorização real',async({page})=>{
 const {matrix}=await openLab(page);
 await advance(matrix,2);
 await expect(matrix.getByTestId('synthetic-matrix-outcome')).toContainText('Registro corrompido recusado');
 await expect(matrix.getByTestId('synthetic-matrix-corrupt')).toContainText('nenhuma permissão');
 await advance(matrix,1);
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Disponível');
});
test('sessão B não toma o lease de A e só entra após liberação',async({page})=>{
 const {matrix,select}=await openLab(page);
 await select.selectOption('conflict');
 await advance(matrix,1);
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Sessão em andamento');
 await advance(matrix,1);
 await expect(matrix.getByTestId('synthetic-matrix-outcome')).toContainText('Conflito entre sessões');
 await advance(matrix,2);
 await expect(matrix.getByTestId('synthetic-matrix-progress')).toContainText('Geração 1');
 await advance(matrix,2);
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Disponível');
});
test('após dez tentativas retém oito e deixa duas explicitamente omitidas',async({page})=>{
 const {matrix,select}=await openLab(page);
 await select.selectOption('exhaustion');
 await advance(matrix,11);
 await expect(matrix.getByTestId('synthetic-matrix-retained')).toHaveText('8');
 await expect(matrix.getByTestId('synthetic-matrix-dropped')).toHaveText('2');
 await expect(matrix.getByTestId('synthetic-matrix-history')).toContainText('oito entradas');
});
test('terceira interrupção de recuperação exige quarentena do fixture',async({page})=>{
 const {matrix,select}=await openLab(page);
 await select.selectOption('repeated');
 await advance(matrix,6);
 await expect(matrix.getByTestId('synthetic-matrix-failures')).toHaveText('3');
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Quarentena');
 await expect(matrix.getByTestId('synthetic-matrix-quarantined')).toContainText('novas sessões são recusadas');
 await advance(matrix,1);
 await expect(matrix.getByTestId('synthetic-matrix-outcome')).toContainText('Quarentena obrigatória');
});
test('nova sessão com geração antiga não pode assumir controle',async({page})=>{
 const {matrix,select}=await openLab(page);
 await select.selectOption('stale');
 await advance(matrix,3);
 await expect(matrix.getByTestId('synthetic-matrix-outcome')).toContainText('Geração desatualizada');
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Disponível');
 await expect(matrix.getByTestId('synthetic-matrix-progress')).toContainText('Geração 1');
});
test('reiniciar simulação reinicia apenas contadores fictícios',async({page})=>{
 const {matrix,select}=await openLab(page);
 await select.selectOption('repeated');await advance(matrix,6);
 await matrix.getByRole('button',{name:'Reiniciar matriz fictícia'}).click();
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Disponível');
 await expect(matrix.getByTestId('synthetic-matrix-failures')).toHaveText('0');
 await expect(matrix.getByTestId('synthetic-matrix-progress')).toContainText('Etapa 0');
});
test('controles são operáveis pelo teclado sem escolher arquivos Windows',async({page})=>{
 const {matrix,select}=await openLab(page);
 await select.focus();await page.keyboard.press('Home');await page.keyboard.press('Tab');
 await expect(matrix.getByRole('button',{name:'Executar falha ou etapa seguinte'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(matrix.getByTestId('synthetic-matrix-phase')).toHaveText('Sessão em andamento');
 await expect(matrix).not.toContainText('def/fake.sii');
});
test('layout responsivo mantém painéis e avisos dentro de 390, 850 e 1440 px',async({page})=>{
 const {matrix,select}=await openLab(page);
 await select.selectOption('repeated');await advance(matrix,6);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  const result=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-storage-matrix,.synthetic-storage-matrix-metrics>div,.synthetic-storage-matrix-actions button,.synthetic-storage-matrix>label select')];
   return {viewport,overflow:document.documentElement.scrollWidth-viewport,boxes:nodes.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
   })};
  });
  expect(result.overflow).toBeLessThanOrEqual(3);
  for(const box of result.boxes){
   expect(box.left).toBeGreaterThanOrEqual(-3);
   expect(box.right).toBeLessThanOrEqual(result.viewport+3);
   expect(box.height).toBeGreaterThan(12);
  }
 }
});
test('nenhuma falha libera operações de instalar ou remover mods',async({page})=>{
 const {matrix,select}=await openLab(page);
 await select.selectOption('repeated');await advance(matrix,7);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
