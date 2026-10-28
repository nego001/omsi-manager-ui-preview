import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildFixtureTriage} from '../src/fixture-diagnostic-guidance';
// Node runs this test directly; do not rely on Vite's JSON import transform.
const examples: Array<{
 id:string;label:string;fixtureCount:number;declared:number;withinOwn:number;
 otherCandidate:number;ambiguous:number;unresolved:number;unsafe:number;unsupported:number;
}>=JSON.parse(readFileSync(fileURLToPath(
 new URL('../src/fixture-cross-package-examples.json',import.meta.url)),'utf8'));

test('exemplos estáticos sempre são contagens coerentes e não possuem capacidades reais',()=>{
 expect(examples.map(x=>x.id)).toEqual(['matched','absent','ambiguous','unsafe']);
 for(const item of examples){
  expect(item.fixtureCount).toBe(item.id==='ambiguous'?3:2);
  expect(item.withinOwn+item.otherCandidate+item.ambiguous+item.unresolved+
   item.unsafe+item.unsupported).toBe(item.declared);
  expect(Object.keys(item).sort()).toEqual([
   'ambiguous','declared','fixtureCount','id','label','otherCandidate',
   'unsafe','unresolved','unsupported','withinOwn'
  ].sort());
 }
});
test('triagem de ZIPs fictícios ordena alertas e recusa permissões implícitas',()=>{
 const expectations={
  matched:['otherCandidate','withinOwn'],
  absent:['unresolved'],
  ambiguous:['ambiguous'],
  unsafe:['unsafe','unsupported']
 };
 for(const example of examples){
  const report=buildFixtureTriage(example);
  expect(report.items.map(x=>x.category)).toEqual(
   expectations[example.id as keyof typeof expectations]);
  expect(report.state).toBe('demonstration-unverified');
  expect(report.source).toBe('python-ci-fixtures');
  expect(report.inspectedRealFiles).toBe(false);
  expect(report.dependenciesVerified).toBe(false);
  expect(report.compatibilityVerified).toBe(false);
  expect(report.canInstall).toBe(false);
  expect(Object.isFrozen(report)).toBe(true);
  expect(Object.isFrozen(report.items)).toBe(true);
  expect(report.items.every(x=>Object.isFrozen(x))).toBe(true);
 }
 const first=examples[0];
 for(const patch of [{declared:999},{unsafe:-1},{ambiguous:NaN},
  {fixtureCount:5},{declared:1.5},{withinOwn:1000}]){
  expect(()=>buildFixtureTriage({...first,...patch})).toThrow('FIXTURE_TRIAGE_INVALID');
 }
});
test('Biblioteca mostra quatro cenários, incluindo ambiguidade sem instalação',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const panel=page.getByRole('region',{name:'Comparação demonstrativa entre ZIPs'});
 await expect(panel).toBeVisible();
 await panel.getByText('Comparar dependências em ZIPs fictícios').click();
 await expect(panel).toContainText('Nenhum ZIP é aberto nesta tela');
 const chooser=panel.getByRole('combobox',{name:'Cenário de referências entre ZIPs'});
 const count=(id:string)=>panel.locator('dd[data-key="'+id+'"]');
 const advice=panel.getByRole('region',{name:'Orientações do cenário fictício'});
 await expect(advice).toBeVisible();
 await expect(advice.locator('[data-diagnostic-kind="otherCandidate"]')).toHaveCount(1);
 await expect(advice).toContainText('Origem: exemplos ZIP gerados na CI Python');
 await expect(count('otherCandidate')).toHaveText('1');
 await expect(count('withinOwn')).toHaveText('1');
 await chooser.selectOption('absent');
 await expect(advice.locator('[data-diagnostic-kind="unresolved"]')).toHaveCount(1);
 await expect(advice).toContainText('pode haver dependência fora da amostra');
 await expect(count('otherCandidate')).toHaveText('0');
 await expect(count('unresolved')).toHaveText('2');
 await chooser.selectOption('ambiguous');
 await expect(count('ambiguous')).toHaveText('1');
 await expect(advice.locator('[data-diagnostic-kind="ambiguous"]')).toHaveCount(1);
 await expect(advice).toContainText('não escolhe qual arquivo prevalecerá');
 await expect(count('otherCandidate')).toHaveText('0');
 await expect(panel).toContainText('3 pacotes fictícios');
 await expect(panel).toContainText('não escolhe');
 await chooser.selectOption('unsafe');
 await expect(count('ambiguous')).toHaveText('0');
 await expect(count('unsafe')).toHaveText('2');
 await expect(count('unsupported')).toHaveText('1');
 await expect(advice.locator('[data-diagnostic-kind="unsafe"]')).toHaveCount(1);
 await expect(advice).toContainText('Não é prova de malware.');
 await expect(panel).toContainText('Nenhuma referência candidata significa mod instalado');
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
