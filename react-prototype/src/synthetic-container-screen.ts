// Fake ZIP/SCS catalogue screening, designed as a native reader threat-model.
// Absolutely NO ZIP parser, filesystem, file handles, buffers, network or IPC.
// "reviewed" means ONLY that caller-provided metadata passed local checks.
import {isIssuedSyntheticReadAdmissionSession,type SyntheticReadAdmissionSession,SYNTHETIC_READ_BUDGETS} from './synthetic-read-admission';

export type SyntheticContainerFormat='zip-declared'|'scs-zip-declared'|'scs-proprietary-declared';
type DeclaredEntry=Readonly<{
 path:string;kind:'file'|'directory'|'symlink'|'hardlink';
 compression:'stored'|'deflate'|'unknown';encodedBytes:number;expandedBytes:number;
}>;
export type ContainerBlockReason='invalid-fixture'|'resource-limit'|'unsafe-path'|
 'duplicate-entry'|'file-directory-collision'|'unsafe-link'|
 'unsupported-compression'|'unsupported-container'|'cancelled';
export type SyntheticContainerReview=Readonly<{
 scope:'synthetic-container-screen';revision:number;format:SyntheticContainerFormat;
 nativeHandleIssued:false;fileAccessGranted:false;operationsEnabled:false;
}>;
export type SyntheticContainerCheckpoint=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';format:SyntheticContainerFormat|null;
 status:'pending'|'declarations-reviewed'|'blocked'|'cancelled';
 reason:ContainerBlockReason|null;processed:number;declaredEntries:number;
 declaredEncodedBytes:number;declaredExpandedBytes:number;
 syntheticMetadataOnly:true;archiveParsed:false;bytesRead:0;
 pathsExposed:false;realConsentVerified:false;realConfinementVerified:false;
 executableOperationsEnabled:false;operationsEnabled:false;
}>;
type State={format:SyntheticContainerFormat;entries:readonly unknown[];cursor:number;
 encoded:number;expanded:number;status:SyntheticContainerCheckpoint['status'];
 reason:ContainerBlockReason|null;seen:Map<string,'file'|'directory'>};
const states=new WeakMap<object,State>();
const names=['format','entries'] as const;
const entryNames=['path','kind','compression','encodedBytes','expandedBytes'] as const;
const reserved=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const validName=(v:unknown):v is string=>
 typeof v==='string'&&v.length>0&&v.length<=160&&/^[A-Za-z0-9_./-]+$/.test(v)&&
 !v.startsWith('/')&&!v.endsWith('/')&&
 v.split('/').length<=SYNTHETIC_READ_BUDGETS.depth&&
 v.split('/').every(part=>!!part&&part!=='.'&&part!=='..'&&!part.endsWith('.')&&
  !reserved.test(part));
function exactPlain(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 if(value===null||typeof value!=='object'||Array.isArray(value)||
  Object.getPrototypeOf(value)!==Object.prototype)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 const actual=Reflect.ownKeys(value);
 return actual.length===keys.length&&actual.every(key=>
  typeof key==='string'&&keys.includes(key)&&Object.hasOwn(descriptors[key],'value'));
}
function nonNegative(x:unknown):x is number{
 return typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
}
function checkpoint(s:State):SyntheticContainerCheckpoint{
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  format:s.format,status:s.status,reason:s.reason,processed:s.cursor,
  declaredEntries:s.entries.length,declaredEncodedBytes:s.encoded,
  declaredExpandedBytes:s.expanded,
  syntheticMetadataOnly:true as const,archiveParsed:false as const,bytesRead:0 as const,
  pathsExposed:false as const,realConsentVerified:false as const,
  realConfinementVerified:false as const,executableOperationsEnabled:false as const,
  operationsEnabled:false as const
 });
}
function get(handle:SyntheticContainerReview):State{
 const state=handle&&typeof handle==='object'?states.get(handle):undefined;
 if(!state)throw Error('Simulação de contêiner não emitida.');
 return state;
}
function block(s:State,reason:ContainerBlockReason){
 s.status=reason==='cancelled'?'cancelled':'blocked';s.reason=reason;
 return checkpoint(s);
}
export function createSyntheticContainerReview(
 session:SyntheticReadAdmissionSession,manifest:unknown
):SyntheticContainerReview{
 if(!isIssuedSyntheticReadAdmissionSession(session))
  throw Error('Sessão de admissão sintética não emitida.');
 if(!exactPlain(manifest,names)||!['zip-declared','scs-zip-declared','scs-proprietary-declared'].includes(manifest.format as string)||
    !Array.isArray(manifest.entries))
  throw Error('Catálogo de contêiner sintético inválido.');
 const input=manifest.entries as unknown[];
 const oversize=input.length>SYNTHETIC_READ_BUDGETS.entries;
 // Never read or copy an oversized collection, even when supplied by the fixture.
 const entries:unknown[]=oversize?[]:input.map(value=>{
  if(!exactPlain(value,entryNames))return null;
  const v=value;
  return Object.freeze({
   path:v.path,kind:v.kind,compression:v.compression,
   encodedBytes:v.encodedBytes,expandedBytes:v.expandedBytes
  });
 });
 const format=manifest.format as SyntheticContainerFormat;
 const handle:SyntheticContainerReview=Object.freeze({
  scope:'synthetic-container-screen',revision:session.revision,format,
  nativeHandleIssued:false,fileAccessGranted:false,operationsEnabled:false
 });
 states.set(handle,{
  format,entries:Object.freeze(entries),cursor:0,encoded:0,expanded:0,
  status:oversize||format==='scs-proprietary-declared'?'blocked':'pending',
  reason:oversize?'resource-limit':format==='scs-proprietary-declared'?'unsupported-container':null,
  seen:new Map()
 });
 return handle;
}
export function snapshotSyntheticContainerReview(handle:SyntheticContainerReview):SyntheticContainerCheckpoint{
 return checkpoint(get(handle));
}
export function cancelSyntheticContainerReview(handle:SyntheticContainerReview):SyntheticContainerCheckpoint{
 const s=get(handle);
 if(s.status==='pending')return block(s,'cancelled');
 return checkpoint(s);
}
// Exactly one declared entry per checkpoint, cancellable between each step.
// Checks are informational ONLY and can never authorize an OS read.
export function advanceSyntheticContainerReview(handle:SyntheticContainerReview):SyntheticContainerCheckpoint{
 const s=get(handle);
 if(s.status!=='pending')return checkpoint(s);
 if(s.cursor>=s.entries.length){s.status='declarations-reviewed';return checkpoint(s);}
 const raw=s.entries[s.cursor];
 if(!exactPlain(raw,entryNames)||typeof raw.path!=='string'||
  (raw.kind!=='file'&&raw.kind!=='directory'&&raw.kind!=='symlink'&&raw.kind!=='hardlink')||
  (raw.compression!=='stored'&&raw.compression!=='deflate'&&raw.compression!=='unknown')||
  !nonNegative(raw.encodedBytes)||!nonNegative(raw.expandedBytes))
  return block(s,'invalid-fixture');
 if(!validName(raw.path))return block(s,'unsafe-path');
 const p=raw.path.toLowerCase();
 if(s.seen.has(p))return block(s,'duplicate-entry');
 if(raw.kind==='symlink'||raw.kind==='hardlink')return block(s,'unsafe-link');
 if(raw.kind==='file'&&raw.compression==='unknown')return block(s,'unsupported-compression');
 if(raw.kind==='directory'&&(raw.encodedBytes!==0||raw.expandedBytes!==0))
  return block(s,'invalid-fixture');
 if(raw.kind==='file'&&raw.expandedBytes>0&&raw.encodedBytes===0)return block(s,'resource-limit');
 if([...s.seen].some(([old,kind])=>
  (kind==='file'&&p.startsWith(old+'/'))||
  (raw.kind==='file'&&old.startsWith(p+'/'))))
  return block(s,'file-directory-collision');
 const encoded=s.encoded+raw.encodedBytes,expanded=s.expanded+raw.expandedBytes;
 if(encoded>SYNTHETIC_READ_BUDGETS.encodedBytes||
    expanded>SYNTHETIC_READ_BUDGETS.expandedBytes||
    raw.expandedBytes>Math.max(1,raw.encodedBytes)*SYNTHETIC_READ_BUDGETS.ratio)
  return block(s,'resource-limit');
 s.seen.set(p,raw.kind);s.cursor++;s.encoded=encoded;s.expanded=expanded;
 if(s.cursor===s.entries.length)s.status='declarations-reviewed';
 return checkpoint(s);
}
