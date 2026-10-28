import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// Node runs this test directly; do not rely on Vite's JSON import transform.
const examples: Array<{
 id:string;label:string;fixtureCount:number;declared:number;withinOwn:number;
 otherCandidate:number;unresolved:number;unsafe:number;unsupported:number;
}>=JSON.parse(readFileSync(fileURLToPath(
 new URL('../src/fixture-cross-package-examples.json',import.meta.url)),'utf8'));

test('exemplos estáticos sempre são contagens coerentes e não possuem capacidades reais',()=>{
 expect(examples.map(x=>x.id)).toEqual(['matched','absent','unsafe']);
 for(const item of examples){
  expect(item.fixtureCount).toBe(2);
  expect(item.withinOwn+item.otherCandidate+item.unresolved+
   item.unsafe+item.unsupported).toBe(item.declared);
  expect(Object.keys(item).sort()).toEqual([
   'declared','fixtureCount','id','label','otherCandidate',
   'unsafe','unresolved','unsupported','withinOwn'
  ].sort());
 }
});
test('Biblioteca mostra os três relatórios exemplificativos, sem permitir instalação',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const panel=page.getByRole('region',{name:'Comparação demonstrativa entre ZIPs'});
 await expect(panel).toBeVisible();
 await panel.getByText('Comparar dependências em ZIPs fictícios').click();
 await expect(panel).toContainText('Nenhum ZIP é aberto nesta tela');
 const chooser=panel.getByRole('combobox',{name:'Cenário de referências entre ZIPs'});
 const count=(id:string)=>panel.locator('dd[data-key="'+id+'"]');
 await expect(count('otherCandidate')).toHaveText('1');
 await expect(count('withinOwn')).toHaveText('1');
 await chooser.selectOption('absent');
 await expect(count('otherCandidate')).toHaveText('0');
 await expect(count('unresolved')).toHaveText('2');
 await chooser.selectOption('unsafe');
 await expect(count('unsafe')).toHaveText('2');
 await expect(count('unsupported')).toHaveText('1');
 await expect(panel).toContainText('Referência candidata não significa mod instalado');
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
