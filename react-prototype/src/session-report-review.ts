// Pure, read-only viewer for previously exported *declared catalog metadata*.
// Never imports into session history, favorites, installation state, IPC or disk.
import {serializeDeclaredSessionReport,serializeDeclaredSessionArchive,
 type DeclaredSessionReport} from './session-report-export';
import {compareDeclaredSessionReports,type SessionComparisonResult} from './session-report-compare';

export const MAX_SESSION_REVIEW_BYTES=131072;
export type ReviewedDeclaredReport={
 reportId:number;
 selectedCount:number;
 selectedMods:{id:string;title:string}[];
 declaredGames:('omsi'|'ets2'|'ats')[];
 declaredBlockers:number;declaredWarnings:number;
 installationVerified:false;compatibilityVerified:false;
};
export type ReviewedDeclaredFile={
 kind:'report'|'archive';
 reports:ReviewedDeclaredReport[];
 scope:'catalog-metadata-only';
 installationVerified:false;compatibilityVerified:false;
};
// Compare JSON data structurally, independent of object key order, while
// rejecting every unknown key at every nesting level.
function exactJsonData(received:unknown,expected:unknown):boolean{
 if(Array.isArray(expected)){
  return Array.isArray(received)&&received.length===expected.length&&
   expected.every((item,i)=>exactJsonData(received[i],item));
 }
 if(expected!==null&&typeof expected==='object'){
  if(received===null||typeof received!=='object'||Array.isArray(received))return false;
  const a=received as Record<string,unknown>,b=expected as Record<string,unknown>;
  const keys=Object.keys(b);
  return Object.keys(a).length===keys.length&&
   keys.every(k=>Object.hasOwn(a,k)&&exactJsonData(a[k],b[k]));
 }
 return received===expected;
}
function reportToMetadata(input:unknown):DeclaredSessionReport{
 if(!input||typeof input!=='object'||Array.isArray(input))
  throw Error('SESSION_REVIEW_INVALID');
 const value=input as Record<string,unknown>;
 if(!Array.isArray(value.selectedMods)||value.selectedMods.length>500)
  throw Error('SESSION_REVIEW_INVALID');
 const mods=value.selectedMods.map(item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))
   throw Error('SESSION_REVIEW_INVALID');
  const mod=item as Record<string,unknown>;
  return {id:mod.id,title:mod.title};
 });
 return {
  id:value.reportId as number,
  selectedIds:mods.map(m=>m.id as string),
  selectedTitles:mods.map(m=>m.title as string),
  selectedCount:value.selectedCount as number,
  games:value.declaredGames as DeclaredSessionReport['games'],
  blockers:value.declaredBlockers as number,
  notices:value.declaredWarnings as number
 };
}
export function parseDeclaredSessionReview(raw:string):ReviewedDeclaredFile{
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX_SESSION_REVIEW_BYTES)
  throw Error('SESSION_REVIEW_TOO_LARGE');
 let input:unknown;
 try{input=JSON.parse(raw);}catch{throw Error('SESSION_REVIEW_INVALID_JSON');}
 if(!input||typeof input!=='object'||Array.isArray(input))
  throw Error('SESSION_REVIEW_INVALID');
 const object=input as Record<string,unknown>;
 let expected:unknown;
 let kind:'report'|'archive';
 if(object.schema==='omsi-manager-declared-session-report-v1'){
  kind='report';
  try{expected=JSON.parse(serializeDeclaredSessionReport(reportToMetadata(object)));}
  catch{throw Error('SESSION_REVIEW_INVALID');}
 }else if(object.schema==='omsi-manager-declared-session-archive-v1'){
  kind='archive';
  if(!Array.isArray(object.reports)||object.reports.length<1||object.reports.length>10)
   throw Error('SESSION_REVIEW_INVALID');
  try{expected=JSON.parse(serializeDeclaredSessionArchive(object.reports.map(reportToMetadata)));}
  catch{throw Error('SESSION_REVIEW_INVALID');}
 }else throw Error('SESSION_REVIEW_UNSUPPORTED_SCHEMA');
 if(!exactJsonData(object,expected))throw Error('SESSION_REVIEW_INVALID');
 const safe=expected as Record<string,unknown>;
 const records=(kind==='report'?[safe]:safe.reports as Record<string,unknown>[])
  .map(item=>({
   reportId:item.reportId as number,selectedCount:item.selectedCount as number,
   selectedMods:item.selectedMods as ReviewedDeclaredReport['selectedMods'],
   declaredGames:item.declaredGames as ReviewedDeclaredReport['declaredGames'],
   declaredBlockers:item.declaredBlockers as number,
   declaredWarnings:item.declaredWarnings as number,
   installationVerified:false as const,compatibilityVerified:false as const
  }));
 return {kind,reports:records,scope:'catalog-metadata-only',
  installationVerified:false,compatibilityVerified:false};
}

/** Compare untrusted, already validated exported metadata without merging it into history. */
export function compareReviewedDeclaredReports(before:ReviewedDeclaredReport,
 after:ReviewedDeclaredReport):SessionComparisonResult{
 const asSnapshot=(record:ReviewedDeclaredReport)=>({
  id:record.reportId,
  selectedIds:record.selectedMods.map(mod=>mod.id),
  selectedTitles:record.selectedMods.map(mod=>mod.title),
  selectedCount:record.selectedCount,
  blockers:record.declaredBlockers,
  notices:record.declaredWarnings
 });
 return compareDeclaredSessionReports(asSnapshot(before),asSnapshot(after));
}

/** Save a comparison of externally supplied metadata without claiming provenance. */
export function serializeReviewedDeclaredComparison(before:ReviewedDeclaredReport,
 after:ReviewedDeclaredReport):string{
 const diff=compareReviewedDeclaredReports(before,after);
 const content={
  schema:'omsi-manager-external-declared-comparison-v1',
  source:'external-json-unverified',
  scope:diff.scope,
  beforeReportId:diff.beforeId,
  afterReportId:diff.afterId,
  addedSelectedMods:diff.added,
  removedSelectedMods:diff.removed,
  unchangedSelectedCount:diff.unchangedCount,
  declaredBlockers:{before:diff.blockersBefore,after:diff.blockersAfter,delta:diff.blockersDelta},
  declaredWarnings:{before:diff.noticesBefore,after:diff.noticesAfter,delta:diff.noticesDelta},
  sourceAuthenticated:false,
  chronologicalOrderVerified:false,
  installationVerified:false,
  compatibilityVerified:false,
  disclaimer:'Comparação de metadados JSON externos não autenticados. Não atesta ordem cronológica, instalação, atualização ou compatibilidade.'
 };
 const json=JSON.stringify(content,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>65536)
  throw Error('SESSION_REVIEW_COMPARISON_TOO_LARGE');
 return json;
}
