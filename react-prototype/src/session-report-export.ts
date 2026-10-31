// Portable, user-initiated export of declared catalog facts. No filesystem API,
// IPC, network, actual mod state or installation activity is used.
export type DeclaredSessionReport={
 id:number;
 selectedIds:readonly string[];
 selectedTitles:readonly string[];
 selectedCount:number;
 games:readonly ('omsi'|'ets2'|'ats')[];
 blockers:number;notices:number;
};
const validGame=new Set(['omsi','ets2','ats']);
export function serializeDeclaredSessionReport(report:DeclaredSessionReport):string{
 if(!report||typeof report!=='object'||!Number.isSafeInteger(report.id)||report.id<1||
  !Number.isSafeInteger(report.selectedCount)||report.selectedCount<1||
  !Array.isArray(report.selectedIds)||!Array.isArray(report.selectedTitles)||
  report.selectedIds.length!==report.selectedCount||
  report.selectedTitles.length!==report.selectedCount||
  !Array.isArray(report.games)||report.games.length<1||
  !report.games.every(game=>validGame.has(game))||
  !Number.isSafeInteger(report.blockers)||report.blockers<0||
  !Number.isSafeInteger(report.notices)||report.notices<0)
  throw Error('DECLARED_SESSION_EXPORT_INVALID');
 const selected=report.selectedIds.map((id,i)=>{
  const title=report.selectedTitles[i];
  if(typeof id!=='string'||id.length<1||id.length>240||
   typeof title!=='string'||title.length<1||title.length>300)
   throw Error('DECLARED_SESSION_EXPORT_INVALID');
  return {id,title};
 });
 // Deliberately omit paths, filenames from the host, timestamps and source
 // file contents: none of these were observed by this metadata-only report.
 const content={
  schema:'omsi-manager-declared-session-report-v1',
  scope:'catalog-metadata-only',
  reportId:report.id,
  source:'catalog-declarations',
  selectedMods:selected,
  selectedCount:report.selectedCount,
  declaredGames:report.games,
  declaredBlockers:report.blockers,
  declaredWarnings:report.notices,
  installationVerified:false,
  compatibilityVerified:false,
  disclaimer:'Resumo apenas de dados declarados. Nenhum mod foi instalado, inspecionado ou validado por este relatório.'
 };
 const json=JSON.stringify(content,null,2)+'\n';
 if(json.length>65536)throw Error('DECLARED_SESSION_EXPORT_TOO_LARGE');
 return json;
}
