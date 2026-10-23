'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_ENTRIES_PER_GROUP = 2000;
const GAME_GROUPS = Object.freeze({
  omsi: Object.freeze([
    Object.freeze({key:'vehicles',name:'Veículos',folder:'Vehicles'}),
    Object.freeze({key:'maps',name:'Mapas',folder:'maps'}),
    Object.freeze({key:'scenery',name:'Objetos de cenário',folder:'Sceneryobjects'}),
    Object.freeze({key:'splines',name:'Splines',folder:'Splines'})
  ]),
  ets2: Object.freeze([Object.freeze({key:'mods',name:'Pasta de mods',folder:'mod'})]),
  ats: Object.freeze([Object.freeze({key:'mods',name:'Pasta de mods',folder:'mod'})])
});

// File extensions are only hints based on names. No binary/zip is opened.
const PACKAGE_EXTENSIONS = Object.freeze(['.scs','.zip']);
function requireGameId(game) {
  if(typeof game!=='string'||!Object.hasOwn(GAME_GROUPS,game))
    throw new TypeError('Jogo inválido para inspeção.');
  return game;
}
function emptyCount(found=false){
  return {count:0,found,limited:false,directories:0,files:0,packageCandidates:0,linksSkipped:0,others:0};
}
// Does not recurse, open files or return entry names. Symlinks are not followed.
async function countDirectChildren(folder,max=MAX_ENTRIES_PER_GROUP,checkPackages=false){
  if(!Number.isSafeInteger(max)||max<1||max>MAX_ENTRIES_PER_GROUP)
    throw new TypeError('Limite de contagem inválido.');
  let dir;
  try {
    const stats=await fs.lstat(folder);
    if(stats.isSymbolicLink()||!stats.isDirectory())return emptyCount();
    dir=await fs.opendir(folder);
  }catch(err){
    if(err && ['ENOENT','ENOTDIR','EACCES','EPERM'].includes(err.code))
      return emptyCount();
    throw err;
  }
  const result=emptyCount(true);
  let scanned=0;
  try{
    for await(const entry of dir){
      // Budget applies to every entry, including symlinks, to bound scan cost.
      if(scanned++>=max){result.limited=true;break;}
      if(entry.isSymbolicLink()){
        result.linksSkipped++;
        continue;
      }
      result.count++;
      if(entry.isDirectory()) result.directories++;
      else if(entry.isFile()){
        result.files++;
        if(checkPackages && PACKAGE_EXTENSIONS.some(ext=>entry.name.toLowerCase().endsWith(ext)))
          result.packageCandidates++;
      } else result.others++;
    }
  }finally{
    try{await dir.close();}
    catch(err){if(err?.code!=='ERR_DIR_CLOSED')throw err;}
  }
  return result;
}

function getInspectionNotices(game,groups){
  const notices=[];
  if(!groups.some(g=>g.found)){
    notices.push({code:'no-known-folders',level:'attention',message:'Nenhuma pasta esperada foi encontrada. Verifique se selecionou o diretório adequado.'});
  }
  if(groups.some(g=>g.limited)){
    notices.push({code:'partial-count',level:'attention',message:'Uma ou mais pastas ultrapassaram 2.000 entradas. As contagens exibidas são parciais.'});
  }
  if(groups.some(g=>g.linksSkipped)){
    notices.push({code:'links-skipped',level:'info',message:'Links simbólicos foram ignorados para evitar percorrer outros locais.'});
  }
  if((game==='ets2'||game==='ats')&&groups.some(g=>g.found)){
    notices.push({code:'mods-not-verified',level:'info',message:'Arquivos .scs e .zip são apenas candidatos. A inspeção não confirma validade, ativação ou instalação de mods.'});
  }
  return notices;
}
async function inspectGameDirectory(selectedRoot,game){
  requireGameId(game);
  if(typeof selectedRoot!=='string'||selectedRoot.length===0)
    throw new TypeError('Selecione uma pasta válida.');
  const rootInfo=await fs.lstat(selectedRoot);
  if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())
    throw new Error('A pasta selecionada não é um diretório normal.');
  const root=await fs.realpath(selectedRoot);
  const groups=[];
  for(const spec of GAME_GROUPS[game]){
    const stats=await countDirectChildren(path.join(root,spec.folder),MAX_ENTRIES_PER_GROUP,spec.key==='mods');
    groups.push({
      key:spec.key,name:spec.name,found:stats.found,count:stats.count,
      limited:stats.limited,directories:stats.directories,files:stats.files,
      packageCandidates:stats.packageCandidates,linksSkipped:stats.linksSkipped,
      others:stats.others
    });
  }
  return {
    status:'ok',
    game,
    folderName:path.basename(root).slice(0,100),
    recognized:groups.some(g=>g.found),
    groups,
    notices:getInspectionNotices(game,groups),
    limited:groups.some(g=>g.limited),
    mode:'read-only'
  };
}
module.exports={
  requireGameId,inspectGameDirectory,countDirectChildren,getInspectionNotices,
  GAME_GROUPS,MAX_ENTRIES_PER_GROUP
};
