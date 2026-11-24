'use strict';
// Synthetic virtual inventory only. No filesystem or OS path semantics.
// A deliberately restricted ASCII path subset; unsupported is not absent.
const {referenceScope}=require('./m81c-config-format-contract.cjs');
const MAX_FILES=512,MAX_REFS=256,MAX_PATH=240,MAX_DEPTH=16;
const refused=()=>{throw Error('M81D_FIXTURE_REFUSED');};
function segments(raw){
 if(typeof raw!=='string'||raw.length<1||raw.length>MAX_PATH)return null;
 const parts=raw.replace(/\\/g,'/').split('/');
 if(parts.length>MAX_DEPTH)return null;
 for(const part of parts){
  if(!/^[A-Za-z0-9_-][A-Za-z0-9_. -]{0,79}$/.test(part)||/[ .]$/.test(part)||
     /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part))return null;
 }
 return parts;
}
function createNode(){return {children:new Map(),folded:new Map(),file:false};}
function add(root,parts){
 let node=root;
 for(const part of parts){
  if(node.file)refused();
  if(!node.children.has(part)){
   node.children.set(part,createNode());
   const key=part.toLowerCase();
   if(!node.folded.has(key))node.folded.set(key,[]);
   node.folded.get(key).push(part);
  }
  node=node.children.get(part);
 }
 if(node.file||node.children.size)refused();
 node.file=true;
}
function lookup(root,parts,complete){
 let node=root,caseOnly=false;
 for(const part of parts){
  if(node.file)return 'not-file-path';
  const names=node.folded.get(part.toLowerCase())??[];
  if(names.length>1)return 'ambiguous-case';
  if(!names.length)return complete?'absent-from-fixture':'not-observed';
  if(names[0]!==part)caseOnly=true;
  node=node.children.get(names[0]);
 }
 return !node.file?'not-file-path':caseOnly?'case-only':'exact';
}
function resolveSyntheticReferences({files,references,complete}={}){
 if(!Array.isArray(files)||files.length>MAX_FILES||!Array.isArray(references)||
    references.length>MAX_REFS||typeof complete!=='boolean')refused();
 const root=createNode();
 for(const name of files){
  const parts=segments(name);
  if(!parts)refused();
  add(root,parts);
 }
 const results=[];
 for(const ref of references){
  if(!ref||typeof ref!=='object')refused();
  const {kind,keyword,source,target}=ref;
  const scope=referenceScope(kind,keyword);
  // Only reviewed synthetic [model] and [mesh] relationships are admitted.
  // Other keyword hints from M81C must not become missing-file claims.
  const model=kind==='vehicle-definition'&&keyword==='[model]'&&scope==='vehicle-root';
  const mesh=kind==='vehicle-model'&&keyword==='[mesh]'&&scope==='model-directory';
  if(!model&&!mesh){results.push('unsupported-reference');continue;}
  const src=segments(source),dest=segments(target);
  if(!src||!dest||
     !(model?/\.(bus|ovh)$/i:/\.cfg$/i).test(src.at(-1))||
     !(model?/\.cfg$/i:/\.o3d$/i).test(dest.at(-1))||
     (model&&src.length!==1)){
   results.push('invalid-reference');continue;
  }
  // Refuse to attribute a reference to a source not present with exact,
  // unambiguous spelling in this single-vehicle synthetic inventory.
  if(lookup(root,src,complete)!=='exact'){
   results.push('source-unconfirmed');continue;
  }
  const resolved=model?dest:[...src.slice(0,-1),...dest];
  if(resolved.length>MAX_DEPTH||resolved.join('/').length>MAX_PATH){
   results.push('invalid-reference');continue;
  }
  results.push(lookup(root,resolved,complete));
 }
 const counts={};
 for(const status of results)counts[status]=(counts[status]??0)+1;
 return {source:'synthetic-virtual-inventory',complete,results,counts,
  realFilesInspected:false,compatibilityVerified:false,operationsEnabled:false};
}
module.exports={resolveSyntheticReferences};
