// Count-only renderer projection of existing session observations.
const ids=['omsi','ets2','ats'];
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=2000?n:0;
export function summarizeLocalDiagnostics(inspections){
 const rows=ids.map(game=>{
  const report=inspections?.[game];
  const ok=report?.status==='ok'&&report.game===game&&report.mode==='read-only'&&Array.isArray(report.groups)&&report.groups.length<=4;
  if(!ok)return {game,state:report?.status==='error'?'unavailable':'unknown',names:0,links:0,missingGroups:0,limited:false,namesOmitted:false,inventoryCollected:false};
  const groups=report.groups;
  const inventoryCollected=groups.length>0&&groups.every(g=>Array.isArray(g.inventory)&&g.inventory.length<=100);
  const names=groups.reduce((n,g)=>n+(Array.isArray(g.inventory)&&g.inventory.length<=100?g.inventory.length:0),0);
  const links=groups.reduce((n,g)=>n+count(g.linksSkipped),0);
  const missingGroups=groups.filter(g=>g.found===false).length;
  const limited=report.limited===true||groups.some(g=>g.limited===true);
  const namesOmitted=groups.some(g=>Array.isArray(g.inventory)&&g.inventory.length<count(g.directories)+count(g.packageCandidates));
  return {game,state:!report.recognized?'unrecognized':limited||missingGroups>0||namesOmitted||!inventoryCollected?'partial':'observed',names,links,missingGroups,limited,namesOmitted,inventoryCollected};
 });
 return {rows,observedGames:rows.filter(r=>!['unknown','unavailable'].includes(r.state)).length,
  attentionGames:rows.filter(r=>['unavailable','unrecognized','partial'].includes(r.state)||r.links>0).length,
  contentVerified:false,compatibilityVerified:false,operationsEnabled:false};
}
