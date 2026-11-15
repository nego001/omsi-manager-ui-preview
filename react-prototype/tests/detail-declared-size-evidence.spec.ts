import {test,expect,type Page} from '@playwright/test';

const mods=[
 {id:'known',title:'Ônibus Binário',game:'omsi',category:'Ônibus',version:'1',
  description:'Veículo fictício para testes.',size:'1 GiB'},
 {id:'unknown',title:'Mapa Sem Medida',game:'omsi',category:'Mapas',version:'1',
  description:'Mapa fictício para testes.',size:'n/a'},
 {id:'zero',title:'Som Declarado Zero',game:'omsi',category:'Sons',version:'1',
  description:'Som fictício para testes.',size:'0 B'}
];
async function catalog(page:Page){
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles({
  name:'evidencia-de-tamanho.json',mimeType:'application/json',
  buffer:Buffer.from(JSON.stringify({schemaVersion:1,mods}))
 });
 await expect(page.getByText('Origem: Importado: evidencia-de-tamanho.json')).toBeVisible();
 return nav;
}
test('Detalhes atualiza a interpretação para conhecido, desconhecido e zero em Anterior/Próximo',async({page})=>{
 await catalog(page);
 await page.getByRole('button',{name:'Ônibus Binário',exact:true}).click();
 const note=page.getByRole('note',{name:'Qualidade do tamanho declarado'});
 await expect(note).toContainText('Tamanho reconhecido');
 await expect(note).toContainText('Equivalência decimal aproximada informada pelo catálogo: ≈ 1,07 GB.');
 await expect(note).toContainText('Sem medição de disco');
 const nav=page.getByRole('navigation',{name:'Navegar pelos mods da lista atual'});
 await nav.getByRole('button',{name:'Próximo mod: Mapa Sem Medida'}).click();
 await expect(page.getByRole('heading',{name:'Mapa Sem Medida'})).toBeFocused();
 await expect(note).toContainText('Formato não reconhecido');
 await expect(note).toContainText('Desconhecido não significa 0 B');
 await expect(note).not.toContainText('Equivalência decimal aproximada');
 await nav.getByRole('button',{name:'Próximo mod: Som Declarado Zero'}).click();
 await expect(note).toContainText('Zero declarado');
 await expect(note).toContainText('O catálogo declarou 0 B');
 await expect(note).toContainText('não comprova');
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('Detalhes da demonstração não afirma que metadados são dados de pacote real',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 const note=page.getByRole('note',{name:'Qualidade do tamanho declarado'});
 await expect(note).toContainText('Exemplo fictício');
 await expect(note).toContainText('Sem medição de disco');
 await expect(page.getByRole('region',{name:'Etapas de verificação do mod'})).toBeVisible();
});
test('filtro de desconhecidos leva à nota correspondente em Detalhes sem perder favoritos no celular',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 const nav=await catalog(page);
 for(const m of mods){
  const card=page.locator('.mod-card').filter({has:page.getByRole('button',{name:m.title,exact:true})});
  await card.getByRole('button',{name:'Favoritar'}).click();
 }
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const unknown=page.getByRole('group',{name:'Filtrar por tamanho declarado'})
  .getByRole('button',{name:'Só tamanhos desconhecidos'});
 await unknown.click();
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await page.getByRole('button',{name:'Mapa Sem Medida',exact:true}).click();
 await expect(page.getByRole('note',{name:'Qualidade do tamanho declarado'}))
  .toContainText('Formato não reconhecido');
 await page.getByRole('button',{name:'Voltar à biblioteca'}).click();
 await expect(unknown).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('1 favorito exibido')).toBeVisible();
 await expect(page.getByRole('region',{name:'Resumo da biblioteca'})).toContainText('3');
 const overflow=await page.evaluate(()=>Math.max(0,
  document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
