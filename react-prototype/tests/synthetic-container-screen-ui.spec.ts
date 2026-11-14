import {test,expect,type Page} from '@playwright/test';
async function demo(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
 const screen=lab.getByRole('region',{name:'Triagem fictícia de arquivos ZIP e SCS'});
 return {lab,screen,select:screen.getByRole('combobox',{name:'Escolher situação fictícia'})};
}
test('laboratório ZIP/SCS começa pendente e nunca acessa um byte real',async({page})=>{
 const {screen,select}=await demo(page);
 await expect(screen).toHaveAttribute('data-real-read','false');
 await expect(select).toHaveValue('zip');
 await expect(screen.getByTestId('synthetic-container-status')).toHaveText('Pendente de análise declarativa');
 await expect(screen.getByTestId('synthetic-container-progress')).toHaveText('0 de 2');
 await expect(screen.getByTestId('synthetic-container-bytes')).toHaveText('0');
 await expect(screen).toContainText('Leitura real desativada');
});
test('ZIP de duas entradas é percorrido passo a passo sem virar aprovação',async({page})=>{
 const {screen}=await demo(page);
 const next=screen.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();
 await expect(screen.getByTestId('synthetic-container-progress')).toHaveText('1 de 2');
 await expect(screen.getByTestId('synthetic-container-status')).toHaveText('Pendente de análise declarativa');
 await next.click();
 await expect(screen.getByTestId('synthetic-container-status')).toHaveText('Declarações percorridas, sem verificação real');
 await expect(next).toBeDisabled();
 await expect(screen.getByTestId('synthetic-container-bytes')).toHaveText('0');
 await expect(screen).toContainText('Não há aprovação de arquivo');
});
test('catálogo SCS declarado também pode ser percorrido sem parser real',async({page})=>{
 const {screen,select}=await demo(page);
 await select.selectOption('scs');
 await screen.getByRole('button',{name:'Verificar próxima declaração'}).click();
 await screen.getByRole('button',{name:'Verificar próxima declaração'}).click();
 await expect(screen.getByTestId('synthetic-container-status')).toContainText('Declarações percorridas');
 await expect(screen.getByTestId('synthetic-container-bytes')).toHaveText('0');
});
test('travessia declarada é detectada na segunda entrada e trava o processo',async({page})=>{
 const {screen,select}=await demo(page);
 await select.selectOption('traversal');
 const next=screen.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();
 await expect(screen.getByTestId('synthetic-container-progress')).toHaveText('1 de 2');
 await next.click();
 await expect(screen.getByTestId('synthetic-container-status')).toHaveText('Bloqueado');
 await expect(screen.getByTestId('synthetic-container-reason')).toContainText('Caminho declarado potencialmente perigoso');
 await expect(next).toBeDisabled();
});
test('links, duplicação e expansão geram bloqueios próprios',async({page})=>{
 const {screen,select}=await demo(page);
 for(const [scenario,reason] of [
  ['symlink','Links simbólicos ou rígidos'],['bomb','Limite de expansão'],
  ['duplicate','Dois nomes declarados entram em conflito']
 ] as const){
  await select.selectOption(scenario);
  const next=screen.getByRole('button',{name:'Verificar próxima declaração'});
  await next.click();await next.click();
  await expect(screen.getByTestId('synthetic-container-reason')).toContainText(reason);
  await expect(screen.getByTestId('synthetic-container-bytes')).toHaveText('0');
 }
});
test('SCS proprietário não reconhecido fica bloqueado sem processamento',async({page})=>{
 const {screen,select}=await demo(page);
 await select.selectOption('unsupported');
 await expect(screen.getByTestId('synthetic-container-status')).toHaveText('Bloqueado');
 await expect(screen.getByTestId('synthetic-container-progress')).toHaveText('0 de 1');
 await expect(screen.getByTestId('synthetic-container-reason')).toContainText('parser específico e auditado');
 await expect(screen.getByRole('button',{name:'Verificar próxima declaração'})).toBeDisabled();
});
test('cancelamento entre checkpoints impede análise da próxima entrada',async({page})=>{
 const {screen,select}=await demo(page);
 await select.selectOption('cancel');
 await screen.getByRole('button',{name:'Verificar próxima declaração'}).click();
 await expect(screen.getByTestId('synthetic-container-progress')).toHaveText('1 de 3');
 await screen.getByRole('button',{name:'Cancelar simulação'}).click();
 await expect(screen.getByTestId('synthetic-container-status')).toHaveText('Cancelado');
 await expect(screen.getByTestId('synthetic-container-progress')).toHaveText('1 de 3');
 await expect(screen.getByRole('button',{name:'Verificar próxima declaração'})).toBeDisabled();
 await expect(screen.getByTestId('synthetic-container-bytes')).toHaveText('0');
});
test('reiniciar restaura o checkpoint zero sem restaurar operações',async({page})=>{
 const {screen,select}=await demo(page);
 await select.selectOption('traversal');
 const next=screen.getByRole('button',{name:'Verificar próxima declaração'});
 await next.click();await next.click();
 await expect(screen.getByTestId('synthetic-container-status')).toHaveText('Bloqueado');
 await screen.getByRole('button',{name:'Reiniciar exemplo'}).click();
 await expect(screen.getByTestId('synthetic-container-progress')).toHaveText('0 de 2');
 await expect(screen.getByTestId('synthetic-container-status')).toHaveText('Pendente de análise declarativa');
 await expect(next).toBeEnabled();
});
test('mouse e teclado controlam a simulação e nenhum nome privado é mostrado',async({page})=>{
 const {screen,select}=await demo(page);
 await select.focus();
 await page.keyboard.press('End');
 await page.keyboard.press('Tab');
 await expect(select).toHaveValue('cancel');
 const next=screen.getByRole('button',{name:'Verificar próxima declaração'});
 await expect(next).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(screen.getByTestId('synthetic-container-progress')).toHaveText('1 de 3');
 await expect(screen).not.toContainText('Vehicles/demo.bus');
 await expect(screen).not.toContainText('Textures/demo.dds');
});
test('layout não transborda em 390, 850 ou 1440 pixels',async({page})=>{
 const {screen}=await demo(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  await expect(screen).toBeVisible();
  const data=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   const nodes=[...document.querySelectorAll('.synthetic-container,.synthetic-container-counts>div,.synthetic-container-controls button,.synthetic-container>label select')];
   return {viewport,overflow:document.documentElement.scrollWidth-viewport,
    rects:nodes.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})};
  });
  expect(data.overflow).toBeLessThanOrEqual(3);
  for(const r of data.rects){expect(r.left).toBeGreaterThanOrEqual(-3);expect(r.right).toBeLessThanOrEqual(data.viewport+3);expect(r.height).toBeGreaterThan(12);}
 }
});
test('simular triagem não registra instalação nem habilita operações reais',async({page})=>{
 const {screen}=await demo(page);
 await screen.getByRole('button',{name:'Verificar próxima declaração'}).click();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
