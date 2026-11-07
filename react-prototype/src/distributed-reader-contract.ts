// Pure synthetic contract for a future distributed reader.
// Never opens files, invokes IPC, hashes actual packages, or authorizes writes.
import type {GameId} from './catalog';

export const SYNTHETIC_MODULE_IDS=[
 'container','structure','manifest','definitions','resources','audio','media','relations'
] as const;
export type SyntheticModuleId=typeof SYNTHETIC_MODULE_IDS[number];
export type SyntheticModuleStatus='ok'|'incomplete'|'blocked';
export type SyntheticSignal={game:GameId;evidenceId:string};
export type SyntheticModuleReport={
 moduleId:SyntheticModuleId;
 contractVersion:1;
 fixtureDigest:string;
 status:SyntheticModuleStatus;
 signals:readonly SyntheticSignal[];
};
export type SyntheticEvidence={moduleId:'structure'|'manifest'|'definitions';game:GameId;evidenceId:string};
export type SyntheticSnapshotState='blocked'|'incomplete'|'ambiguous'|'candidate'|'unknown';
export type SyntheticFindingCode=
 'invalid-contract'|'gate-missing'|'gate-incomplete'|'gate-blocked'|
 'module-blocked'|'module-missing'|'module-incomplete'|'ambiguous-game'|
 'insufficient-evidence'|'no-evidence';
export type SyntheticSnapshot=Readonly<{
 schemaVersion:1;
 source:'synthetic-fixture';
 fixtureDigest:string|null;
 digestVerified:false;
 state:SyntheticSnapshotState;
 candidateGame:GameId|null;
 evidence:readonly Readonly<SyntheticEvidence>[];
 findings:readonly SyntheticFindingCode[];
 compatibilityVerified:false;
 installationVerified:false;
 operationsEnabled:false;
}>;
export type SyntheticPlan=Readonly<{
 scope:'synthetic-only';
 executionEnabled:false;
 phases:readonly Readonly<{name:'gate'|'specialists';modules:readonly SyntheticModuleId[]}>[];
}>;

const moduleSet:ReadonlySet<string>=new Set(SYNTHETIC_MODULE_IDS);
const gameSet:ReadonlySet<string>=new Set(['omsi','ets2','ats']);
const signalModules:ReadonlySet<string>=new Set(['structure','manifest','definitions']);
const digestPattern=/^[a-f0-9]{64}$/;
const evidencePattern=/^[a-z0-9][a-z0-9_-]{0,39}$/;

export function createSyntheticPlan():SyntheticPlan{
 return Object.freeze({
  scope:'synthetic-only' as const,executionEnabled:false as const,
  phases:Object.freeze([
   Object.freeze({name:'gate' as const,modules:Object.freeze(['container'] as SyntheticModuleId[])}),
   Object.freeze({name:'specialists' as const,modules:Object.freeze(SYNTHETIC_MODULE_IDS.slice(1) as SyntheticModuleId[])})
  ])
 });
}
function makeSnapshot(
 digest:string|null,state:SyntheticSnapshotState,
 findings:readonly SyntheticFindingCode[],evidence:readonly SyntheticEvidence[]=[]
):SyntheticSnapshot{
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,fixtureDigest:digest,
  digestVerified:false as const,state,candidateGame:state==='candidate'?evidence[0]?.game??null:null,
  evidence:Object.freeze(evidence.map(item=>Object.freeze({...item}))),
  findings:Object.freeze([...findings]),
  compatibilityVerified:false as const,installationVerified:false as const,
  operationsEnabled:false as const
 });
}
function validReport(candidate:unknown):candidate is SyntheticModuleReport{
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate))return false;
 const item=candidate as Record<string,unknown>;
 const keys=Object.keys(item);
 if(keys.length!==5||keys.some(key=>!['moduleId','contractVersion','fixtureDigest','status','signals'].includes(key)))return false;
 if(typeof item.moduleId!=='string'||!moduleSet.has(item.moduleId)||item.contractVersion!==1)return false;
 if(typeof item.fixtureDigest!=='string'||!digestPattern.test(item.fixtureDigest))return false;
 if(item.status!=='ok'&&item.status!=='incomplete'&&item.status!=='blocked')return false;
 if(!Array.isArray(item.signals)||item.signals.length>4)return false;
 if(!signalModules.has(item.moduleId)&&item.signals.length!==0)return false;
 for(const signal of item.signals){
  if(!signal||typeof signal!=='object'||Array.isArray(signal))return false;
  const obj=signal as Record<string,unknown>;
  if(Object.keys(obj).length!==2||!Object.hasOwn(obj,'game')||!Object.hasOwn(obj,'evidenceId'))return false;
  if(typeof obj.game!=='string'||!gameSet.has(obj.game))return false;
  if(typeof obj.evidenceId!=='string'||!evidencePattern.test(obj.evidenceId))return false;
 }
 return true;
}

// Report order is irrelevant. All inputs are caller-declared fixture data, never trusted file findings.
export function coordinateSyntheticEvidence(
 fixtureDigest:string,reports:readonly SyntheticModuleReport[]
):SyntheticSnapshot{
 const digest=typeof fixtureDigest==='string'&&digestPattern.test(fixtureDigest)?fixtureDigest:null;
 if(!digest||!Array.isArray(reports)||reports.length>SYNTHETIC_MODULE_IDS.length)
  return makeSnapshot(digest,'blocked',['invalid-contract']);
 const byModule=new Map<SyntheticModuleId,SyntheticModuleReport>();
 for(const report of reports as readonly unknown[]){
  if(!validReport(report)||report.fixtureDigest!==digest||byModule.has(report.moduleId))
   return makeSnapshot(digest,'blocked',['invalid-contract']);
  byModule.set(report.moduleId,report);
 }
 const gate=byModule.get('container');
 if(!gate)return makeSnapshot(digest,'blocked',['gate-missing']);
 if(gate.status==='blocked')return makeSnapshot(digest,'blocked',['gate-blocked']);
 if(gate.status==='incomplete')return makeSnapshot(digest,'incomplete',['gate-incomplete']);
 const blocked=SYNTHETIC_MODULE_IDS.some(id=>byModule.get(id)?.status==='blocked');
 if(blocked)return makeSnapshot(digest,'blocked',['module-blocked']);
 const missing=SYNTHETIC_MODULE_IDS.some(id=>!byModule.has(id));
 const incomplete=SYNTHETIC_MODULE_IDS.some(id=>byModule.get(id)?.status==='incomplete');
 // Canonical ordering makes shared projections and test results repeatable.
 const evidence:SyntheticEvidence[]=[];
 for(const id of ['structure','manifest','definitions'] as const){
  const signals=byModule.get(id)?.signals??[];
  for(const signal of [...signals].sort((a,b)=>a.game.localeCompare(b.game)||a.evidenceId.localeCompare(b.evidenceId))){
   evidence.push({moduleId:id,game:signal.game,evidenceId:signal.evidenceId});
  }
 }
 if(missing||incomplete)return makeSnapshot(digest,'incomplete',[
  ...(missing?['module-missing'] as const:[]),
  ...(incomplete?['module-incomplete'] as const:[])
 ],evidence);
 const games=new Set(evidence.map(item=>item.game));
 if(games.size>1)return makeSnapshot(digest,'ambiguous',['ambiguous-game'],evidence);
 if(!games.size)return makeSnapshot(digest,'unknown',['no-evidence'],evidence);
 const independent= new Set(evidence.map(item=>item.moduleId));
 if(!independent.has('structure')||!independent.has('definitions'))
  return makeSnapshot(digest,'unknown',['insufficient-evidence'],evidence);
 return makeSnapshot(digest,'candidate',[],evidence);
}

// All sectors receive sanitized projections of this SAME snapshot. No feature is unlocked.
export function projectSyntheticSnapshot(snapshot:SyntheticSnapshot){
 return Object.freeze({
  library:Object.freeze({
   gameCandidate:snapshot.state==='candidate'?snapshot.candidateGame:null,
   analysisState:snapshot.state,
   label:snapshot.state==='candidate'?'Jogo sugerido por dados fictícios':'Identificação não confirmada',
   installed:false as const,compatibilityVerified:false as const
  }),
  diagnostics:Object.freeze({
   analysisState:snapshot.state,findings:Object.freeze([...snapshot.findings]),
   evidenceCount:snapshot.evidence.length,digestVerified:false as const
  }),
  workshop:Object.freeze({skinEnabled:false as const,audioEnabled:false as const,reason:'Sem recursos reais verificados.'}),
  installer:Object.freeze({enabled:false as const,reason:'Contrato sintético sem autorização ou arquivos verificados.'})
 });
}
