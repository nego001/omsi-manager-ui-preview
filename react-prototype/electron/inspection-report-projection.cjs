'use strict';
// M62: output-only, allowlisted DTO; no privileged directory path, scanner
// object, getter or unrecognized property is allowed through renderer IPC.
const {GAME_GROUPS,MAX_ENTRIES_PER_GROUP,getInspectionNotices,requireGameId}=
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
  if(packageCandidates>files||directories>count||files>count||
     others>count||linksSkipped>MAX_ENTRIES_PER_GROUP)fail();
  return {key:expected[i].key,name:expected[i].name,found,count,limited,
   directories,files,packageCandidates,linksSkipped,others});
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
 const recognized=groups.some(g=>g.found),limited=groups.some(g=>g.limited);
 const originalRecognized=own(report,'recognized',false);
 const originalLimited=own(report,'limited',false);
 if(originalRecognized!==undefined&&originalRecognized!==recognized)fail();
 if(originalLimited!==undefined&&originalLimited!==limited)fail();
 return {
  status:'ok',game,folderName:folder??'',recognized,groups,
  notices:getInspectionNotices(game,groups,mode),selectionMode:mode,
  assessment:{scope:'directory-structure-only',
   compatibilityVerified:false,installationVerified:false,summary},
  limited,mode:'read-only'
 };
}
module.exports={projectInspectionReport};
