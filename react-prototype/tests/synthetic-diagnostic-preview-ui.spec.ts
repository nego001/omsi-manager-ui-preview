import {test,expect,type Page} from '@playwright/test';

async function openLab(page:Page){
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Histórico'}).click();
 return page.getByRole('region',{name:'Laboratório de diagnóstico fictício'});
}
test('histórico real segue vazio, demo separada informa que é fictícia',async({page})=>{
 const lab=await openLab(page);
 await expect(page.getByRole('heading',{name:'Histórico',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await expect(lab.getByRole('heading',{name:'Linha do tempo dos diagnósticos'})).toBeVisible();
 await expect(lab).toHaveAttribute('data-demo-only','true');
 await expect(lab.getByText(/Não representa análises dos seus mods/)).toBeVisible();
 await expect(lab.getByText(/O histórico real de atividades acima permanece vazio/)).toBeVisible();
 await expect(lab.getByText(/Instalar, remover, atualizar e editar continuam indisponíveis/)).toBeVisible();
 await expect(page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button')).toHaveCount(9);
});
test('etapa inicial exibe candidato apenas fictício e sete relatórios declarados',async({page})=>{
 const lab=await openLab(page);
 await lab.getByRole('button',{name:'1. Análise inicial'}).click();
 await expect(lab.getByTestId('synthetic-current-state')).toHaveText('Candidato fictício');
 await expect(lab.getByText('OMSI 2 · fictício')).toBeVisible();
 const rev=lab.locator('.synthetic-diag-timeline>li[data-revision="1"]');
 await expect(rev.locator('.synthetic-diag-modules>li')).toHaveCount(7);
 await expect(rev.locator('.synthetic-diag-modules>li[data-status="ok"]')).toHaveCount(7);
 await expect(lab.getByText('7/7 relatórios fictícios OK')).toBeVisible();
});
test('pintura alterada invalida candidato anterior e destaca só módulos prioritários',async({page})=>{
 const lab=await openLab(page);
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 await expect(lab.getByTestId('synthetic-current-state')).toHaveText('Reanálise pendente');
 await expect(lab.locator('.synthetic-diag-summary').getByText('7 de 7',{exact:true})).toBeVisible();
 const current=lab.locator('.synthetic-diag-timeline>li[data-current="true"]');
 await expect(current).toHaveAttribute('data-revision','2');
 await expect(current.locator('.synthetic-diag-modules>li[data-status="pending"]')).toHaveCount(7);
 await expect(current.getByText('Reanálise prioritária')).toHaveCount(4);
 await expect(current.getByText('Aguardando nova análise')).toHaveCount(3);
 await expect(lab.locator('.synthetic-diag-timeline>li[data-superseded="true"]')).toHaveCount(1);
 await expect(lab.locator('.synthetic-diag-summary').getByText('Não identificado',{exact:true})).toBeVisible();
});
test('áudio não analisado continua ausente, sem transformar relatório em instalação',async({page})=>{
 const lab=await openLab(page);
 await lab.getByRole('button',{name:'3. Áudio não analisado'}).click();
 await expect(lab.getByTestId('synthetic-current-state')).toHaveText('Incompleto');
 const current=lab.locator('.synthetic-diag-timeline>li[data-current="true"]');
 const audio=current.locator('.synthetic-diag-modules>li').filter({has:page.getByText('Áudio',{exact:true})});
 await expect(audio).toHaveAttribute('data-status','missing');
 await expect(audio.getByText('Relatório não recebido')).toBeVisible();
 await audio.getByText('Entender este estado').click();
 await expect(audio.getByText(/Ausência não significa aprovação/)).toBeVisible();
 await expect(lab.locator('.synthetic-diag-summary').getByText('Não identificado',{exact:true})).toBeVisible();
});
test('nova revisão de som exibe três revisões e permanece pendente',async({page})=>{
 const lab=await openLab(page);
 await expect(lab.getByRole('button',{name:'4. Nova revisão de som'})).toHaveAttribute('aria-pressed','true');
 await expect(lab.locator('.synthetic-diag-timeline>li')).toHaveCount(3);
 await expect(lab.locator('.synthetic-diag-timeline>li[data-superseded="true"]')).toHaveCount(2);
 await expect(lab.locator('.synthetic-diag-timeline>li[data-current="true"]')).toHaveAttribute('data-revision','3');
 await expect(lab.getByTestId('synthetic-current-state')).toHaveText('Reanálise pendente');
 const current=lab.locator('.synthetic-diag-timeline>li[data-current="true"]');
 await expect(current.locator('.synthetic-diag-modules>li[data-status="pending"]')).toHaveCount(7);
});
test('botões e explicações funcionam pelo teclado sem alterar registros reais',async({page})=>{
 const lab=await openLab(page);
 const stage=lab.getByRole('button',{name:'2. Pintura alterada'});
 await stage.focus();
 await page.keyboard.press('Enter');
 await expect(stage).toHaveAttribute('aria-pressed','true');
 const current=lab.locator('.synthetic-diag-timeline>li[data-current="true"]');
 const explanation=current.locator('.synthetic-diag-modules>li').first().locator('details>summary');
 await explanation.focus();
 await page.keyboard.press('Enter');
 await expect(explanation.locator('..')).toHaveAttribute('open','');
 await expect(current.getByText(/O especialista ainda não forneceu observações/)).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
});
test('revisões antigas podem ser expandidas, mas não recuperam candidato atual',async({page})=>{
 const lab=await openLab(page);
 await lab.getByRole('button',{name:'2. Pintura alterada'}).click();
 const previous=lab.locator('.synthetic-diag-timeline>li[data-revision="1"]');
 await previous.locator('.synthetic-diag-revision>summary').click();
 await expect(previous.locator('.synthetic-diag-revision')).toHaveAttribute('open','');
 await expect(previous.getByText(/dado fictício.*não é a conclusão atual/)).toBeVisible();
 await expect(lab.getByTestId('synthetic-current-state')).toHaveText('Reanálise pendente');
});
test('laboratório cabe em 390, 850 e 1440 pixels sem vazamento lateral',async({page})=>{
 const lab=await openLab(page);
 for(const width of [390,850,1440]){
  await page.setViewportSize({width,height:844});
  await expect(lab).toBeVisible();
  const rects=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   return {viewport,overflow:document.documentElement.scrollWidth-viewport,
    rects:[...document.querySelectorAll('.synthetic-diag,.synthetic-diag-steps button,.synthetic-diag-summary>div,.synthetic-diag-timeline>li,.synthetic-diag-modules>li')].map(el=>{
     const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
    })}
  });
  expect(rects.overflow).toBeLessThanOrEqual(3);
  for(const r of rects.rects){
   expect(r.left).toBeGreaterThanOrEqual(-3);
   expect(r.right).toBeLessThanOrEqual(rects.viewport+3);
   expect(r.height).toBeGreaterThan(15);
  }
 }
});
test('saindo e voltando para histórico não modifica catálogo nem oferece escrita',async({page})=>{
 const lab=await openLab(page);
 await lab.getByRole('button',{name:'1. Análise inicial'}).click();
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await expect(lab.getByRole('heading',{name:'Linha do tempo dos diagnósticos'})).toBeVisible();
});
