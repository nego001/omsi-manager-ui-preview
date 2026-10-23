import {test,expect} from '@playwright/test';

const screens=[
 ['Início','Seu universo de simulação, organizado.'],
 ['Jogos','Escolha seu simulador'],
 ['Catálogo de mods','Catálogo de mods'],
 ['Minha biblioteca','Minha biblioteca'],
 ['Detalhes','Ônibus Urbano Clássico'],
 ['Fila de tarefas','Fila de tarefas'],
 ['Histórico','Histórico'],
 ['Configurações','Configurações'],
 ['Segurança','Central de segurança']
] as const;

test('teclado abre salto direto para conteúdo principal',async({page})=>{
 await page.goto('/');
 const skip=page.getByRole('link',{name:'Pular para o conteúdo principal'});
 await page.keyboard.press('Tab');
 await expect(skip).toBeFocused();
 await expect(skip).toBeInViewport();
 await page.keyboard.press('Enter');
 await expect(page.locator('#conteudo-principal')).toBeFocused();
 await expect(page.getByRole('heading',{name:'Seu universo de simulação, organizado.'})).toBeVisible();
});

test('nove telas declaram uma única rota atual para leitores de tela',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 for(const [name,heading] of screens){
  const item=nav.getByRole('button',{name});
  await item.click();
  await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  await expect(item).toHaveAttribute('aria-current','page');
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
 }
});

test('botões de navegação preservam nomes acessíveis no menu compacto',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Alternar menu'}).click();
 await expect(page.locator('.sidebar')).toHaveClass(/collapsed/);
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Segurança'}).focus();
 await expect(nav.getByRole('button',{name:'Segurança'})).toBeFocused();
 await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Central de segurança'})).toBeVisible();
 await expect(nav.getByRole('button',{name:'Segurança'})).toHaveAttribute('aria-current','page');
});

test('controles de navegação e interação permanecem nas laterais visíveis',async({page})=>{
 await page.goto('/');
 await page.setViewportSize({width:850,height:650});
 for(const [name,heading] of screens){
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name}).click();
  await expect(page.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  const clipped=await page.evaluate(()=>{
   const viewport=document.documentElement.clientWidth;
   return [...document.querySelectorAll('button,input,select')].filter(el=>{
    const rect=el.getBoundingClientRect();
    const style=getComputedStyle(el);
    return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.display!=='none'&&
      (rect.left < -3 || rect.right > viewport+3);
   }).map(el=>({element:el.tagName,name:el.getAttribute('aria-label')??el.textContent?.slice(0,40),left:Math.round(el.getBoundingClientRect().left),right:Math.round(el.getBoundingClientRect().right)}));
  });
  expect(clipped, 'Controles cortados em '+name).toEqual([]);
 }
});

test('reduced motion desativa efeitos de deslocamento decorativos',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/');
 const transition=await page.locator('.game-tile').first().evaluate(el=>getComputedStyle(el).transitionDuration);
 expect(transition).toBe('0s');
});

test('atalho de pular não encobre a interface depois que o foco muda',async({page})=>{
 await page.goto('/');
 const skip=page.getByRole('link',{name:'Pular para o conteúdo principal'});
 await expect(skip).toHaveCSS('opacity','0');
 await page.keyboard.press('Tab');
 await expect(skip).toBeFocused();
 await expect(skip).toHaveCSS('opacity','1');
 await page.keyboard.press('Enter');
 await expect(page.locator('#conteudo-principal')).toBeFocused();
 await expect(skip).toHaveCSS('opacity','0');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Jogos'}).click();
 await expect(skip).toHaveCSS('opacity','0');
});
