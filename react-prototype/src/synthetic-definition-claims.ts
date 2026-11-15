// Independently declared definition facts for a SYNTHETIC mod reader.
// This adapter validates fake evidence IDs and revision tickets only.
// It never parses .bus/.sii contents, opens packages, or authorizes actions.
import type {GameId} from './catalog';
import {
 projectSyntheticIndex,issueSyntheticRevisionTicket,matchesSyntheticRevisionTicket,
 type SyntheticPackageIndex,type SyntheticRevisionTicket
} from './synthetic-package-index';
import type {SyntheticWorkerDeclaration} from './synthetic-index-workers';

export type SyntheticDefinitionMarker=
 'omsi-bus-definition'|'ets2-vehicle-definition'|'ats-vehicle-definition';
export type SyntheticDefinitionClaim=Readonly<{
 handle:string;marker:SyntheticDefinitionMarker;revisionTicket:SyntheticRevisionTicket;
}>;
export type SyntheticDefinitionReason=
 'none'|'no-claims'|'invalid-index'|'invalid-fixture'|
 'out-of-scope'|'stale-revision'|'conflicting-claims';
export type SyntheticDefinitionResult=Readonly<{
 status:'ready'|'rejected';reason:SyntheticDefinitionReason;
 source:'synthetic-fixture';stage:'fixture-definition-claims-only';
 digestVerified:false;gameVerified:false;realPackageRead:false;operationsEnabled:false;
 facts:readonly Readonly<{
  handle:string;marker:SyntheticDefinitionMarker;game:GameId;verified:false;
 }>[];
 declaration:SyntheticWorkerDeclaration|null;
}>;

const specifications:Readonly<Record<SyntheticDefinitionMarker,Readonly<{
 game:GameId;root:string;suffix:string;
 }>>>=Object.freeze({
 'omsi-bus-definition':Object.freeze({game:'omsi',root:'vehicles',suffix:'bus'}),
 'ets2-vehicle-definition':Object.freeze({game:'ets2',root:'def',suffix:'sii'}),
 'ats-vehicle-definition':Object.freeze({game:'ats',root:'def',suffix:'sii'})
});
const markers:ReadonlySet<string>=new Set(Object.keys(specifications));
function plain(value:unknown):value is Record<string,unknown>{
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.getPrototypeOf(value)===Object.prototype;
}
function exact(value:Record<string,unknown>,fields:readonly string[]):boolean{
 return Object.keys(value).length===fields.length&&fields.every(key=>Object.hasOwn(value,key));
}
function reject(reason:Exclude<SyntheticDefinitionReason,'none'|'no-claims'>):SyntheticDefinitionResult{
 // Rejections never expose a partial claim or a reconstructed file path.
 return Object.freeze({
  status:'rejected' as const,reason,source:'synthetic-fixture' as const,
  stage:'fixture-definition-claims-only' as const,
  digestVerified:false as const,gameVerified:false as const,
  realPackageRead:false as const,operationsEnabled:false as const,
  facts:Object.freeze([]),declaration:null
 });
}

// The marker is caller-declared fixture data, NOT content observed by a reader.
// Root/suffix checks validate scope, but do not authenticate the marker's game.
export function validateSyntheticDefinitionClaims(
 index:SyntheticPackageIndex,claims:unknown
):SyntheticDefinitionResult{
 let entries:ReturnType<typeof projectSyntheticIndex>['entries'];
 try{entries=projectSyntheticIndex(index,'definitions').entries;}
 catch{return reject('invalid-index');}
 if(!Array.isArray(claims)||claims.length>4)return reject('invalid-fixture');
 const allowed=new Map(entries.filter(entry=>entry.kind==='file')
  .map(entry=>[entry.handle,entry] as const));
 const seen=new Set<string>();
 const accepted:Array<{handle:string;marker:SyntheticDefinitionMarker;game:GameId;
  revisionTicket:SyntheticRevisionTicket}>=[];
 for(const raw of claims as unknown[]){
  if(!plain(raw)||!exact(raw,['handle','marker','revisionTicket'])||
     typeof raw.handle!=='string'||typeof raw.marker!=='string'||
     !markers.has(raw.marker))
   return reject('invalid-fixture');
  if(seen.has(raw.handle))return reject('conflicting-claims');
  seen.add(raw.handle);
  const entry=allowed.get(raw.handle);
  const specification=specifications[raw.marker as SyntheticDefinitionMarker];
  if(!entry||entry.root!==specification.root||entry.suffix!==specification.suffix)
   return reject('out-of-scope');
  if(!matchesSyntheticRevisionTicket(index,'definitions',raw.handle,raw.revisionTicket))
   return reject('stale-revision');
  accepted.push({handle:raw.handle,marker:raw.marker as SyntheticDefinitionMarker,
   game:specification.game,revisionTicket:raw.revisionTicket as SyntheticRevisionTicket});
 }
 accepted.sort((a,b)=>a.handle.localeCompare(b.handle)||a.marker.localeCompare(b.marker));
 const facts=Object.freeze(accepted.map(({handle,marker,game})=>
  Object.freeze({handle,marker,game,verified:false as const})));
 // Zero claims mean DEFINITIONS INCOMPLETE, not a successful empty inspection.
 const declaration:SyntheticWorkerDeclaration=Object.freeze({
  moduleId:'definitions',fixtureDigest:index.fixtureDigest,
  status:accepted.length?'ok':'incomplete',
  revisionTicket:issueSyntheticRevisionTicket(index,'definitions'),
  observations:Object.freeze(accepted.map(({handle,game,revisionTicket})=>
   Object.freeze({handle,game,revisionTicket})))
 });
 return Object.freeze({
  status:'ready',reason:accepted.length?'none':'no-claims',
  source:'synthetic-fixture',stage:'fixture-definition-claims-only',
  digestVerified:false,gameVerified:false,realPackageRead:false,
  operationsEnabled:false,facts,declaration
 });
}
