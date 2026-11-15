import {test,expect,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const sample=readFileSync(resolve('examples/catalog.versions.example.json'),'utf8');
const file={name:'alertas-ficticios.json',mimeType:'application/json',buffer:Buffer.from(sample)};
async function favorite(page:Page,title:string){
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:title,exact:true})});
 await card.getByRole('button',{name:'Favoritar'}).click();
 await expect(card.getByRole('button',{name:'Retirar dos favoritos'})).toBeVisible();
}
async function prepare(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(file);
 for(const name of ['Biblioteca de áudio (exemplo)','Som de motor (exemplo)','Pintura demonstrativa'])await favorite(page,name);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 return nav;
}

test('atalho da Biblioteca abre diretamente a explicação do bloqueio declarado com foco',async({page})=>{
 const nav=await prepare(page);
 const state=page.getByRole('combobox',{name:'Filtrar alertas declarados'});
 await state.selectOption('blocking');
 const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Som de motor (exemplo)',exact:true})});
 await expect(card.getByText('Bloqueios declarados · não verificado')).toBeVisible();
 const action=card.getByRole('button',{name:'Ver diagnóstico de Som de motor (exemplo)'});
 await expect(action).toContainText('Consultar 2 alertas declarados');
 await action.click();
 await expect(page.getByRole('heading',{name:'Som de motor (exemplo)',exact:true})).toBeVisible();
 const report=page.getByRole('region',{name:'Simulação de dependências'});
 await expect(report).toBeFocused();
 await expect(report.locator('.relation-issues').getByText('Versão declarada da dependência abaixo do mínimo')).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(nav.getByRole('button',{name:'Minha biblioteca'})).toHaveAttribute('aria-current','page');
 await expect(state).toHaveValue('blocking');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
});

test('avisos declarados oferecem atalho, ausência de alertas não finge diagnóstico',async({page})=>{
 await prepare(page);
 const state=page.getByRole('combobox',{name:'Filtrar alertas declarados'});
 await state.selectOption('attention');
 const paint=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Pintura demonstrativa',exact:true})});
 await expect(paint.getByRole('button',{name:'Ver diagnóstico de Pintura demonstrativa'})).toBeVisible();
 await state.selectOption('no-issues');
 const clean=page.locator('.mod-card').filter({has:page.getByRole('button',{name:'Biblioteca de áudio (exemplo)',exact:true})});
 await expect(clean.getByText('Sem alertas declarados · não verificado')).toBeVisible();
 await expect(clean.getByRole('button',{name:/Ver diagnóstico/})).toHaveCount(0);
});

test('atalho funciona por teclado e não fica recortado no mobile',async({page})=>{
 await prepare(page);
 await page.setViewportSize({width:390,height:800});
 await page.getByRole('combobox',{name:'Filtrar alertas declarados'}).selectOption('blocking');
 const shortcut=page.getByRole('button',{name:'Ver diagnóstico de Som de motor (exemplo)'});
 await shortcut.focus();
 await expect(shortcut).toBeFocused();
 const rect=await shortcut.evaluate(el=>{
  const r=el.getBoundingClientRect();
  const s=getComputedStyle(el);
  return {left:r.left,right:r.right,viewport:document.documentElement.clientWidth,
   overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
   outline:s.outlineStyle};
 });
 expect(rect.left).toBeGreaterThanOrEqual(-3);
 expect(rect.right).toBeLessThanOrEqual(rect.viewport+3);
 expect(rect.overflow).toBeLessThanOrEqual(3);
 expect(rect.outline).not.toBe('none');
 await page.keyboard.press('Enter');
 await expect(page.getByRole('region',{name:'Simulação de dependências'})).toBeFocused();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});


test('índice do diagnóstico abre a orientação específica com foco pelo teclado',async({page})=>{
 await prepare(page);
 await page.getByRole('combobox',{name:'Filtrar alertas declarados'}).selectOption('blocking');
 await page.getByRole('button',{name:'Ver diagnóstico de Som de motor (exemplo)'}).click();
 const index=page.getByRole('navigation',{name:'Índice dos alertas declarados'});
 const shortcuts=index.getByRole('button',{name:/Abrir orientação do alerta/});
 await expect(shortcuts).toHaveCount(2);
 await shortcuts.first().focus();
 await page.keyboard.press('Enter');
 const explanation=page.locator('#relation-guide-0');
 await expect(explanation).toHaveAttribute('open','');
 await expect(explanation.locator('summary')).toBeFocused();
 await expect(explanation.getByText('Próxima verificação:')).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});

test('índice atualiza quando a hipótese de versão muda, sem declarar compatibilidade',async({page})=>{
 await prepare(page);
 await page.getByRole('button',{name:'Ver diagnóstico de Som de motor (exemplo)'}).click();
 const index=page.getByRole('navigation',{name:'Índice dos alertas declarados'});
 const shortcuts=index.getByRole('button',{name:/Abrir orientação do alerta/});
 await expect(shortcuts).toHaveCount(2);
 await page.getByRole('textbox',{name:'Versão hipotética do jogo'}).fill('1.52');
 await expect(shortcuts).toHaveCount(1);
 await expect(index).toContainText('Versão declarada da dependência abaixo do mínimo');
 await expect(page.getByText('Compatibilidade não verificada',{exact:true}).first()).toBeVisible();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});

test('retornar e reabrir um alerta limpa hipótese antiga e mantém contagem da biblioteca',async({page})=>{
 await prepare(page);
 await page.getByRole('button',{name:'Som de motor (exemplo)',exact:true}).click();
 await page.getByRole('textbox',{name:'Versão hipotética do jogo'}).fill('1.52');
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 const jump=page.getByRole('button',{name:'Ver diagnóstico de Som de motor (exemplo)'});
 await expect(jump).toContainText('Consultar 2 alertas declarados');
 await jump.click();
 await expect(page.getByRole('textbox',{name:'Versão hipotética do jogo'})).toHaveValue('');
 await expect(page.getByRole('navigation',{name:'Índice dos alertas declarados'}).getByRole('button',{name:/Abrir orientação do alerta/})).toHaveCount(2);
 await expect(page.getByRole('region',{name:'Simulação de dependências'})).toBeFocused();
});
