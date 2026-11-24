'use strict';
// Test-only contract; never imported by main, preload or renderer.
// A deliberately small synthetic grammar, not the full OMSI format.
// Each fixture uses variant-relative [model] and [mesh] names explicitly.
const MAX_BYTES=65536,MAX_LINES=2048,MAX_FILES=128,MAX_REFS=256;
function validName(value){
 return typeof value==='string'&&value.length<=160&&/^[a-zA-Z0-9_-][a-zA-Z0-9_. -]*(\/[a-zA-Z0-9_-][a-zA-Z0-9_. -]*)*$/.test(value)&&
  value.split('/').every(s=>!s.endsWith('.')&&!s.endsWith(' '));
}
function reference(raw,extension){
 const normalized=raw.replace(/\\/g,'/');
 if(!validName(normalized)||!normalized.toLowerCase().endsWith(extension))return null;
 return normalized;
}
function parseSynthetic(text,marker,extension){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>MAX_BYTES||text.includes('\0'))
  throw Error('Synthetic input refused');
 const lines=text.split(/\r?\n/);
 if(lines.length>MAX_LINES)throw Error('Synthetic input refused');
 let malformed=0;
 const refs=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(line!==marker)continue;
  const next=lines[i+1]?.trim()??'';
  const name=reference(next,extension);
  if(!name){malformed++;continue;}
  if(refs.length>=MAX_REFS)throw Error('Synthetic reference budget exceeded');
  refs.push(name);
  i++;
 }
 return {refs,malformed};
}
function inspectSyntheticDependencies(entries){
 if(!Array.isArray(entries)||entries.length>MAX_FILES)throw Error('Synthetic fixture refused');
 const files=new Map(),folded=new Map();
 let bytes=0;
 for(const item of entries){
  if(!item||!validName(item.name)||typeof item.text!=='string'||files.has(item.name))
   throw Error('Synthetic fixture refused');
  bytes+=Buffer.byteLength(item.text,'utf8');
  if(bytes>MAX_BYTES)throw Error('Synthetic fixture refused');
  files.set(item.name,item.text);
  const key=item.name.toLowerCase();
  folded.set(key,(folded.get(key)??0)+1);
 }
 const totals={modelReferences:0,meshReferences:0,exactMatches:0,caseOnlyMatches:0,ambiguousMatches:0,absentFromFixture:0,malformed:0};
 const linkedModels=new Set();
 function classify(name){
  const alternatives=folded.get(name.toLowerCase())??0;
  if(alternatives>1){totals.ambiguousMatches++;return false;}
  if(files.has(name)){totals.exactMatches++;return true;}
  if(alternatives===1)totals.caseOnlyMatches++;
  else totals.absentFromFixture++;
  return false;
 }
 function budget(){
  if(totals.modelReferences+totals.meshReferences>MAX_REFS)throw Error('Synthetic reference budget exceeded');
 }
 for(const [name,text] of files){
  if(!name.toLowerCase().endsWith('.bus'))continue;
  const parsed=parseSynthetic(text,'[model]','.cfg');
  totals.malformed+=parsed.malformed;
  for(const target of parsed.refs){
   totals.modelReferences++;budget();
   if(classify(target))linkedModels.add(target);
  }
 }
 for(const name of linkedModels){
  const parsed=parseSynthetic(files.get(name),'[mesh]','.o3d');
  totals.malformed+=parsed.malformed;
  for(const target of parsed.refs){totals.meshReferences++;budget();classify(target);}
 }
 return {source:'synthetic-fixture-only',...totals,realFilesInspected:false,compatibilityVerified:false,operationsEnabled:false};
}
module.exports={inspectSyntheticDependencies};
