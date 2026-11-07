// Strict count-only bridge for CI-disposable ZIP files read through inherited FDs.
// NOT a runtime IPC, user-file picker, production sandbox or install permission.
// Reuses the existing per-package projector rather than implementing new triage.
import {projectFixtureSlots,type PerFixtureReport} from './fixture-per-package-report';

const kinds=['model','mesh','texture','sound'] as const;
const categories={
 declared:'declared',
 withinOwn:'insideOwnFixture',
 otherCandidate:'candidateInOtherFixture',
 ambiguous:'ambiguousAcrossFixtures',
 unresolved:'notFoundInProvidedFixtures',
 unsafe:'unsafePath',
 unsupported:'unsupportedHint'
} as const;
type Category=keyof typeof categories;
const categoryKeys=Object.keys(categories) as Category[];
const refusal='CI_FD_EVIDENCE_REFUSED';

function objectWithKeys(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(value===null||typeof value!=='object'||Array.isArray(value)||
    Object.keys(value).length!==keys.length||
    !keys.every(key=>Object.prototype.hasOwnProperty.call(value,key)))
  throw Error(refusal);
 return value as Record<string,unknown>;
}
function number(value:unknown,limit=512):number{
 if(typeof value!=='number'||!Number.isSafeInteger(value)||value<0||value>limit)
  throw Error(refusal);
 return value;
}
function mustFalse(obj:Record<string,unknown>,keys:readonly string[]):void{
 if(keys.some(key=>obj[key]!==false))throw Error(refusal);
}
type Counts=Record<Category,number>;
function newCounts():Counts{
 return {declared:0,withinOwn:0,otherCandidate:0,ambiguous:0,
  unresolved:0,unsafe:0,unsupported:0};
}
const envelopeKeys=['inputSource','mode','inputCount','report','osSandboxVerified',
 'fdOriginAuthenticated','realUserModsInspected','gameCompatibilityVerified',
 'installationEnabled','writesPerformed'];
const groupKeys=['mode','fixtureCount','slots','declaredHintCount','realPackagesRead',
 'realDependenciesVerified','crossPackageCandidatesVerified',
 'gameCompatibilityVerified','installationEnabled','filesystemAccessEnabled'];
const slotKeys=['fixtureSlot','inspectedDefinitionSources',
 'notInspectedDefinitionSources','hints'];
const negativeGroup=['realPackagesRead','realDependenciesVerified',
 'crossPackageCandidatesVerified','gameCompatibilityVerified',
 'installationEnabled','filesystemAccessEnabled'];
const negativeEnvelope=['osSandboxVerified','fdOriginAuthenticated',
 'realUserModsInspected','gameCompatibilityVerified',
 'installationEnabled','writesPerformed'];

export type CiFdFixtureEvidence=Readonly<{
 origin:'ci-disposable-zip-files';
 reports:readonly PerFixtureReport[];
 fixtureCount:number;
 filesFromUserInspected:false;
 osSandboxVerified:false;
 canInstall:false;
}>;

export function projectCiFdFixtureEvidence(value:unknown):CiFdFixtureEvidence{
 const raw=objectWithKeys(value,envelopeKeys);
 mustFalse(raw,negativeEnvelope);
 if(raw.inputSource!=='ci-created-open-readonly-file-descriptors'||
    raw.mode!=='ci-disposable-zip-file-crosscheck')throw Error(refusal);
 const count=number(raw.inputCount,4);
 if(count<2)throw Error(refusal);
 const group=objectWithKeys(raw.report,groupKeys);
 mustFalse(group,negativeGroup);
 if(group.mode!=='memory-fixture-cross-check-only'||
    number(group.fixtureCount,4)!==count||
    !Array.isArray(group.slots)||group.slots.length!==count)throw Error(refusal);
 const totals=newCounts();
 let inspectedSources=0,notInspectedSources=0;
 const slots=group.slots.map((value:unknown,index:number)=>{
  const slot=objectWithKeys(value,slotKeys);
  if(number(slot.fixtureSlot,4)!==index+1)throw Error(refusal);
  const inspected=number(slot.inspectedDefinitionSources,128);
  const uninspected=number(slot.notInspectedDefinitionSources,128);
  const hints=objectWithKeys(slot.hints,kinds);
  const counts=newCounts();
  for(const kind of kinds){
   const hint=objectWithKeys(hints[kind],Object.values(categories));
   const perKind=newCounts();
   for(const category of categoryKeys){
    const amount=number(hint[categories[category]]);
    perKind[category]=amount;
    counts[category]+=amount;
   }
   if(perKind.declared!==categoryKeys.filter(k=>k!=='declared')
       .reduce((sum,key)=>sum+perKind[key],0))throw Error(refusal);
  }
  if(counts.declared>512)throw Error(refusal);
  for(const category of categoryKeys)totals[category]+=counts[category];
  inspectedSources+=inspected;notInspectedSources+=uninspected;
  return {slot:index+1,...counts,
   inspectedSources:inspected,notInspectedSources:uninspected};
 });
 if(number(group.declaredHintCount)!==totals.declared)throw Error(refusal);
 try{
  const projected=projectFixtureSlots({fixtureCount:count,...totals,
   inspectedSources,notInspectedSources,slots});
  return Object.freeze({
   origin:'ci-disposable-zip-files' as const,
   reports:projected.reports,fixtureCount:count,
   filesFromUserInspected:false as const,
   osSandboxVerified:false as const,
   canInstall:false as const
  });
 }catch{
  // Never forward arbitrary record text or library paths to a caller.
  throw Error(refusal);
 }
}
