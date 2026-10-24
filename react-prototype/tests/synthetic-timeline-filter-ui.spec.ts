import {test,expect} from '@playwright/test';
async function setup(page:import('@playwright/test').Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 return page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
}
test('combobox acessível traz as quatro modalidades corretas de filtro',async({page})=>{
 const lab=await setup(page);
 const select=lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'});
 await expect(select).toHaveValue('all');
 await expect(select.locator('option')).toHaveCount(4);
 await expect(lab.getByTestId('synthetic-filter-count')).toContainText('21 de 21');
});
test('mudança declarada mostra quatro afetados, preservando as revisões sem matches',async({page})=>{
 const lab=await setup(page);
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 await lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'}).selectOption('changed');
 await expect(lab.locator('.synthetic-diag-timeline>li')).toHaveCount(2);
 const old=lab.locator('.synthetic-diag-timeline>li[data-revision="1"]');
 await old.locator('.synthetic-diag-revision>summary').click();
 await expect(old.getByText('Nenhum especialista corresponde a este filtro nesta revisão.',{exact:false})).toBeVisible();
 const current=lab.locator('.synthetic-diag-timeline>li[data-current="true"]');
 await expect(current.locator('.synthetic-diag-modules>li')).toHaveCount(4);
 await expect(lab.getByTestId('synthetic-current-state')).toHaveText('Reanálise pendente');
 await expect(lab.getByTestId('synthetic-filter-count')).toContainText('4 de 14');
});
test('filtro pendente inclui módulo de áudio ausente e mantém contagens globais',async({page})=>{
 const lab=await setup(page);
 await lab.getByRole('button',{name:'3. Áudio não analisado'}).click();
 await lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'}).selectOption('pending');
 const current=lab.locator('.synthetic-diag-timeline>li[data-current="true"]');
 await expect(current.locator('.synthetic-diag-modules>li')).toHaveCount(1);
 await expect(current.locator('.synthetic-diag-modules>li[data-status="missing"]')).toHaveCount(1);
 await expect(lab.getByTestId('synthetic-filter-count')).toContainText('1 de 14');
 await expect(lab.getByTestId('synthetic-current-state')).toHaveText('Incompleto');
});
test('bloqueados sem exemplos conservam todos os títulos e exibem estado vazio honesto',async({page})=>{
 const lab=await setup(page);
 await lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'}).selectOption('blocked');
 await expect(lab.locator('.synthetic-diag-timeline>li')).toHaveCount(3);
 await expect(lab.getByTestId('synthetic-filter-count')).toContainText('0 de 21');
 const current=lab.locator('.synthetic-diag-timeline>li[data-current="true"]');
 await expect(current.getByText(/Nenhum especialista corresponde a este filtro nesta revisão/)).toBeVisible();
 await expect(current.getByText('Revisão 3 · Reanálise pendente')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});
test('filtro persiste ao trocar cenário e não restaura sugestão de jogo antiga',async({page})=>{
 const lab=await setup(page);
 const select=lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'});
 await select.selectOption('pending');
 await lab.getByRole('button',{name:'1. Análise inicial'}).click();
 await expect(select).toHaveValue('pending');
 await expect(lab.getByTestId('synthetic-filter-count')).toContainText('0 de 7');
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 await expect(select).toHaveValue('pending');
 await expect(lab.getByTestId('synthetic-filter-count')).toContainText('7 de 14');
 await expect(lab.locator('.synthetic-diag-summary').getByText('Não identificado',{exact:true})).toBeVisible();
});
test('seletor pode ser alterado com teclado e mantém botões de instalar/remover bloqueados',async({page})=>{
 const lab=await setup(page);
 const select=lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'});
 await select.focus();
 await page.keyboard.press('End');
 await page.keyboard.press('Tab');
 await expect(select).toHaveValue('changed');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('seletor e revisões cabem em 390, 850, 1440 pixels sem rolagem horizontal',async({page})=>{
 const lab=await setup(page);
 await lab.getByRole('combobox',{name:'Filtrar especialistas fictícios'}).selectOption('changed');
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:850});
  const r=await page.evaluate(()=>{
   const w=document.documentElement.clientWidth;
   const boxes=[...document.querySelectorAll('.synthetic-diag-filter-bar,.synthetic-diag-filter-bar select,.synthetic-diag-timeline>li')]
     .map(el=>{const rect=el.getBoundingClientRect();return [rect.left,rect.right]});
   return {w,overflow:document.documentElement.scrollWidth-w,boxes};
  });
  expect(r.overflow).toBeLessThanOrEqual(3);
  for(const [left,right] of r.boxes){expect(left).toBeGreaterThanOrEqual(-3);expect(right).toBeLessThanOrEqual(r.w+3);}
 }
});
