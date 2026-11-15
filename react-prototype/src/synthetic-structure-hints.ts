// Synthetic structural cues for the next identification phase.
// Only sanitized, already-issued fixture indexes enter this module.
// No file I/O, content parsing, network, archive opening, or installer actions.
import type {GameId} from './catalog';
import {
 projectSyntheticIndex,issueSyntheticRevisionTicket,
 type SyntheticPackageIndex,type SyntheticIndexEntry
} from './synthetic-package-index';
import type {SyntheticWorkerDeclaration} from './synthetic-index-workers';

export type SyntheticStructureCueCode=
 'omsi-vehicles-bus'|'omsi-sceneryobjects-sco'|'omsi-splines-sli';
export type SyntheticStructureCue=Readonly<{
 code:SyntheticStructureCueCode;
 gameHint:GameId;
 handle:string;
 verified:false;
}>;
export type SyntheticStructureHints=Readonly<{
 source:'synthetic-fixture';
 stage:'structural-hints-only';
 fixtureDigest:string;
 digestVerified:false;
 gameVerified:false;
 compatibilityVerified:false;
 realPackageRead:false;
 operationsEnabled:false;
 indexEntryCount:number;
 sharedScsFormatEntries:number;
 cues:readonly SyntheticStructureCue[];
 declaration:SyntheticWorkerDeclaration;
}>;

// These three root/suffix combinations are only OMSI layout *hints*.
// A .scs extension or a def/*.sii entry is shared by ETS2 and ATS and must
// NEVER create a game signal without independent, future content evidence.
function cueFor(entry:SyntheticIndexEntry):SyntheticStructureCueCode|null{
 if(entry.kind!=='file')return null;
 if(entry.root==='vehicles'&&entry.suffix==='bus')return 'omsi-vehicles-bus';
 if(entry.root==='sceneryobjects'&&entry.suffix==='sco')return 'omsi-sceneryobjects-sco';
 if(entry.root==='splines'&&entry.suffix==='sli')return 'omsi-splines-sli';
 return null;
}

// Entry handles and tickets are opaque fixture-only tokens. They cannot resolve
// file bytes. One cue of each kind is retained to keep the observation contract
// bounded, deterministic and independent from fixture entry ordering.
export function deriveSyntheticStructureHints(index:SyntheticPackageIndex):SyntheticStructureHints{
 const view=projectSyntheticIndex(index,'structure'); // rejects forged/non-issued indexes
 const observed=new Map<SyntheticStructureCueCode,SyntheticIndexEntry>();
 let sharedScsFormatEntries=0;
 for(const entry of view.entries){
  if(entry.kind!=='file')continue;
  if(entry.suffix==='scs'||(entry.root==='def'&&entry.suffix==='sii'))
   sharedScsFormatEntries++;
  const code=cueFor(entry);
  if(code&&!observed.has(code))observed.set(code,entry);
 }
 const codes:readonly SyntheticStructureCueCode[]=[
  'omsi-vehicles-bus','omsi-sceneryobjects-sco','omsi-splines-sli'
 ];
 const cues=Object.freeze(codes.filter(code=>observed.has(code))
  .map(code=>Object.freeze({
   code,gameHint:'omsi' as const,handle:observed.get(code)!.handle,verified:false as const
  })));
 const observations=Object.freeze(cues.map(cue=>Object.freeze({
  handle:cue.handle,game:'omsi' as const,
  revisionTicket:issueSyntheticRevisionTicket(index,'structure',cue.handle)
 })));
 const declaration:SyntheticWorkerDeclaration=Object.freeze({
  moduleId:'structure',fixtureDigest:index.fixtureDigest,status:'ok',
  revisionTicket:issueSyntheticRevisionTicket(index,'structure'),
  observations
 });
 return Object.freeze({
  source:'synthetic-fixture',stage:'structural-hints-only',
  fixtureDigest:index.fixtureDigest,digestVerified:false,
  gameVerified:false,compatibilityVerified:false,
  realPackageRead:false,operationsEnabled:false,
  indexEntryCount:view.entries.length,sharedScsFormatEntries,
  cues,declaration
 });
}
