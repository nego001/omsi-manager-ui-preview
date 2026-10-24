// Synthetic, declarative package entry index. No filesystem, archives, hashes or IPC.
// Classification is intentionally impossible from this index alone.
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from './distributed-reader-contract';

export const SYNTHETIC_ENTRY_LIMITS=Object.freeze({
 entries:128,path:160,depth:12,encodedBytes:2_000_000,
 expandedBytes:4_000_000,ratio:100
});
export type SyntheticIndexReason='none'|'invalid-fixture'|'unsafe-entry'|'malformed-entry'|'resource-limit';
export type SyntheticEntryRoot='vehicles'|'maps'|'sceneryobjects'|'splines'|'mod'|'def'|'other';
export type SyntheticSuffix='scs'|'zip'|'bus'|'cfg'|'sco'|'sli'|'sii'|'dds'|'png'|'jpg'|'wav'|'ogg'|'bank'|'json'|'unknown';
export type SyntheticIndexEntry=Readonly<{
 handle:string;root:SyntheticEntryRoot;kind:'file'|'directory';
 suffix:SyntheticSuffix;depth:number;encodedBytes:number;expandedBytes:number;
}>;
export type SyntheticPackageIndex=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';fixtureDigest:string;digestVerified:false;
 identity:'fixture-index-v1';entryCount:number;files:number;directories:number;
 encodedBytes:number;expandedBytes:number;entries:readonly SyntheticIndexEntry[];
 gameVerified:false;operationsEnabled:false;
}>;
export type SyntheticIndexResult=Readonly<{
 status:'ready'|'rejected';reason:SyntheticIndexReason;index:SyntheticPackageIndex|null;
}>;
export type SyntheticIndexView=Readonly<{
 source:'synthetic-fixture';moduleId:SyntheticModuleId;fixtureDigest:string;
 verified:false;entries:readonly SyntheticIndexEntry[];operationsEnabled:false;
}>;

const roots:ReadonlySet<string>=new Set(['vehicles','maps','sceneryobjects','splines','mod','def']);
const suffixes:ReadonlySet<string>=new Set(['scs','zip','bus','cfg','sco','sli','sii','dds','png','jpg','wav','ogg','bank','json']);
const moduleSet:ReadonlySet<string>=new Set(SYNTHETIC_MODULE_IDS);
const issuedIndexes=new WeakSet<object>();
// Canonical fixture paths remain PRIVATE to this module, never returned by index or views.
// Ordinal handles alone must never be compared between revisions.
type PrivateIndexedEntry=Readonly<{path:string;entry:SyntheticIndexEntry}>;
const internalDeclarations=new WeakMap<object,readonly PrivateIndexedEntry[]>();
export type SyntheticIndexDelta=Readonly<{
 status:'compared'|'invalid-index';
 sameDeclaredDigest:boolean;
 declaredStructureChanged:boolean;
 added:number;removed:number;modified:number;
 changes:readonly Readonly<{
  change:'added'|'removed'|'modified';
  root:SyntheticEntryRoot;suffix:SyntheticSuffix;kind:'file'|'directory';
 }>[];
 pathsExposed:false;
 digestVerified:false;
 previousEvidenceReusable:false;
}>;

const permittedSuffixes:Readonly<Record<SyntheticModuleId,ReadonlySet<SyntheticSuffix>|null>>=Object.freeze({
 container:new Set<SyntheticSuffix>(),structure:null,manifest:new Set<SyntheticSuffix>(['json','sii']),
 definitions:new Set<SyntheticSuffix>(['bus','cfg','sco','sli','sii']),
 resources:new Set<SyntheticSuffix>(['dds','png','jpg']),audio:new Set<SyntheticSuffix>(['wav','ogg','bank']),
 media:new Set<SyntheticSuffix>(['dds','png','jpg']),relations:new Set<SyntheticSuffix>(['json','sii'])
});
function record(x:unknown):x is Record<string,unknown>{
 return x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
}
function exact(x:Record<string,unknown>,keys:readonly string[]){
 return Object.keys(x).length===keys.length&&keys.every(key=>Object.hasOwn(x,key));
}
function nonNegative(x:unknown):x is number{
 return typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
}
function rejection(reason:Exclude<SyntheticIndexReason,'none'>):SyntheticIndexResult{
 return Object.freeze({status:'rejected' as const,reason,index:null});
}
function rootHint(segments:readonly string[]):SyntheticEntryRoot{
 const root=segments[0].toLowerCase();
 return roots.has(root)?root as SyntheticEntryRoot:'other';
}
function suffixHint(last:string):SyntheticSuffix{
 const dot=last.lastIndexOf('.');
 if(dot<=0)return 'unknown';
 const suffix=last.slice(dot+1).toLowerCase();
 return suffixes.has(suffix)?suffix as SyntheticSuffix:'unknown';
}

// Digest is supplied by fixture and NOT computed from real bytes.
// Index is a sanitized structural hint, not a verified archive inventory.
export function buildSyntheticPackageIndex(fixtureDigest:unknown,input:unknown):SyntheticIndexResult{
 if(typeof fixtureDigest!=='string'||!/^[a-f0-9]{64}$/.test(fixtureDigest)||
    !Array.isArray(input)||input.length>SYNTHETIC_ENTRY_LIMITS.entries)
  return rejection('invalid-fixture');
 const seen=new Set<string>();
 const entries:Array<{path:string;item:SyntheticIndexEntry}>=[];
 let encoded=0,expanded=0,files=0,directories=0;
 for(const raw of input as unknown[]){
  if(!record(raw)||!exact(raw,['path','kind','encodedBytes','expandedBytes','declaredFormat'])||
     typeof raw.path!=='string'||!nonNegative(raw.encodedBytes)||!nonNegative(raw.expandedBytes)||
     (raw.kind!=='file'&&raw.kind!=='directory'&&raw.kind!=='symlink')||
     (raw.declaredFormat!=='well-formed'&&raw.declaredFormat!=='broken'))
   return rejection('invalid-fixture');
  const path=raw.path;
  if(!path||path.length>SYNTHETIC_ENTRY_LIMITS.path||!/^[A-Za-z0-9_./-]+$/.test(path))
   return rejection('unsafe-entry');
  const segments=path.split('/');
  if(segments.length>SYNTHETIC_ENTRY_LIMITS.depth||segments.some(s=>
     !s||s==='.'||s==='..'||s.endsWith('.')||
     /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(s)))
   return rejection('unsafe-entry');
  const canonical=path.toLowerCase();
  if(seen.has(canonical))return rejection('unsafe-entry');
  seen.add(canonical);
  if(raw.kind==='symlink')return rejection('unsafe-entry');
  if(raw.declaredFormat==='broken')return rejection('malformed-entry');
  if(raw.kind==='directory'&&(raw.encodedBytes!==0||raw.expandedBytes!==0))
   return rejection('invalid-fixture');
  if(raw.kind==='file'&&raw.expandedBytes>0&&raw.encodedBytes===0)
   return rejection('resource-limit');
  encoded+=raw.encodedBytes;expanded+=raw.expandedBytes;
  if(encoded>SYNTHETIC_ENTRY_LIMITS.encodedBytes||
     expanded>SYNTHETIC_ENTRY_LIMITS.expandedBytes||
     (raw.kind==='file'&&raw.expandedBytes>raw.encodedBytes*SYNTHETIC_ENTRY_LIMITS.ratio))
   return rejection('resource-limit');
  if(raw.kind==='file')files++;else directories++;
  entries.push({path:canonical,item:{
   handle:'',root:rootHint(segments),kind:raw.kind,
   suffix:raw.kind==='file'?suffixHint(segments[segments.length-1]):'unknown',
   depth:segments.length,encodedBytes:raw.encodedBytes,expandedBytes:raw.expandedBytes
  }});
 }
 // A file cannot be a parent directory of another entry.
 const declaredFiles=new Set(entries.filter(e=>e.item.kind==='file').map(e=>e.path));
 for(const {path} of entries){
  const parts=path.split('/');
  for(let i=1;i<parts.length;i++){
   if(declaredFiles.has(parts.slice(0,i).join('/')))return rejection('unsafe-entry');
  }
 }
 // Stable handles are ordinal, fixture-only and cannot resolve into files.
 // Canonical paths are discarded; index and views never expose raw names.
 entries.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 const safeEntries=Object.freeze(entries.map(({item},i)=>Object.freeze({
  ...item,handle:'synthetic-entry-'+String(i+1).padStart(4,'0')
 })));
 const index:SyntheticPackageIndex=Object.freeze({
  schemaVersion:1,source:'synthetic-fixture',fixtureDigest,digestVerified:false,
  identity:'fixture-index-v1',entryCount:safeEntries.length,files,directories,
  encodedBytes:encoded,expandedBytes:expanded,entries:safeEntries,
  gameVerified:false,operationsEnabled:false
 });
 issuedIndexes.add(index);
 internalDeclarations.set(index,Object.freeze(entries.map(({path},i)=>Object.freeze({path,entry:safeEntries[i]}))));
 return Object.freeze({status:'ready',reason:'none',index});
}

// Restricted *informational* views only. Not a capability or filesystem permission.
export function projectSyntheticIndex(index:SyntheticPackageIndex,moduleId:SyntheticModuleId):SyntheticIndexView{
 if(!moduleSet.has(moduleId)||!issuedIndexes.has(index)||index.source!=='synthetic-fixture'||
    index.digestVerified!==false||index.operationsEnabled!==false)
  throw new Error('Projeção sintética inválida.');
 const allowed=permittedSuffixes[moduleId];
 const filtered=Object.freeze(index.entries.filter(entry=>
  allowed===null||allowed.has(entry.suffix)
 ));
 return Object.freeze({
  source:'synthetic-fixture',moduleId,fixtureDigest:index.fixtureDigest,
  verified:false as const,entries:filtered,operationsEnabled:false as const
 });
}


// Compare issued fixture indexes using PRIVATE canonical declarations, not ordinal handles.
// Only sanitized change categories leave this module. No content hash is verified.
export function compareSyntheticIndexDeclarations(previous:unknown,next:unknown):SyntheticIndexDelta{
 const a=previous&&typeof previous==='object'?internalDeclarations.get(previous):undefined;
 const b=next&&typeof next==='object'?internalDeclarations.get(next):undefined;
 if(!a||!b)return Object.freeze({
  status:'invalid-index' as const,sameDeclaredDigest:false,declaredStructureChanged:true,
  added:0,removed:0,modified:0,changes:Object.freeze([]),
  pathsExposed:false as const,digestVerified:false as const,previousEvidenceReusable:false as const
 });
 const oldIndex=previous as SyntheticPackageIndex,newIndex=next as SyntheticPackageIndex;
 const oldEntries=new Map(a.map(({path,entry})=>[path,entry] as const));
 const nextEntries=new Map(b.map(({path,entry})=>[path,entry] as const));
 const changes:Array<{change:'added'|'removed'|'modified';root:SyntheticEntryRoot;suffix:SyntheticSuffix;kind:'file'|'directory'}>=[];
 for(const {path,entry} of a){
  const newer=nextEntries.get(path);
  if(!newer){
   changes.push({change:'removed',root:entry.root,suffix:entry.suffix,kind:entry.kind});
  }else if(entry.root!==newer.root||entry.kind!==newer.kind||
           entry.suffix!==newer.suffix||entry.depth!==newer.depth||
           entry.encodedBytes!==newer.encodedBytes||entry.expandedBytes!==newer.expandedBytes){
   changes.push({change:'modified',root:entry.root,suffix:entry.suffix,kind:entry.kind});
   // Also preserve the new classification when the kind/suffix changes.
   if(entry.suffix!==newer.suffix||entry.kind!==newer.kind||entry.root!==newer.root){
    changes.push({change:'modified',root:newer.root,suffix:newer.suffix,kind:newer.kind});
   }
  }
 }
 for(const {path,entry} of b){
  if(!oldEntries.has(path))changes.push({change:'added',root:entry.root,suffix:entry.suffix,kind:entry.kind});
 }
 const immutable=Object.freeze(changes.map(c=>Object.freeze({...c})));
 return Object.freeze({
  status:'compared' as const,sameDeclaredDigest:oldIndex.fixtureDigest===newIndex.fixtureDigest,
  declaredStructureChanged:immutable.length>0,
  added:immutable.filter(c=>c.change==='added').length,
  removed:immutable.filter(c=>c.change==='removed').length,
  modified:immutable.filter(c=>c.change==='modified').length,
  changes:immutable,pathsExposed:false as const,digestVerified:false as const,
  previousEvidenceReusable:false as const
 });
}
