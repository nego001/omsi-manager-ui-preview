// Session display metadata only. No path, handle, timestamp or identity claim.
const groups={omsi:['vehicles','maps','scenery','splines'],ets2:['mods'],ats:['mods']};
const bounded=n=>Number.isSafeInteger(n)&&n>=0&&n<=2000;
export function captureLocalObservation(report,game){
 try{
  if(!Object.hasOwn(groups,game)||report?.status!=='ok'||report.game!==game||
   report.mode!=='read-only'||!['parent-folder','direct-mod-folder'].includes(report.selectionMode)||
   !Array.isArray(report.groups)||report.groups.length!==groups[game].length||
   typeof report.limited!=='boolean')return null;
  const rows=[],seen=new Set();
  let partial=report.limited;
  for(let i=0;i<report.groups.length;i++){
   const g=report.groups[i];
   if(g.key!==groups[game][i]||typeof g.limited!=='boolean'||typeof g.found!=='boolean'||
    !bounded(g.directories)||!bounded(g.packageCandidates)||!Array.isArray(g.inventory)||g.inventory.length>100)return null;
   if(!g.found&&g.inventory.length)return null;
   let dirs=0,packages=0;
   for(const row of g.inventory){
    if(typeof row.label!=='string'||!row.label.length||row.label.length>160||
     /[\\/\x00-\x1f\x7f\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/u.test(row.label)||
     row.label==='.'||row.label==='..'||!['directory','package'].includes(row.kind))return null;
    if(row.kind==='directory')dirs++;
    else{if(g.key!=='mods'||!/\.(scs|zip)$/i.test(row.label))return null;packages++;}
    const key=JSON.stringify([g.key,row.kind,row.label]);
    if(seen.has(key))return null;
    seen.add(key);rows.push(Object.freeze({key,group:g.key,kind:row.kind,label:row.label}));
   }
   if(dirs>g.directories||packages>g.packageCandidates)return null;
   partial||=g.limited||!g.found||dirs<g.directories||packages<g.packageCandidates;
  }
  return Object.freeze({game,selectionMode:report.selectionMode,partial,rows:Object.freeze(rows)});
 }catch{return null;}
}
export function compareLocalObservations(reference,current){
 if(!reference||!current||reference.game!==current.game||reference.selectionMode!==current.selectionMode)return null;
 const before=new Map(reference.rows.map(row=>[row.key,row]));
 const after=new Map(current.rows.map(row=>[row.key,row]));
 const onlyReference=reference.rows.filter(row=>!after.has(row.key));
 const onlyCurrent=current.rows.filter(row=>!before.has(row.key));
 const shared=current.rows.length-onlyCurrent.length;
 return Object.freeze({shared,onlyReference:Object.freeze(onlyReference),onlyCurrent:Object.freeze(onlyCurrent),
  partial:reference.partial||current.partial,sameLocationVerified:false,contentCompared:false,operationsEnabled:false});
}
