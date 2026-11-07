'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');

const MAX_ENTRIES_PER_GROUP = 2000;
const MISSING_CODES = Object.freeze(['ENOENT','ENOTDIR','EACCES','EPERM']);

// Comparing the same pathname at multiple checkpoints detects many races.
// It is NOT an atomic directory handle: in particular, ABA is still possible.
// BigInt metadata avoids truncating inode, device or timestamp values.
function directoryIdentity(info) {
  if(!info || !info.isDirectory() || info.isSymbolicLink())return null;
  return [info.dev,info.ino,info.mode,info.ctimeNs,info.mtimeNs]
    .map(value=>String(value)).join(':');
}
function changedDirectory(){
  return new Error('A identidade da pasta mudou durante a inspeção.');
}
async function identityAt(fsApi,folder){
  try{
    return directoryIdentity(await fsApi.lstat(folder,{bigint:true}));
  }catch(error){
    if(error && MISSING_CODES.includes(error.code))return null;
    throw error;
  }
}
async function assertIdentity(fsApi,folder,initial){
  if(!initial || (await identityAt(fsApi,folder))!==initial)
    throw changedDirectory();
}

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
// Symlinks are never enumerated intentionally. The second identity check runs
// BEFORE reading dir entries. This can detect a changed pathname, but does not
// make fs.opendir atomic or prevent a transient redirect between checkpoints.
function createDirectoryCounter(fsApi=fs){
  return async function count(folder,max=MAX_ENTRIES_PER_GROUP,checkPackages=false){
    if(!Number.isSafeInteger(max)||max<1||max>MAX_ENTRIES_PER_GROUP)
      throw new TypeError('Limite de contagem inválido.');
    const initial=await identityAt(fsApi,folder);
    if(!initial)return emptyCount();
    let dir;
    try{
      // If path vanishes or becomes a link *after* the first check, error
      // rather than quietly reclassifying a partial scan as an empty folder.
      try{dir=await fsApi.opendir(folder);}
      catch(error){
        if(error && MISSING_CODES.includes(error.code))throw changedDirectory();
        throw error;
      }
      await assertIdentity(fsApi,folder,initial);
      const result=emptyCount(true);
      let scanned=0;
      for await(const entry of dir){
        // Budget applies to every entry, including symlinks.
        if(scanned++>=max){result.limited=true;break;}
        if(entry.isSymbolicLink()){
          result.linksSkipped++;
          continue;
        }
        result.count++;
        if(entry.isDirectory())result.directories++;
        else if(entry.isFile()){
          result.files++;
          if(checkPackages && PACKAGE_EXTENSIONS.some(ext=>
            entry.name.toLowerCase().endsWith(ext)))result.packageCandidates++;
        }else result.others++;
      }
      await assertIdentity(fsApi,folder,initial);
      return result;
    }finally{
      if(dir){
        try{await dir.close();}
        catch(error){if(error?.code!=='ERR_DIR_CLOSED')throw error;}
      }
    }
  };
}
const countDirectChildren=createDirectoryCounter();

function getInspectionNotices(game,groups,selectionMode){
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
  if(game==='omsi'&&groups.some(g=>g.found)&&groups.some(g=>!g.found)){
    notices.push({code:'omsi-structure-incomplete',level:'info',message:'Apenas parte das pastas conhecidas do OMSI foi encontrada. Isto não significa que o jogo ou seus mods sejam inválidos.'});
  }
  if((game==='ets2'||game==='ats')&&groups.some(g=>g.found)){
    if(selectionMode==='direct-mod-folder'){
      notices.push({code:'direct-mod-folder',level:'info',message:'A pasta mod foi selecionada diretamente, sem precisar escolher a pasta acima dela.'});
    }
    if(groups.every(g=>g.packageCandidates===0)&&!groups.some(g=>g.limited)){
      notices.push({code:'no-package-candidates',level:'info',message:'Nenhum arquivo .scs ou .zip foi encontrado neste nível. Mods em subpastas não são examinados.'});
    }
    notices.push({code:'mods-not-verified',level:'info',message:'Arquivos .scs e .zip são apenas candidatos. A inspeção não confirma validade, ativação ou instalação de mods.'});
  }
  return notices;
}
function createGameDirectoryInspector(fsApi=fs){
  const count=createDirectoryCounter(fsApi);
  return async function inspectGameDirectory(selectedRoot,game){
  requireGameId(game);
  if(typeof selectedRoot!=='string'||selectedRoot.length===0)
    throw new TypeError('Selecione uma pasta válida.');
  const rootInfo=await fsApi.lstat(selectedRoot,{bigint:true});
  const rootIdentity=directoryIdentity(rootInfo);
  if(!rootIdentity)
    throw new Error('A pasta selecionada não é um diretório normal.');
  const root=await fsApi.realpath(selectedRoot);
  await assertIdentity(fsApi,selectedRoot,rootIdentity);
  await assertIdentity(fsApi,root,rootIdentity);
  const verifyRoot=async()=>{
    if((await fsApi.realpath(selectedRoot))!==root)throw changedDirectory();
    await assertIdentity(fsApi,selectedRoot,rootIdentity);
    await assertIdentity(fsApi,root,rootIdentity);
  };
  const groups=[];
  // ETS2/ATS allow choosing either the parent folder or the mod folder itself.
  // Never infer a game installation or follow paths supplied by the renderer.
  const selectionMode=(game!=='omsi'&&path.basename(root).toLowerCase()==='mod')
    ? 'direct-mod-folder' : 'parent-folder';
  for(const spec of GAME_GROUPS[game]){
    const target=(spec.key==='mods'&&selectionMode==='direct-mod-folder')
      ? root : path.join(root,spec.folder);
    await verifyRoot();
    const stats=await count(target,MAX_ENTRIES_PER_GROUP,spec.key==='mods');
    await verifyRoot();
    groups.push({
      key:spec.key,name:spec.name,found:stats.found,count:stats.count,
      limited:stats.limited,directories:stats.directories,files:stats.files,
      packageCandidates:stats.packageCandidates,linksSkipped:stats.linksSkipped,
      others:stats.others
    });
  }
  await verifyRoot();
  return {
    status:'ok',
    game,
    folderName:path.basename(root).slice(0,100),
    recognized:groups.some(g=>g.found),
    groups,
    notices:getInspectionNotices(game,groups,selectionMode),
    selectionMode,
    assessment:{
      scope:'directory-structure-only',
      compatibilityVerified:false,
      installationVerified:false,
      summary:'Pré-checagem de estrutura. Compatibilidade, ativação e integridade não verificadas.'
    },
    limited:groups.some(g=>g.limited),
    mode:'read-only'
  };
  };
}
const inspectGameDirectory=createGameDirectoryInspector();
module.exports={
  requireGameId,inspectGameDirectory,countDirectChildren,getInspectionNotices,
  GAME_GROUPS,MAX_ENTRIES_PER_GROUP,createDirectoryCounter,
  createGameDirectoryInspector,directoryIdentity
};
