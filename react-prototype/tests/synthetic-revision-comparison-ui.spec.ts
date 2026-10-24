import {test,expect,type Page} from '@playwright/test';

async function openDemo(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 return page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
}
test('etapa com revisão inicial informa que ainda não existe comparação disponível',async({page})=>{
 const lab=await openDemo(page);
 await lab.getByRole('button',{name:'1. Análise inicial'}).click();
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 await expect(pane.getByText('Apenas uma revisão disponível neste cenário.',{exact:false})).toBeVisible();
 await expect(pane.getByRole('combobox')).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});
test('pintura fictícia exibe comparação lado a lado das revisões 1 e 2',async({page})=>{
 const lab=await openDemo(page);
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 await expect(pane.getByRole('combobox',{name:'Revisão anterior'})).toHaveValue('1');
 await expect(pane.getByRole('combobox',{name:'Revisão posterior'})).toHaveValue('2');
 await expect(pane.getByTestId('synthetic-comparison-count')).toContainText('7 de 7');
 await expect(pane.locator('.synthetic-compare-list>li')).toHaveCount(7);
 await expect(pane.locator('.synthetic-compare-list>li[data-change="status-changed"]')).toHaveCount(7);
 await expect(pane.getByText('Candidato fictício',{exact:true})).toBeVisible();
 await expect(pane.getByText('Reanálise pendente')).toBeVisible();
});
test('comparação da reanálise incompleta destaca áudio ausente e conserva estados declarados iguais',async({page})=>{
 const lab=await openDemo(page);
 await lab.getByRole('button',{name:'3. Áudio não analisado'}).click();
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 await expect(pane.getByTestId('synthetic-comparison-count')).toContainText('5 de 7');
 const audio=pane.locator('.synthetic-compare-list>li[data-module="audio"]');
 await expect(audio.locator('[data-side="before"]')).toContainText('Relatório fictício recebido');
 await expect(audio.locator('[data-side="after"]')).toContainText('Ausente');
 await expect(pane.locator('.synthetic-compare-list>li[data-change="no-declared-change"]')).toHaveCount(2);
});
test('revisões 2 e 3 mostram áudio ausente que vira pendente sem aprovação implícita',async({page})=>{
 const lab=await openDemo(page);
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 await expect(pane.getByRole('combobox',{name:'Revisão anterior'})).toHaveValue('2');
 await expect(pane.getByRole('combobox',{name:'Revisão posterior'})).toHaveValue('3');
 const audio=pane.locator('.synthetic-compare-list>li[data-module="audio"]');
 await expect(audio.locator('[data-side="before"]')).toContainText('Ausente');
 await expect(audio.locator('[data-side="after"]')).toContainText('Pendente');
 await expect(pane.getByText(/nenhum resultado autoriza instalação/i)).toBeVisible();
});
test('seleção permite comparar revisões 1 e 3 mantendo resultados antigos históricos',async({page})=>{
 const lab=await openDemo(page);
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 await pane.getByRole('combobox',{name:'Revisão anterior'}).selectOption('1');
 await expect(pane.getByRole('combobox',{name:'Revisão anterior'})).toHaveValue('1');
 await expect(pane.getByRole('combobox',{name:'Revisão posterior'})).toHaveValue('3');
 await expect(pane.locator('.synthetic-compare-heads')).toContainText('OMSI 2');
 await expect(pane.locator('.synthetic-compare-heads')).toContainText('Não identificado');
 await expect(lab.getByTestId('synthetic-current-state')).toHaveText('Reanálise pendente');
});
test('trocar revisão posterior permite alterar a anterior sem comparar revisão com ela mesma',async({page})=>{
 const lab=await openDemo(page);
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 await pane.getByRole('combobox',{name:'Revisão anterior'}).selectOption('1');
 await pane.getByRole('combobox',{name:'Revisão posterior'}).selectOption('2');
 await expect(pane.getByRole('combobox',{name:'Revisão posterior'})).toHaveValue('2');
 await expect(pane.getByRole('combobox',{name:'Revisão anterior'}).locator('option')).toHaveCount(2);
 await expect(pane.getByRole('combobox',{name:'Revisão posterior'}).locator('option')).toHaveCount(2);
 await expect(pane.getByTestId('synthetic-comparison-count')).toContainText('5 de 7');
});
test('filtro bloqueados não remove nenhum dos sete módulos da comparação',async({page})=>{
 const lab=await openDemo(page);
 await lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'}).selectOption('blocked');
 await expect(lab.getByTestId('synthetic-filter-count')).toContainText('0 de 21');
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 await expect(pane.locator('.synthetic-compare-list>li')).toHaveCount(7);
 await expect(pane.getByTestId('synthetic-comparison-count')).toContainText('7 de 7');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});
test('controles de comparação podem ser usados por teclado',async({page})=>{
 const lab=await openDemo(page);
 const before=lab.getByRole('combobox',{name:'Revisão anterior'});
 await before.focus();
 await page.keyboard.press('Home');
 await page.keyboard.press('Tab');
 await expect(before).toHaveValue('1');
 await expect(lab.getByRole('combobox',{name:'Revisão posterior'})).toBeFocused();
});
test('etapas reduzidas limitam corretamente seleções e não exibem revisão inexistente',async({page})=>{
 const lab=await openDemo(page);
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 await pane.getByRole('combobox',{name:'Revisão anterior'}).selectOption('1');
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 await expect(pane.getByRole('combobox',{name:'Revisão anterior'})).toHaveValue('1');
 await expect(pane.getByRole('combobox',{name:'Revisão posterior'})).toHaveValue('2');
 await expect(pane.locator('.synthetic-compare-list>li')).toHaveCount(7);
});
test('larguras 390, 850 e 1440 acomodam ambas as colunas sem recorte horizontal',async({page})=>{
 const lab=await openDemo(page);
 const pane=lab.getByRole('region',{name:'Comparação fictícia de revisões'});
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:900});
  await expect(pane).toBeVisible();
  const data=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   const elements=[...document.querySelectorAll('.synthetic-compare,.synthetic-compare-controls select,.synthetic-compare-heads>div,.synthetic-compare-list>li,.synthetic-compare-pair>div')];
   return {viewport,overflow:document.documentElement.scrollWidth-viewport,
    rects:elements.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};})};
  });
  expect(data.overflow).toBeLessThanOrEqual(3);
  for(const rect of data.rects){expect(rect.left).toBeGreaterThanOrEqual(-3);expect(rect.right).toBeLessThanOrEqual(data.viewport+3);expect(rect.height).toBeGreaterThan(12);}
 }
});
test('instalação e remoção continuam desabilitadas após comparar revisões',async({page})=>{
 await openDemo(page);
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
