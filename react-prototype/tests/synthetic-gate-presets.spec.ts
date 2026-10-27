import {test,expect} from '@playwright/test';
import {GATE_DEMO_PRESETS,runSyntheticGateDemo} from '../src/synthetic-gate-presets';
test('gate sintético não confunde índice fictício com pacote real verificado',()=>{
 const accepted=runSyntheticGateDemo('regular');
 expect(accepted.state).toBe('index-created-review-incomplete');
 expect(accepted.indexedEntries).toBe(3);
 expect(accepted.reason).toBe('missing-module');
 expect(accepted.gateSimulatedOnly).toBe(true);
 expect(accepted.specialistsActuallyRun).toBe(0);
 for(const key of ['realPackageRead','realDigestVerified','installationVerified',
  'compatibilityVerified','operationsEnabled'] as const)
  expect(accepted[key]).toBe(false);
 expect(Object.isFrozen(accepted)).toBe(true);
});
test('traversal, link, duplicação, expansão e estrutura quebrada não criam índice',()=>{
 const outcomes={
  traversal:'unsafe-entry',symlink:'unsafe-entry',collision:'unsafe-entry',
  expansion:'resource-limit',broken:'malformed-entry'
 };
 for(const [id,reason] of Object.entries(outcomes)){
  const result=runSyntheticGateDemo(id as 'traversal');
  expect(result.state,id).toBe('rejected');
  expect(result.reason,id).toBe(reason);
  expect(result.indexedEntries,id).toBe(0);
  expect(result.operationsEnabled).toBe(false);
  expect(result.realPackageRead).toBe(false);
 }
 expect(()=>runSyntheticGateDemo('fake' as 'regular')).toThrow('GATE_DEMO_PRESET_REFUSED');
 expect(GATE_DEMO_PRESETS).toHaveLength(6);
});
test('Biblioteca explica gate fictício sem acessar mods nem habilitar instalação',async({page})=>{
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 const lab=page.getByRole('region',{name:'Laboratório de pacotes fictícios'});
 await expect(lab).toBeVisible();
 await lab.getByText('Experimentar verificações de segurança com pacotes fictícios').click();
 await expect(lab.getByText('Índice fictício criado · análise incompleta')).toBeVisible();
 await expect(lab).toContainText('Digest não verificado');
 const chooser=lab.getByRole('combobox',{name:'Escolher exemplo de pacote fictício'});
 await chooser.selectOption('traversal');
 await expect(lab.getByText('Entrada fictícia recusada')).toBeVisible();
 await expect(lab).toContainText('nenhum especialista real executado');
 await chooser.selectOption('expansion');
 await expect(lab).toContainText('limite fictício de expansão');
 await nav.getByRole('button',{name:'Detalhes'}).click();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
