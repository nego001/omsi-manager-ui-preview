import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {buildFixtureTriage} from '../src/fixture-diagnostic-guidance';
import {buildFixtureCoverage} from '../src/fixture-evidence-coverage';
// Node runs this test directly; do not rely on Vite's JSON import transform.
const examples: Array<{
 id:string;label:string;fixtureCount:number;declared:number;withinOwn:number;
 otherCandidate:number;ambiguous:number;unresolved:number;unsafe:number;unsupported:number;
 inspectedSources:number;notInspectedSources:number;
}>=JSON.parse(readFileSync(fileURLToPath(
 new URL('../src/fixture-cross-package-examples.json',import.meta.url)),'utf8'));

test('exemplos estáticos sempre são contagens coerentes e não possuem capacidades reais',()=>{
 expect(examples.map(x=>x.id)).toEqual(['matched','absent','ambiguous','unsafe','uninspected']);
 for(const item of examples){
  expect(item.fixtureCount).toBe(item.id==='ambiguous'?3:2);
  expect(item.withinOwn+item.otherCandidate+item.ambiguous+item.unresolved+
   item.unsafe+item.unsupported).toBe(item.declared);
  expect(Object.keys(item).sort()).toEqual([
   'ambiguous','declared','fixtureCount','id','inspectedSources',
   'label','notInspectedSources','otherCandidate','unsafe','unresolved',
   'unsupported','withinOwn'
  ].sort());
 }
});
test('triagem de ZIPs fictícios ordena alertas e recusa permissões implícitas',()=>{
 const expectations={
  matched:['otherCandidate','withinOwn'],
  absent:['unresolved'],
  ambiguous:['ambiguous'],
  unsafe:['unsafe','unsupported'],
  uninspected:[]
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
test('matriz separa cobertura fictícia, lacunas e verificação real indisponível',()=>{
 const expected={
  matched:['gate','candidate','real-reader'],
  absent:['gate','missing','real-reader'],
  ambiguous:['gate','ambiguous','real-reader'],
  unsafe:['gate','unsafe','unsupported','real-reader'],
  uninspected:['gate','text-limit','real-reader']
 };
 for(const example of examples){
  const report=buildFixtureCoverage(example);
  expect(report.actions.map(x=>x.id)).toEqual(
   expected[example.id as keyof typeof expected]);
  expect(report.realFilesInspected).toBe(false);
  expect(report.gameCompatibilityVerified).toBe(false);
  expect(report.dependencyVerificationComplete).toBe(false);
  expect(report.installAllowed).toBe(false);
  expect(report.source).toBe('python-ci-created-zip-bytes');
  expect(Object.isFrozen(report.actions)).toBe(true);
  expect(report.actions.every(step=>Object.isFrozen(step))).toBe(true);
  expect(report.unknownReferencesPossible).toBe(example.id==='uninspected');
 }
 expect(()=>buildFixtureCoverage({...examples[0],notInspectedSources:-1}))
  .toThrow('FIXTURE_COVERAGE_INVALID');
 expect(()=>buildFixtureCoverage({...examples[0],inspectedSources:1000}))
  .toThrow('FIXTURE_COVERAGE_INVALID');
 expect(()=>buildFixtureCoverage({...examples[0],declared:999}))
  .toThrow('FIXTURE_TRIAGE_INVALID');
});
test('Biblioteca mostra cinco cenários, incluindo lacunas sem instalação',async({page})=>{
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
 const coverage=panel.getByRole('region',{name:'Cobertura das evidências fictícias'});
 await expect(advice).toBeVisible();
 await expect(coverage).toBeVisible();
 await expect(coverage.locator('[data-coverage="inspected"]')).toHaveText('3');
 await expect(coverage.locator('[data-coverage="notInspected"]')).toHaveText('0');
 await expect(coverage.locator('[data-evidence-step="gate"]')).toContainText('Observado apenas na CI');
 await expect(advice.locator('[data-diagnostic-kind="otherCandidate"]')).toHaveCount(1);
 await expect(advice).toContainText('Origem: exemplos ZIP gerados na CI Python');
 await expect(count('otherCandidate')).toHaveText('1');
 await expect(count('withinOwn')).toHaveText('1');
 await chooser.selectOption('absent');
 await expect(advice.locator('[data-diagnostic-kind="unresolved"]')).toHaveCount(1);
 await expect(advice).toContainText('Pode haver dependência fora da amostra');
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
 await expect(coverage.locator('[data-evidence-step="unsafe"]')).toHaveCount(1);
 await expect(advice.locator('[data-diagnostic-kind="unsafe"]')).toHaveCount(1);
 await expect(advice).toContainText('Não é prova de malware.');
 await chooser.selectOption('uninspected');
 await expect(count('otherCandidate')).toHaveText('0');
 await expect(coverage.locator('[data-coverage="inspected"]')).toHaveText('0');
 await expect(coverage.locator('[data-coverage="notInspected"]')).toHaveText('1');
 await expect(coverage).toContainText('Zero referências encontradas não significa ausência de dependências');
 await expect(coverage.locator('[data-evidence-step="text-limit"]')).toHaveCount(1);
 await expect(coverage.locator('[data-evidence-step="real-reader"]')).toHaveCount(1);
 await expect(panel).toContainText('Nenhuma referência candidata significa mod instalado');
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
