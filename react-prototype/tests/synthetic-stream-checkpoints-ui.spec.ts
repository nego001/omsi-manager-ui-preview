import {test,expect,type Page} from '@playwright/test';
async function open(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const container=lab.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 const stream=container.getByRole('region',{name:'Simulação de blocos em fluxo'});
 return {lab,container,stream};
}
async function unlockDemo(page:Page){
 const p=await open(page);
 const button=p.container.getByRole('button',{name:'Verificar próxima declaração'});
 await button.click();await button.click();
 await expect(p.stream).toBeVisible();
 return p;
}
test('fluxo de blocos não aparece antes da triagem declarativa completa',async({page})=>{
 const {container,stream}=await open(page);
 await expect(stream).toHaveCount(0);
 await container.getByRole('button',{name:'Verificar próxima declaração'}).click();
 await expect(stream).toHaveCount(0);
});
test('dois blocos consistentes só ficam concluídos juntos e não autorizam leitura',async({page})=>{
 const {stream}=await unlockDemo(page);
 await expect(stream).toHaveAttribute('data-reader-enabled','false');
 await expect(stream.getByTestId('synthetic-stream-status')).toHaveText('Pendente');
 await expect(stream.getByTestId('synthetic-stream-released')).toHaveText('0');
 const next=stream.getByRole('button',{name:'Conferir próximo bloco'});
 await next.click();
 await expect(stream.getByTestId('synthetic-stream-progress')).toHaveText('1 de 2');
 await expect(stream.getByTestId('synthetic-stream-released')).toHaveText('0');
 await next.click();
 await expect(stream.getByTestId('synthetic-stream-status')).toHaveText('Metadados conferidos');
 await expect(stream.getByTestId('synthetic-stream-released')).toHaveText('2');
 await expect(stream.getByTestId('synthetic-stream-real-bytes')).toHaveText('0');
 await expect(next).toBeDisabled();
 await expect(stream).toContainText('Integridade, conteúdo e formato reais continuam sem verificação');
});
test('um bloco com expansão extrema descarta qualquer conclusão',async({page})=>{
 const {stream}=await unlockDemo(page);
 await stream.getByRole('combobox',{name:'Situação dos blocos fictícios'}).selectOption('inflation');
 await stream.getByRole('button',{name:'Conferir próximo bloco'}).click();
 await expect(stream.getByTestId('synthetic-stream-status')).toHaveText('Bloqueado');
 await expect(stream.getByTestId('synthetic-stream-failure')).toContainText('Orçamento de tamanho ou expansão');
 await expect(stream.getByTestId('synthetic-stream-discarded')).toBeVisible();
 await expect(stream.getByTestId('synthetic-stream-released')).toHaveText('0');
});
test('sequência truncada não preserva uma entrada parcial como aprovada',async({page})=>{
 const {stream}=await unlockDemo(page);
 await stream.getByRole('combobox',{name:'Situação dos blocos fictícios'}).selectOption('truncated');
 await stream.getByRole('button',{name:'Conferir próximo bloco'}).click();
 await expect(stream.getByTestId('synthetic-stream-status')).toHaveText('Bloqueado');
 await expect(stream.getByTestId('synthetic-stream-failure')).toContainText('Fluxo incompleto');
 await expect(stream.getByTestId('synthetic-stream-released')).toHaveText('0');
});
test('ordem e tempo inventado excessivo são rejeitados',async({page})=>{
 const {stream}=await unlockDemo(page);
 const select=stream.getByRole('combobox',{name:'Situação dos blocos fictícios'});
 const next=stream.getByRole('button',{name:'Conferir próximo bloco'});
 await select.selectOption('reordered');await next.click();
 await expect(stream.getByTestId('synthetic-stream-failure')).toContainText('fora da ordem');
 await select.selectOption('slow');await next.click();
 await expect(stream.getByTestId('synthetic-stream-failure')).toContainText('tempo declarado');
 await expect(stream.getByTestId('synthetic-stream-real-bytes')).toHaveText('0');
});
test('cancelar dentro de uma entrada descarta o acumulado',async({page})=>{
 const {stream}=await unlockDemo(page);
 await stream.getByRole('combobox',{name:'Situação dos blocos fictícios'}).selectOption('cancel');
 await stream.getByRole('button',{name:'Conferir próximo bloco'}).click();
 await expect(stream.getByTestId('synthetic-stream-status')).toHaveText('Pendente');
 await expect(stream.getByTestId('synthetic-stream-progress')).toHaveText('1 de 3');
 await stream.getByRole('button',{name:'Interromper fluxo'}).click();
 await expect(stream.getByTestId('synthetic-stream-status')).toHaveText('Cancelado');
 await expect(stream.getByTestId('synthetic-stream-released')).toHaveText('0');
 await expect(stream.getByTestId('synthetic-stream-discarded')).toBeVisible();
 await expect(stream.getByRole('button',{name:'Conferir próximo bloco'})).toBeDisabled();
});
test('reiniciar fluxo só reinicia simulação; não altera triagem nem permissões',async({page})=>{
 const {container,stream}=await unlockDemo(page);
 await stream.getByRole('combobox',{name:'Situação dos blocos fictícios'}).selectOption('inflation');
 await stream.getByRole('button',{name:'Conferir próximo bloco'}).click();
 await stream.getByRole('button',{name:'Reiniciar fluxo fictício'}).click();
 await expect(stream.getByTestId('synthetic-stream-progress')).toHaveText('0 de 1');
 await expect(stream.getByTestId('synthetic-stream-status')).toHaveText('Pendente');
 await expect(container.getByTestId('synthetic-container-progress')).toHaveText('2 de 2');
 await expect(stream.getByTestId('synthetic-stream-real-bytes')).toHaveText('0');
});
test('quando a triagem volta a ficar incompleta, fluxo desaparece',async({page})=>{
 const {container,stream}=await unlockDemo(page);
 await container.getByRole('button',{name:'Reiniciar exemplo'}).click();
 await expect(stream).toHaveCount(0);
 await container.getByRole('combobox',{name:'Escolher situação fictícia'}).selectOption('unsupported');
 await expect(stream).toHaveCount(0);
});
test('controle de blocos funciona pelo teclado, sem escolher arquivos do Windows',async({page})=>{
 const {stream}=await unlockDemo(page);
 const select=stream.getByRole('combobox',{name:'Situação dos blocos fictícios'});
 await select.focus();await page.keyboard.press('Home');await page.keyboard.press('Tab');
 await expect(select).toHaveValue('normal');
 await expect(stream.getByRole('button',{name:'Conferir próximo bloco'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(stream.getByTestId('synthetic-stream-progress')).toHaveText('1 de 2');
 await expect(stream).not.toContainText('Vehicles/demo.bus');
});
test('390, 850 e 1440 px mantêm cartões e controles inteiros',async({page})=>{
 const {stream}=await unlockDemo(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:920});
  await expect(stream).toBeVisible();
  const m=await page.evaluate(()=>{
   const width=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-stream,.synthetic-stream-metrics>div,.synthetic-stream-actions button,.synthetic-stream>label select')];
   return {width,overflow:document.documentElement.scrollWidth-width,
    boxes:nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height}})};
  });
  expect(m.overflow).toBeLessThanOrEqual(3);
  for(const box of m.boxes){
   expect(box.left).toBeGreaterThanOrEqual(-3);
   expect(box.right).toBeLessThanOrEqual(m.width+3);
   expect(box.height).toBeGreaterThan(12);
  }
 }
});
test('fluxo não cria atividades nem habilita botões reais de instalação/remoção',async({page})=>{
 const {stream}=await unlockDemo(page);
 await stream.getByRole('button',{name:'Conferir próximo bloco'}).click();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
