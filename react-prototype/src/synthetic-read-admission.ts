// Admission design ONLY. No fs, crypto, IPC, handles, actual consent or capabilities.
// User-provided claims can NEVER grant read access. Future trusted native verifier
// must implement its own consent, canonical confinement and bounded I/O.
import {isIssuedSyntheticValidationReadiness,type SyntheticValidationReadiness} from './synthetic-validation-readiness';

export const SYNTHETIC_READ_BUDGETS=Object.freeze({
 encodedBytes:2_000_000,expandedBytes:4_000_000,entries:128,
 depth:12,ratio:100,timeMs:5_000
});
export type SyntheticReadClaim=Readonly<{
 kind:'synthetic-read-proposal';revision:number;
 consent:'explicit-claim'|'missing'|'revoked';
 selectedScope:'single-entry'|'directory-tree'|'unbounded';
 requestedAction:'read-only'|'write'|'execute';
 containment:'contained-claim'|'unverified'|'traversal';
 links:'reject-all-links'|'follow-links'|'unresolved';
 encodedBytes:number;expandedBytes:number;entries:number;depth:number;timeMs:number;
 cancelled:boolean;
}>;
export type AdmissionReason=
 'invalid-contract'|'foreign-session'|'stale-revision'|'no-consent'|
 'revoked-consent'|'broad-scope'|'write-or-execute'|'unverified-containment'|
 'traversal-indicated'|'unsafe-links'|'resource-limit'|'cancelled'|
 'missing-native-consent'|'missing-native-confinement'|'no-reader-backend';
export type SyntheticReadAdmissionSession=Readonly<{
 scope:'synthetic-design-only';revision:number;
 nativeHandleIssued:false;accessGranted:false;operationsEnabled:false;
}>;
export type SyntheticReadAdmission=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';status:'blocked';
 reasonCodes:readonly AdmissionReason[];
 declarationConsistent:boolean;requestedRevision:number|null;
 permittedReadBytes:0;nativeHandleIssued:false;realConsentVerified:false;
 realPathVerified:false;realContentRead:false;operationsEnabled:false;
 note:string;
}>;
const bindings=new WeakMap<object,SyntheticValidationReadiness>();
const immutableReasons=Object.freeze([
 'missing-native-consent','missing-native-confinement','no-reader-backend'
] as const);
const allowedKeys=Object.freeze([
 'kind','revision','consent','selectedScope','requestedAction','containment',
 'links','encodedBytes','expandedBytes','entries','depth','timeMs','cancelled'
] as const);
function plainExact(value:unknown):value is Record<string,unknown>{
 if(value===null||typeof value!=='object'||Array.isArray(value)||
  Object.getPrototypeOf(value)!==Object.prototype)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 const keys=Reflect.ownKeys(value);
 return keys.length===allowedKeys.length&&keys.every(key=>
  typeof key==='string'&&allowedKeys.includes(key as typeof allowedKeys[number])&&
  Object.hasOwn(descriptors,key)&&Object.hasOwn(descriptors[key],'value'));
}
function count(value:unknown):value is number{return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;}
function reasonResult(reasons:readonly AdmissionReason[],revision:number|null):SyntheticReadAdmission{
 const unique=Object.freeze([...new Set(reasons)]);
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,status:'blocked' as const,
  reasonCodes:unique,declarationConsistent:unique.every(x=>immutableReasons.includes(x as typeof immutableReasons[number])),
  requestedRevision:revision,permittedReadBytes:0 as const,nativeHandleIssued:false as const,
  realConsentVerified:false as const,realPathVerified:false as const,
  realContentRead:false as const,operationsEnabled:false as const,
  note:'Somente simulação de regras. Declarações não substituem consentimento nativo nem conferência de caminhos. Acesso negado.'
 });
}
export function createSyntheticReadAdmissionSession(
 readiness:SyntheticValidationReadiness
):SyntheticReadAdmissionSession{
 if(!isIssuedSyntheticValidationReadiness(readiness))
  throw Error('Plano sintético não emitido.');
 const session:SyntheticReadAdmissionSession=Object.freeze({
  scope:'synthetic-design-only',revision:readiness.revision,
  nativeHandleIssued:false,accessGranted:false,operationsEnabled:false
 });
 bindings.set(session,readiness);
 return session;
}
export function assessSyntheticReadClaim(
 session:SyntheticReadAdmissionSession,raw:unknown
):SyntheticReadAdmission{
 if(!session||typeof session!=='object'||!bindings.has(session))
  return reasonResult(['foreign-session',...immutableReasons],null);
 if(!plainExact(raw))
  return reasonResult(['invalid-contract',...immutableReasons],null);
 const r=raw;
 if(r.kind!=='synthetic-read-proposal'||!Number.isSafeInteger(r.revision)||
    (r.consent!=='explicit-claim'&&r.consent!=='missing'&&r.consent!=='revoked')||
    (r.selectedScope!=='single-entry'&&r.selectedScope!=='directory-tree'&&r.selectedScope!=='unbounded')||
    (r.requestedAction!=='read-only'&&r.requestedAction!=='write'&&r.requestedAction!=='execute')||
    (r.containment!=='contained-claim'&&r.containment!=='unverified'&&r.containment!=='traversal')||
    (r.links!=='reject-all-links'&&r.links!=='follow-links'&&r.links!=='unresolved')||
    !count(r.encodedBytes)||!count(r.expandedBytes)||!count(r.entries)||
    !count(r.depth)||!count(r.timeMs)||typeof r.cancelled!=='boolean')
  return reasonResult(['invalid-contract',...immutableReasons],null);
 const reasons:AdmissionReason[]=[];
 if(r.revision!==session.revision)reasons.push('stale-revision');
 if(r.consent==='missing')reasons.push('no-consent');
 if(r.consent==='revoked')reasons.push('revoked-consent');
 if(r.selectedScope!=='single-entry')reasons.push('broad-scope');
 if(r.requestedAction!=='read-only')reasons.push('write-or-execute');
 if(r.containment==='traversal')reasons.push('traversal-indicated');
 else if(r.containment!=='contained-claim')reasons.push('unverified-containment');
 if(r.links!=='reject-all-links')reasons.push('unsafe-links');
 if(r.encodedBytes>SYNTHETIC_READ_BUDGETS.encodedBytes||
    r.expandedBytes>SYNTHETIC_READ_BUDGETS.expandedBytes||
    r.entries>SYNTHETIC_READ_BUDGETS.entries||
    r.depth>SYNTHETIC_READ_BUDGETS.depth||
    r.timeMs>SYNTHETIC_READ_BUDGETS.timeMs||
    r.expandedBytes>Math.max(1,r.encodedBytes)*SYNTHETIC_READ_BUDGETS.ratio)
  reasons.push('resource-limit');
 if(r.cancelled)reasons.push('cancelled');
 return reasonResult([...reasons,...immutableReasons],r.revision as number);
}
