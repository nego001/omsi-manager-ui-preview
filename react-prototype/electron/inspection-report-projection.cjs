'use strict';
// M62: output-only, allowlisted DTO; no privileged directory path, scanner
// object, getter or unrecognized property is allowed through renderer IPC.
const {GAME_GROUPS,MAX_ENTRIES_PER_GROUP,MAX_INVENTORY_LABELS,isSafeInventoryLabel,getInspectionNotices,requireGameId}=
  require('./game-inspection.cjs');
const fail=()=>{throw Error('Relatório de inspeção inválido.');};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
 Object.getPrototypeOf(x)===Object.prototype;
function own(o,k,required=true){
 const d=Object.getOwnPropertyDescriptor(o,k);
 if(!d){if(required)fail();return undefined;}
 if(!Object.hasOwn(d,'value'))fail(); // never invoke accessors
 return d.value;
}
function number(o,k,optional=false){
 const v=own(o,k,!optional);
 if(v===undefined&&optional)return 0;
 if(!Number.isSafeInteger(v)||v<0||v>MAX_ENTRIES_PER_GROUP)fail();
 return v;
}
function bool(o,k,optional=false){
 const v=own(o,k,!optional);
 if(v===undefined&&optional)return false;
 if(typeof v!=='boolean')fail();
 return v;
}
const summary='Pré-checagem de estrutura. Compatibilidade, ativação e integridade não verificadas.';
function projectInspectionReport(report,game){
 requireGameId(game);
 if(!plain(report)||own(report,'status')!=='ok'||
    own(report,'game')!==game||own(report,'mode')!=='read-only')fail();
 const srcGroups=own(report,'groups');
 const expected=GAME_GROUPS[game];
 if(!Array.isArray(srcGroups)||srcGroups.length<1||
    srcGroups.length>expected.length)fail();
 const groups=[];
 for(let i=0;i<srcGroups.length;i++){
  // Numeric array indices must also be own data descriptors. Array.map()
  // would invoke a forged getter on index 0 before our checks.
  const source=own(srcGroups,String(i));
  if(!plain(source)||own(source,'key')!==expected[i].key)fail();
  const found=bool(source,'found'),count=number(source,'count');
  const limited=bool(source,'limited',true);
  const directories=number(source,'directories',true);
  const files=number(source,'files',true);
  const packageCandidates=number(source,'packageCandidates',true);
  const linksSkipped=number(source,'linksSkipped',true);
  const others=number(source,'others',true);
  // M63: avoid contradictory numeric reports. The scanner's count omits
  // symlinks but equals the sum of regular directories, files and "others".
  // Legacy injected test stubs may omit some breakdown properties; for a
  // complete scanner breakdown, equality is mandatory.
  const classified=directories+files+others;
  const complete=['directories','files','others']
   .every(key=>Object.hasOwn(source,key));
  if(packageCandidates>files||classified>count||
     (complete&&classified!==count)||
     (expected[i].key!=='mods'&&packageCandidates!==0)||
     (!found&&(count!==0||limited||linksSkipped!==0)))fail();
  const rawInventory=own(source,'inventory',false);
  let inventory;
  if(rawInventory!==undefined){
   if(!Array.isArray(rawInventory)||rawInventory.length>MAX_INVENTORY_LABELS)fail();
   inventory=[];
   const seen=new Set();
   let directoryLabels=0,packageLabels=0;
   for(let j=0;j<rawInventory.length;j++){
    const row=own(rawInventory,String(j));
    if(!plain(row))fail();
    const kind=own(row,'kind'),label=own(row,'label');
    if(!isSafeInventoryLabel(label)||seen.has(label))fail();
    seen.add(label);
    if(kind==='directory')directoryLabels++;
    else if(kind==='package'&&expected[i].key==='mods'&&/\.(scs|zip)$/i.test(label))packageLabels++;
    else fail();
    inventory.push({kind,label});
   }
   if(directoryLabels>directories||packageLabels>packageCandidates)fail();
   inventory.sort((a,b)=>a.label<b.label?-1:a.label>b.label?1:0);
  }
  groups.push({key:expected[i].key,name:expected[i].name,found,count,limited,
   directories,files,packageCandidates,linksSkipped,others,
   ...(inventory===undefined?{}:{inventory})});
 }
 const assessment=own(report,'assessment');
 if(!plain(assessment)||own(assessment,'scope')!=='directory-structure-only'||
    own(assessment,'compatibilityVerified')!==false||
    own(assessment,'installationVerified')!==false)fail();
 const mode=own(report,'selectionMode',false)??'parent-folder';
 if(mode!=='parent-folder'&&mode!=='direct-mod-folder')fail();
 if(game==='omsi'&&mode!=='parent-folder')fail();
 const folder=own(report,'folderName',false);
 if(folder!==undefined&&(typeof folder!=='string'||folder.length>100||
    /[\\/\x00-\x1f\x7f]/.test(folder)))fail();
 // M64: Unicode directional controls can visually rewrite a folder label
 // (e.g. disguise a .zip suffix). Never echo these controls into the UI.
 // Hide the display label only; do NOT reject or change the selected folder,
 // its inspection counts, or the filesystem path held privately by main.
 const directionalControls=/[\u061c\u200e\u200f\u2028-\u202e\u2066-\u2069\ufeff]/u;
 const malformedUtf16=typeof folder==='string'&&[...folder].some(ch=>{
   const point=ch.codePointAt(0);
   return point>=0xd800&&point<=0xdfff;
 });
 const safeFolder=folder===undefined?'':(
   directionalControls.test(folder)||malformedUtf16
    ?'Nome da pasta ocultado por segurança':folder);
 const recognized=groups.some(g=>g.found),limited=groups.some(g=>g.limited);
 const originalRecognized=own(report,'recognized',false);
 const originalLimited=own(report,'limited',false);
 if(originalRecognized!==undefined&&originalRecognized!==recognized)fail();
 if(originalLimited!==undefined&&originalLimited!==limited)fail();
 return {
  status:'ok',game,folderName:safeFolder,recognized,groups,
  notices:getInspectionNotices(game,groups,mode),selectionMode:mode,
  assessment:{scope:'directory-structure-only',
   compatibilityVerified:false,installationVerified:false,summary},
  limited,mode:'read-only'
 };
}
module.exports={projectInspectionReport};
