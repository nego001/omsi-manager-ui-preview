import {test,expect} from '@playwright/test';
import {projectCiFdFixtureEvidence} from '../src/fixture-ci-fd-evidence';

const blank=()=>({
 declared:0,insideOwnFixture:0,candidateInOtherFixture:0,
 ambiguousAcrossFixtures:0,notFoundInProvidedFixtures:0,
 unsafePath:0,unsupportedHint:0
});
const hints=()=>({model:blank(),mesh:blank(),texture:blank(),sound:blank()});
function validEnvelope(){
 const first=hints();
 first.model.declared=1;first.model.ambiguousAcrossFixtures=1;
 first.mesh.declared=1;first.mesh.candidateInOtherFixture=1;
 first.texture.declared=1;first.texture.notFoundInProvidedFixtures=1;
 return {
  inputSource:'ci-created-open-readonly-file-descriptors',
  mode:'ci-disposable-zip-file-crosscheck',
  inputCount:3,
  report:{
   mode:'memory-fixture-cross-check-only',fixtureCount:3,
   slots:[
    {fixtureSlot:1,inspectedDefinitionSources:1,
     notInspectedDefinitionSources:0,hints:first},
    {fixtureSlot:2,inspectedDefinitionSources:1,
     notInspectedDefinitionSources:0,hints:hints()},
    {fixtureSlot:3,inspectedDefinitionSources:1,
     notInspectedDefinitionSources:0,hints:hints()}
   ],
   declaredHintCount:3,
   realPackagesRead:false,realDependenciesVerified:false,
   crossPackageCandidatesVerified:false,gameCompatibilityVerified:false,
   installationEnabled:false,filesystemAccessEnabled:false
  },
  osSandboxVerified:false,fdOriginAuthenticated:false,
  realUserModsInspected:false,gameCompatibilityVerified:false,
  installationEnabled:false,writesPerformed:false
 };
}

test('converte evidência de arquivos fictícios em relatórios individuais anônimos',()=>{
 const projection=projectCiFdFixtureEvidence(validEnvelope());
 expect(projection.origin).toBe('ci-disposable-zip-files');
 expect(projection.fixtureCount).toBe(3);
 expect(projection.reports.map(x=>x.status)).toEqual([
  'needs-human-review','no-known-references','no-known-references'
 ]);
 expect(projection.reports[0].counts).toMatchObject({
  ambiguous:1,otherCandidate:1,unresolved:1,
  withinOwn:0,unsafe:0,unsupported:0
 });
 expect(Object.values(projection.reports[0].counts).reduce((a,b)=>a+b,0)).toBe(3);
 expect(projection.filesFromUserInspected).toBe(false);
 expect(projection.osSandboxVerified).toBe(false);
 expect(projection.canInstall).toBe(false);
 expect(Object.isFrozen(projection)).toBe(true);
 expect(Object.isFrozen(projection.reports)).toBe(true);
 for(const slot of projection.reports){
  expect(slot.verification).toBe('test-fixture-only');
  expect(slot.checkedRealFiles).toBe(false);
  expect(slot.dependenciesVerified).toBe(false);
  expect(slot.compatibilityVerified).toBe(false);
  expect(slot.canInstall).toBe(false);
 }
});

test('recusa indicadores positivos de sandbox, instalação ou leitura de mods reais',()=>{
 const base=validEnvelope();
 for(const flag of ['osSandboxVerified','fdOriginAuthenticated',
  'realUserModsInspected','gameCompatibilityVerified',
  'installationEnabled','writesPerformed'] as const){
  expect(()=>projectCiFdFixtureEvidence({...base,[flag]:true}))
   .toThrow('CI_FD_EVIDENCE_REFUSED');
 }
 for(const flag of ['realPackagesRead','realDependenciesVerified',
  'crossPackageCandidatesVerified','gameCompatibilityVerified',
  'installationEnabled','filesystemAccessEnabled'] as const){
  expect(()=>projectCiFdFixtureEvidence({
   ...base,report:{...base.report,[flag]:true}
  })).toThrow('CI_FD_EVIDENCE_REFUSED');
 }
});

test('recusa números adulterados, slots ausentes e campos capazes de vazar paths',()=>{
 const base=validEnvelope();
 for(const invalid of [
  {...base,inputCount:2},
  {...base,privatePath:'/home/secret/mod.zip'},
  {...base,report:{...base.report,declaredHintCount:4}},
  {...base,report:{...base.report,slots:base.report.slots.slice(1)}},
  {...base,report:{...base.report,slots:[
   {...base.report.slots[0],fixtureSlot:2},...base.report.slots.slice(1)]}},
  {...base,report:{...base.report,slots:[
   {...base.report.slots[0],hints:{
    ...base.report.slots[0].hints,
    model:{...base.report.slots[0].hints.model,
     candidateInOtherFixture:1}
   }},...base.report.slots.slice(1)]}},
  {...base,report:{...base.report,slots:[
   {...base.report.slots[0],hostPath:'C:/private/mod.zip'},
   ...base.report.slots.slice(1)]}},
  {...base,report:{...base.report,slots:[
   {...base.report.slots[0],inspectedDefinitionSources:Infinity},
   ...base.report.slots.slice(1)]}}
 ]){
  expect(()=>projectCiFdFixtureEvidence(invalid))
   .toThrow('CI_FD_EVIDENCE_REFUSED');
 }
});
