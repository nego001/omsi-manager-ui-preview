import {test,expect} from '@playwright/test';
import {buildSyntheticPackageIndex,type SyntheticPackageIndex} from '../src/synthetic-package-index';
import {deriveSyntheticStructureHints} from '../src/synthetic-structure-hints';
import {runSyntheticIndexedWorkers} from '../src/synthetic-index-workers';

const digest='e'.repeat(64);
const file=(path:string)=>({
 path,kind:'file',encodedBytes:100,expandedBytes:300,declaredFormat:'well-formed'
});
function fixture(paths:string[]){
 const result=buildSyntheticPackageIndex(digest,paths.map(file));
 expect(result.status).toBe('ready');
 return result.index!;
}
test('pistas OMSI só usam raiz e sufixo estruturais do índice sintético',()=>{
 const index=fixture([
  'vehicles/model.bus','sceneryobjects/object.sco','splines/road.sli',
  'maps/map.cfg','mod/candidate.scs'
 ]);
 const out=deriveSyntheticStructureHints(index);
 expect(out.cues.map(cue=>cue.code)).toEqual([
  'omsi-vehicles-bus','omsi-sceneryobjects-sco','omsi-splines-sli'
 ]);
 expect(out.sharedScsFormatEntries).toBe(1);
 expect(out.stage).toBe('structural-hints-only');
 expect(out.gameVerified).toBe(false);
 expect(out.digestVerified).toBe(false);
 expect(out.compatibilityVerified).toBe(false);
 expect(out.realPackageRead).toBe(false);
 expect(out.operationsEnabled).toBe(false);
 expect(Object.isFrozen(out)).toBe(true);
 expect(Object.isFrozen(out.cues)).toBe(true);
 expect(Object.isFrozen(out.declaration.observations)).toBe(true);
});
test('pistas automáticas alimentam um único especialista e jamais aprovam destino ou instalação',()=>{
 const index=fixture(['vehicles/a.bus','sceneryobjects/b.sco']);
 const hints=deriveSyntheticStructureHints(index);
 const worker=runSyntheticIndexedWorkers(index,[hints.declaration]);
 expect(worker.status).toBe('incomplete');
 expect(worker.snapshot.state).toBe('incomplete');
 expect(worker.snapshot.candidateGame).toBeNull();
 expect(worker.snapshot.operationsEnabled).toBe(false);
 expect(worker.realPackageRead).toBe(false);
 expect(worker.reports.find(r=>r.moduleId==='structure')?.signals).toHaveLength(2);
});
test('SCS e SII compartilhados entre ETS2 e ATS nunca criam conclusão de jogo',()=>{
 const index=fixture(['mod/truck_ats.scs','def/vehicle.sii','mod/ETS2.scs']);
 const out=deriveSyntheticStructureHints(index);
 expect(out.sharedScsFormatEntries).toBe(3);
 expect(out.cues).toEqual([]);
 expect(out.declaration.observations).toEqual([]);
 const worker=runSyntheticIndexedWorkers(index,[out.declaration]);
 expect(worker.snapshot.candidateGame).toBeNull();
 expect(worker.snapshot.installationVerified).toBe(false);
});
test('sufixo BUS fora da raiz Vehicles não gera pista OMSI',()=>{
 const out=deriveSyntheticStructureHints(fixture(['other/a.bus','mod/vehicles.bus','maps/a.cfg']));
 expect(out.cues).toEqual([]);
});
test('mais de um BUS na mesma raiz produz no máximo uma observação por regra',()=>{
 const out=deriveSyntheticStructureHints(fixture([
  'vehicles/z.bus','vehicles/a.bus','vehicles/b.bus',
  'sceneryobjects/a.sco','sceneryobjects/b.sco'
 ]));
 expect(out.cues).toHaveLength(2);
 expect(out.declaration.observations).toHaveLength(2);
 expect(out.cues.map(cue=>cue.code)).toEqual(['omsi-vehicles-bus','omsi-sceneryobjects-sco']);
});
test('permutar entradas não altera a seleção das pistas nem revela caminhos',()=>{
 const paths=['vehicles/z.bus','vehicles/a.bus','splines/q.sli','def/test.sii'];
 const a=deriveSyntheticStructureHints(fixture(paths));
 const b=deriveSyntheticStructureHints(fixture([...paths].reverse()));
 expect(a.cues.map(x=>({code:x.code,handle:x.handle})))
  .toEqual(b.cues.map(x=>({code:x.code,handle:x.handle})));
 const output=JSON.stringify(a);
 for(const secret of ['z.bus','a.bus','q.sli','test.sii','vehicles/','def/']){
  expect(output).not.toContain(secret);
 }
});
test('índice forjado com mesmos dados não pode produzir declarações',()=>{
 const index=fixture(['vehicles/a.bus']);
 const forged=JSON.parse(JSON.stringify(index)) as SyntheticPackageIndex;
 expect(()=>deriveSyntheticStructureHints(forged)).toThrow('Projeção sintética inválida');
});
