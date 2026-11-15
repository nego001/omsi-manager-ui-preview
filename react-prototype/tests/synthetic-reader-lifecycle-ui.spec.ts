import {test,expect,type Page} from '@playwright/test';
async function openLab(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const container=lab.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const next=container.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();await next.click();
 const lifecycle=container.getByRole('region',{name:'Ciclo fictício do futuro leitor nativo'});
 await expect(lifecycle).toBeVisible();
 return {lab,container,lifecycle};
}
test('novo painel começa fechado em memória, sem handle de arquivo real',async({page})=>{
 const {lifecycle}=await openLab(page);
 await expect(lifecycle).toHaveAttribute('data-native-open','false');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Ainda não aberto');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-progress')).toHaveText('0 de 2');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-native-open')).toHaveText('0');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Pendente');
 await expect(lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'})).toBeDisabled();
});
test('abrir, conferir dois blocos e fechar produz limpeza única do modelo',async({page})=>{
 const {lifecycle}=await openLab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Aberto somente na simulação');
 const step=lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'});
 await step.click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-progress')).toHaveText('1 de 2');
 await step.click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toContainText('fechamento pendente');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Pendente');
 await lifecycle.getByRole('button',{name:'Fechar e limpar'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Fechado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Concluída');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-reason')).toContainText('conferência fictícia completa');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-native-open')).toHaveText('0');
});
test('cancelamento após um bloco remove o progresso publicado',async({page})=>{
 const {lifecycle}=await openLab(page);
 await lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'}).selectOption('cancel');
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Cancelar e limpar'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Fechado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-discarded')).toContainText('Nenhuma declaração foi publicada');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-cleanup')).toHaveText('Concluída');
});
test('fechamento antecipado mostra descarte e não simula sucesso',async({page})=>{
 const {lifecycle}=await openLab(page);
 await lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'}).selectOption('early-close');
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Fechar e limpar'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-reason')).toContainText('Fechamento antecipado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-discarded')).toBeVisible();
});
test('falha de bloco força limpeza automática sem botão de fechar',async({page})=>{
 const {lifecycle}=await openLab(page);
 await lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'}).selectOption('error');
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Fechado');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-reason')).toContainText('descarte automático dos resultados');
 await expect(lifecycle.getByRole('button',{name:'Fechar e limpar'})).toBeDisabled();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-native-open')).toHaveText('0');
});
test('mudar de cenário ou reiniciar apenas reseta o modelo fictício',async({page})=>{
 const {lifecycle,container}=await openLab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'}).selectOption('error');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Ainda não aberto');
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Reiniciar ciclo'}).click();
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Ainda não aberto');
 await expect(container.getByTestId('synthetic-container-progress')).toHaveText('2 de 2');
});
test('teclado pode abrir a simulação, mas não tem ação para ler arquivos reais',async({page})=>{
 const {lifecycle}=await openLab(page);
 const selector=lifecycle.getByRole('combobox',{name:'Cenário de ciclo fictício'});
 await selector.focus();await page.keyboard.press('Home');await page.keyboard.press('Tab');
 await expect(lifecycle.getByRole('button',{name:'Abrir sessão fictícia'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(lifecycle.getByTestId('synthetic-lifecycle-phase')).toHaveText('Aberto somente na simulação');
 await expect(lifecycle).not.toContainText('def/a.sii');
});
test('painel preserva largura em 390, 850 e 1440 pixels',async({page})=>{
 const {lifecycle}=await openLab(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:930});
  await expect(lifecycle).toBeVisible();
  const v=await page.evaluate(()=>{
   const w=document.documentElement.clientWidth;
   const els=[...document.querySelectorAll('.synthetic-lifecycle,.synthetic-lifecycle-metrics>div,.synthetic-lifecycle-actions button,.synthetic-lifecycle>label select')];
   return {w,overflow:document.documentElement.scrollWidth-w,rects:els.map(el=>{
    const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
   })};
  });
  expect(v.overflow).toBeLessThanOrEqual(3);
  for(const r of v.rects){
   expect(r.left).toBeGreaterThanOrEqual(-3);
   expect(r.right).toBeLessThanOrEqual(v.w+3);
   expect(r.height).toBeGreaterThan(12);
  }
 }
});
test('nenhum passo habilita instalação, remoção ou registro de atividade real',async({page})=>{
 const {lifecycle}=await openLab(page);
 await lifecycle.getByRole('button',{name:'Abrir sessão fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Avançar etapa de leitura fictícia'}).click();
 await lifecycle.getByRole('button',{name:'Fechar e limpar'}).click();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
