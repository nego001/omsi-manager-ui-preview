// Entirely in-memory demonstration. Built from synthetic fixtures, never user folders.
import {buildSyntheticPackageIndex,issueSyntheticRevisionTicket,projectSyntheticIndex,type SyntheticPackageIndex} from './synthetic-package-index';
import {runSyntheticIndexedWorkers,type SyntheticWorkerDeclaration} from './synthetic-index-workers';
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from './distributed-reader-contract';
import {createSyntheticEvidenceHistory,beginSyntheticHistoryRevision,completeSyntheticHistoryRevision} from './synthetic-evidence-history';
import {projectSyntheticDiagnosticTimeline,type SyntheticDiagnosticTimeline} from './synthetic-diagnostic-timeline';
type Specialist=Exclude<SyntheticModuleId,'container'>;
const DIGEST='e'.repeat(64); // User-declared example, NOT an actual SHA-256.
const entry=(path:string)=>({path,kind:'file',encodedBytes:100,expandedBytes:150,declaredFormat:'well-formed'});
function index(paths:readonly string[]):SyntheticPackageIndex{
 const result=buildSyntheticPackageIndex(DIGEST,paths.map(entry));
 if(!result.index)throw Error('Falha no fixture de diagnóstico.');
 return result.index;
}
function workers(i:SyntheticPackageIndex,omitAudio:boolean):SyntheticWorkerDeclaration[]{
 return SYNTHETIC_MODULE_IDS.filter((id):id is Specialist=>id!=='container')
  .filter(id=>!(omitAudio&&id==='audio')).map(moduleId=>{
   const suffix=moduleId==='structure'?'bus':moduleId==='manifest'?'json':moduleId==='definitions'?'sii':null;
   const file=suffix?projectSyntheticIndex(i,moduleId).entries.find(e=>e.suffix===suffix):undefined;
   return {
    moduleId,fixtureDigest:DIGEST,status:'ok' as const,
    revisionTicket:issueSyntheticRevisionTicket(i,moduleId),
    observations:file?[{
     handle:file.handle,game:'omsi' as const,revisionTicket:issueSyntheticRevisionTicket(i,moduleId,file.handle)
    }]:[]
   };
  });
}
export type SyntheticDemoStep=Readonly<{id:'initial'|'pending'|'incomplete'|'next-pending';label:string;timeline:SyntheticDiagnosticTimeline}>;
export function createSyntheticDiagnosticDemo():readonly SyntheticDemoStep[]{
 const baseline=index(['Vehicles/demo.bus','def/settings.sii','meta/manifest.json','audio/engine.wav']);
 const initial=createSyntheticEvidenceHistory(baseline,runSyntheticIndexedWorkers(baseline,workers(baseline,false)));
 const repainted=index(['Vehicles/demo.bus','def/settings.sii','meta/manifest.json','audio/engine.wav','skins/paint.dds']);
 const pending=beginSyntheticHistoryRevision(initial,repainted);
 const incomplete=completeSyntheticHistoryRevision(pending,runSyntheticIndexedWorkers(repainted,workers(repainted,true)));
 const soundChange=index(['Vehicles/demo.bus','def/settings.sii','meta/manifest.json','audio/engine.wav','skins/paint.dds','audio/ambient.ogg']);
 const next=beginSyntheticHistoryRevision(incomplete,soundChange);
 return Object.freeze([
  Object.freeze({id:'initial',label:'1. Análise inicial',timeline:projectSyntheticDiagnosticTimeline(initial)}),
  Object.freeze({id:'pending',label:'2. Pintura alterada',timeline:projectSyntheticDiagnosticTimeline(pending)}),
  Object.freeze({id:'incomplete',label:'3. Áudio não analisado',timeline:projectSyntheticDiagnosticTimeline(incomplete)}),
  Object.freeze({id:'next-pending',label:'4. Nova revisão de som',timeline:projectSyntheticDiagnosticTimeline(next)})
 ]);
}
