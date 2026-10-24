// Pure, JSON-shaped rehearsal of a RESTART, not actual persistence/recovery.
// No disk, localStorage, fs, IPC, process restart, native reader or permissions.
// Serialized input is UNTRUSTED even if it looks like one we issued.
import {projectSyntheticRecoveryAudit,type SyntheticOrphanRecovery,
 type SyntheticRecoveryEventCode} from './synthetic-orphan-recovery';

export const SYNTHETIC_RESTART_RETENTION=Object.freeze({maxEvents:12,rootEvents:2,maxTotalEvents:48});
export type SyntheticRestartEvent=Readonly<{sequence:number;code:SyntheticRecoveryEventCode}>;
export type SyntheticRestartDraft=Readonly<{
 format:'synthetic-restart-draft';schemaVersion:1;fixtureRevision:number;
 previousState:'incomplete'|'fixture-only';
 totalEvents:number;omittedEvents:number;
 retainedEvents:readonly SyntheticRestartEvent[];
 oldEvidenceInvalidated:true;oldEvidenceReusable:false;
 realVerified:false;operationsEnabled:false;
}>;
export type SyntheticRestartReason=
 'invalid-draft'|'unsupported-version'|'inconsistent-sequence'|
 'incomplete-old-analysis'|'claimed-complete-untrusted';
export type SyntheticRestartInspection=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';
 status:'rejected'|'recheck-required';
 reason:SyntheticRestartReason;
 retainedEvents:number;totalEvents:number;omittedEvents:number;
 previousState:'incomplete'|'fixture-only'|'unknown';
 priorEvidenceStatus:'superseded';oldEvidenceReusable:false;
 freshReanalysisRequired:true;dataTrusted:false;
 persistedToDisk:false;realProcessRestarted:false;
 realBytesRead:0;realFileVerified:false;
 realCleanupVerified:false;operationsEnabled:false;
 notice:string;
}>;
// Only the original issued fixture can be staged in the transaction simulator.
// This is process-local provenance, not authentication or an OS capability.
const issuedRestartDrafts=new WeakSet<object>();
const draftRecoveryOrigins=new WeakMap<object,SyntheticOrphanRecovery>();
export function isSyntheticRestartDraftForRecovery(
 draft:unknown,recovery:unknown
):boolean{
 return !!draft&&typeof draft==='object'&&
  !!recovery&&typeof recovery==='object'&&draftRecoveryOrigins.get(draft)===recovery;
}
export function isIssuedSyntheticRestartDraft(value:unknown):value is SyntheticRestartDraft{
 return !!value&&typeof value==='object'&&issuedRestartDrafts.has(value);
}
const codes=new Set<SyntheticRecoveryEventCode>([
 'orphan-detected','old-evidence-invalidated','previously-acknowledged',
 'orphan-acknowledged','acknowledgement-required','old-evidence-rejected',
 'new-evidence-incomplete','new-evidence-recorded'
]);
const fields=['format','schemaVersion','fixtureRevision','previousState','totalEvents',
 'omittedEvents','retainedEvents','oldEvidenceInvalidated','oldEvidenceReusable',
 'realVerified','operationsEnabled'] as const;
const eventFields=['sequence','code'] as const;
function exact(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||
  Object.getPrototypeOf(value)!==Object.prototype)return false;
 const d=Object.getOwnPropertyDescriptors(value),own=Reflect.ownKeys(value);
 return own.length===keys.length&&own.every(key=>
  typeof key==='string'&&keys.includes(key)&&Object.hasOwn(d[key],'value'));
}
function uint(x:unknown):x is number{
 return typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
}
function inspectResult(
 status:SyntheticRestartInspection['status'],reason:SyntheticRestartReason,
 state:SyntheticRestartInspection['previousState']='unknown',
 total=0,retained=0,omitted=0
):SyntheticRestartInspection{
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  status,reason,retainedEvents:retained,totalEvents:total,omittedEvents:omitted,
  previousState:state,priorEvidenceStatus:'superseded' as const,
  oldEvidenceReusable:false as const,freshReanalysisRequired:true as const,
  dataTrusted:false as const,persistedToDisk:false as const,
  realProcessRestarted:false as const,realBytesRead:0 as const,
  realFileVerified:false as const,realCleanupVerified:false as const,
  operationsEnabled:false as const,
  notice:'Este teste apenas simula serialização em memória. Mesmo uma cópia bem formada exige nova análise independente; não restaura evidências ou permissões.'
 });
}
export function createSyntheticRestartDraft(record:SyntheticOrphanRecovery):SyntheticRestartDraft{
 const audit=projectSyntheticRecoveryAudit(record);
 const raw=audit.events;
 const root=raw.slice(0,SYNTHETIC_RESTART_RETENTION.rootEvents);
 const tailCount=Math.min(
  raw.length-SYNTHETIC_RESTART_RETENTION.rootEvents,
  SYNTHETIC_RESTART_RETENTION.maxEvents-SYNTHETIC_RESTART_RETENTION.rootEvents
 );
 const recent=tailCount===0?[]:raw.slice(-tailCount);
 const events=Object.freeze([...root,...recent].map(e=>Object.freeze({
  sequence:e.sequence,code:e.code
 })));
 const draft:SyntheticRestartDraft=Object.freeze({
  format:'synthetic-restart-draft' as const,schemaVersion:1 as const,
  fixtureRevision:audit.fixtureRevision,
  previousState:audit.activeEvidenceRevision===2?'fixture-only' as const:'incomplete' as const,
  totalEvents:raw.length,omittedEvents:raw.length-events.length,
  retainedEvents:events,
  oldEvidenceInvalidated:true as const,oldEvidenceReusable:false as const,
  realVerified:false as const,operationsEnabled:false as const
 });
 issuedRestartDrafts.add(draft);
 draftRecoveryOrigins.set(draft,record);
 return draft;
}
// Strict *structural* screening, NOT cryptographic validation. An attacker can
// fabricate a structurally valid copy, which still cannot become trusted.
export function inspectSyntheticRestartDraft(raw:unknown):SyntheticRestartInspection{
 if(!exact(raw,fields))return inspectResult('rejected','invalid-draft');
 if(raw.schemaVersion!==1)return inspectResult('rejected','unsupported-version');
 if(raw.format!=='synthetic-restart-draft'||
    !uint(raw.fixtureRevision)||raw.fixtureRevision===0||
    (raw.previousState!=='incomplete'&&raw.previousState!=='fixture-only')||
    !uint(raw.totalEvents)||!uint(raw.omittedEvents)||
    raw.oldEvidenceInvalidated!==true||raw.oldEvidenceReusable!==false||
    raw.realVerified!==false||raw.operationsEnabled!==false||
    !Array.isArray(raw.retainedEvents))
  return inspectResult('rejected','invalid-draft');
 const total=raw.totalEvents,omitted=raw.omittedEvents;
 const events=raw.retainedEvents as unknown[];
 if(total<2||total>SYNTHETIC_RESTART_RETENTION.maxTotalEvents||
    events.length<2||events.length>SYNTHETIC_RESTART_RETENTION.maxEvents||
    events.length!==Math.min(total,SYNTHETIC_RESTART_RETENTION.maxEvents)||
    omitted!==total-events.length)return inspectResult('rejected','invalid-draft');
 const safe=events.every(v=>exact(v,eventFields)&&uint(v.sequence)&&
    typeof v.code==='string'&&codes.has(v.code as SyntheticRecoveryEventCode));
 if(!safe)return inspectResult('rejected','invalid-draft');
 const e=events as unknown as {sequence:number;code:SyntheticRecoveryEventCode}[];
 const gapIndex=SYNTHETIC_RESTART_RETENTION.rootEvents;
 if(e[0].sequence!==1||e[0].code!=='orphan-detected'||
    e[1].sequence!==2||e[1].code!=='old-evidence-invalidated'||
    e[e.length-1].sequence!==total||
    e.some((v,i)=>i>0&&(
      v.sequence!==(i===gapIndex&&omitted>0?omitted+i+1:e[i-1].sequence+1)
    )))return inspectResult('rejected','inconsistent-sequence');
 const recorded=e.filter(v=>v.code==='new-evidence-recorded');
 if(recorded.length>(raw.previousState==='fixture-only'?1:0)||
    (raw.previousState==='fixture-only'&&e[e.length-1].code!=='new-evidence-recorded')||
    (raw.previousState==='incomplete'&&recorded.length>0))
  return inspectResult('rejected','inconsistent-sequence');
 return inspectResult('recheck-required',
  raw.previousState==='fixture-only'?'claimed-complete-untrusted':'incomplete-old-analysis',
  raw.previousState,total,events.length,omitted);
}
