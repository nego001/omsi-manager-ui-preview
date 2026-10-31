// Compare two snapshots of user-selected *catalog metadata* only.
// No filesystem access, game installation checks, network or native IPC.
export type SessionComparisonInput={
 id:number;
 selectedIds:readonly string[];
 selectedTitles:readonly string[];
 selectedCount:number;
 blockers:number;notices:number;
};
export type SessionComparisonMod={id:string;title:string};
export type SessionComparisonResult={
 beforeId:number;afterId:number;
 added:SessionComparisonMod[];
 removed:SessionComparisonMod[];
 unchangedCount:number;
 blockersBefore:number;blockersAfter:number;blockersDelta:number;
 noticesBefore:number;noticesAfter:number;noticesDelta:number;
 scope:'catalog-metadata-only';
 compatibilityVerified:false;
 installationVerified:false;
};
function snapshot(report:SessionComparisonInput):Map<string,string>{
 if(!report||typeof report!=='object'||
  !Number.isSafeInteger(report.id)||report.id<1||
  !Number.isSafeInteger(report.selectedCount)||report.selectedCount<1||
  report.selectedCount>500||!Array.isArray(report.selectedIds)||
  !Array.isArray(report.selectedTitles)||
  report.selectedIds.length!==report.selectedCount||
  report.selectedTitles.length!==report.selectedCount||
  !Number.isSafeInteger(report.blockers)||report.blockers<0||
  !Number.isSafeInteger(report.notices)||report.notices<0)
  throw Error('SESSION_COMPARISON_INVALID');
 const result=new Map<string,string>();
 for(let i=0;i<report.selectedCount;i++){
  const id=report.selectedIds[i],title=report.selectedTitles[i];
  if(typeof id!=='string'||!id||id.length>240||
   typeof title!=='string'||!title||title.length>300||
   result.has(id))throw Error('SESSION_COMPARISON_INVALID');
  result.set(id,title);
 }
 return result;
}
export function compareDeclaredSessionReports(before:SessionComparisonInput,
 after:SessionComparisonInput):SessionComparisonResult{
 const a=snapshot(before),b=snapshot(after);
 if(before.id===after.id)throw Error('SESSION_COMPARISON_SAME_REPORT');
 const added=[...b].filter(([id])=>!a.has(id)).map(([id,title])=>({id,title}));
 const removed=[...a].filter(([id])=>!b.has(id)).map(([id,title])=>({id,title}));
 return {
  beforeId:before.id,afterId:after.id,added,removed,
  unchangedCount:[...a.keys()].filter(id=>b.has(id)).length,
  blockersBefore:before.blockers,blockersAfter:after.blockers,
  blockersDelta:after.blockers-before.blockers,
  noticesBefore:before.notices,noticesAfter:after.notices,
  noticesDelta:after.notices-before.notices,
  scope:'catalog-metadata-only',
  compatibilityVerified:false,installationVerified:false
 };
}

/** Export two compared catalog snapshots, never a mod installation/disk diff. */
export function serializeDeclaredSessionComparison(before:SessionComparisonInput,
 after:SessionComparisonInput):string{
 const diff=compareDeclaredSessionReports(before,after);
 const content={
  schema:'omsi-manager-declared-comparison-v1',
  source:'session-memory',
  scope:diff.scope,
  beforeReportId:diff.beforeId,
  afterReportId:diff.afterId,
  addedSelectedMods:diff.added,
  removedSelectedMods:diff.removed,
  unchangedSelectedCount:diff.unchangedCount,
  declaredBlockers:{before:diff.blockersBefore,after:diff.blockersAfter,delta:diff.blockersDelta},
  declaredWarnings:{before:diff.noticesBefore,after:diff.noticesAfter,delta:diff.noticesDelta},
  installationVerified:false,
  compatibilityVerified:false,
  disclaimer:'Diferenças entre seleções de metadados declarados. Não atesta instalação, atualização, integridade ou compatibilidade real.'
 };
 const json=JSON.stringify(content,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>65536)
  throw Error('SESSION_COMPARISON_EXPORT_TOO_LARGE');
 return json;
}
