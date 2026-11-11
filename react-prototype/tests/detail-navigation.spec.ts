import {test,expect} from '@playwright/test';

const navName='Navegação principal';

test('Detalhes percorre apenas mods OMSI filtrados no catálogo, com foco acessível',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:navName});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'OMSI 2',exact:true}).click();
 await page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true}).click();
 const scope=page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'});
 await expect(scope).toContainText('1 de 3 · Catálogo');
 await expect(scope.getByRole('button',{name:'Sem mod anterior'})).toBeDisabled();
 await scope.getByRole('button',{name:'Próximo mod: Serra do Vale'}).click();
 await expect(page.getByRole('heading',{name:'Serra do Vale',exact:true})).toBeFocused();
 await expect(scope).toContainText('2 de 3 · Catálogo');
 await scope.getByRole('button',{name:'Próximo mod: Pacote de Sons'}).click();
 await expect(page.getByRole('heading',{name:'Pacote de Sons',exact:true})).toBeFocused();
 await expect(scope.getByRole('button',{name:'Sem próximo mod'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar ao catálogo'}).click();
 await expect(page.getByRole('button',{name:'Pacote de Sons',exact:true})).toBeFocused();
 await expect(page.getByRole('button',{name:'Caminhão Rodoviário',exact:true})).toHaveCount(0);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('Detalhes respeita favoritos e filtros da Biblioteca, inclusive remoção em outra tela',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:navName});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 for(const title of ['Ônibus Urbano Clássico','Serra do Vale','Caminhão Rodoviário']){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const filter=page.getByRole('combobox',{name:'Filtrar jogo na biblioteca'});
 await filter.selectOption('omsi');
 const bus=page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true});
 await bus.click();
 const scope=page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'});
 await expect(scope).toContainText('1 de 2 · Biblioteca');
 await scope.getByRole('button',{name:'Próximo mod: Serra do Vale'}).click();
 await expect(page.getByRole('heading',{name:'Serra do Vale',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Remover dos favoritos',exact:true}).click();
 await expect(scope).toContainText('Fora dos filtros atuais · Biblioteca');
 await expect(scope.getByRole('button',{name:'Sem mod anterior'})).toBeDisabled();
 await expect(scope.getByRole('button',{name:'Sem próximo mod'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 // The removed mod has no card to restore. Keyboard focus now returns to the
 // first still-visible favorite instead of the generic main container.
 await expect(bus).toBeFocused();
 await expect(filter).toHaveValue('omsi');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(bus).toBeVisible();
 await expect(page.getByRole('button',{name:'Caminhão Rodoviário',exact:true})).toHaveCount(0);
});

test('Detalhes iniciados nos Destaques não atravessam os sete mods do catálogo',async({page})=>{
 await page.setViewportSize({width:850,height:820});
 await page.goto('/');
 const first=page.getByRole('button',{name:'Ônibus Urbano Clássico',exact:true});
 await first.click();
 const scope=page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'});
 await expect(scope).toContainText('1 de 4 · Destaques');
 await scope.getByRole('button',{name:'Próximo mod: Serra do Vale'}).click();
 await scope.getByRole('button',{name:'Próximo mod: Pacote de Sons'}).click();
 await scope.getByRole('button',{name:'Próximo mod: Caminhão Rodoviário'}).click();
 await expect(scope.getByRole('button',{name:'Sem próximo mod'})).toBeDisabled();
 await expect(page.getByRole('heading',{name:'Caminhão Rodoviário',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Voltar ao início'}).click();
 await expect(page.getByRole('button',{name:'Caminhão Rodoviário',exact:true})).toBeFocused();
});
