// F3.05 — conservative, line-oriented synthetic SII/SUI subset.
// No include expansion, filesystem access, binary SII decoding or asset loading.
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_SCS_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
function indexed(path,bytes,maxBytes){
 return buildFixtureIndex({scope:'synthetic-fixture',limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes,maxEntryBytes:maxBytes},entries:[{path,kind:'file',bytes}]}).entries[0];
}
const unit=/^([A-Za-z_][A-Za-z0-9_]{0,63})\s*:\s*(\.?[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)\s*(\{)?$/;
const field=/^([A-Za-z_][A-Za-z0-9_]{0,63})(\[(?:0|[1-9][0-9]{0,5})?\])?\s*:\s*(.+)$/;
const assetSuffix=/\.(?:sii|sui|pmd|pmg|pmc|mat|tobj|dds|soundref|bank|ogg|wav)$/i;
function virtualPath(s){
 if(typeof s!=='string'||s.includes('\\')||s.startsWith('//'))fail();
 const rooted=s.startsWith('/');
 indexed(rooted?s.slice(1):s,Buffer.alloc(0),0);
 return {path:s,namespace:rooted?'game-virtual-root':'relative-unresolved'};
}
function value(s){
 if(/^"[^"\\]*"$/.test(s))return {kind:'string',raw:s.slice(1,-1)};
 if(s==='true'||s==='false')return {kind:'boolean'};
 if(/^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(s)){
  if(!Number.isFinite(Number(s)))fail();return {kind:'number'};
 }
 if(/^[A-Za-z_][A-Za-z0-9_.]*$/.test(s)||/^\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*$/.test(s))return {kind:'token'};
 fail();
}
export function inspectFixtureScsDefinition(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','path','bytes','limits']);
 const l=record(x.limits,['maxBytes','maxLines','maxLineLength','maxUnits','maxFields','maxReferences']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,1,1024*1024)||x.bytes.length>l.maxBytes||
 !int(l.maxLines,1,16384)||!int(l.maxLineLength,1,2048)||!int(l.maxUnits,0,2048)||
 !int(l.maxFields,0,8192)||!int(l.maxReferences,0,4096))fail();
 const bytes=Buffer.from(x.bytes),source=indexed(x.path,bytes,l.maxBytes);
 const ext=x.path.slice(x.path.lastIndexOf('.')).toLowerCase();
 if(!['.sii','.sui'].includes(ext))fail();
 const data=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/u.test(data)||/\r(?!\n)/.test(data))fail();
 const lines=data.split(/\r?\n/);
 if(lines.length>l.maxLines||lines.some(s=>s.length>l.maxLineLength))fail();
 const units=[],fragmentFields=[],references=[],ids=new Set();
 let state=ext==='.sii'?'header':'fragment',current=null,totalFields=0;
 const pushRef=(role,s,line,unitId,attribute)=>{
  if(references.length>=l.maxReferences)fail();
  references.push(Object.freeze({role,...virtualPath(s),line,unitId,attribute,resolution:'not-attempted'}));
 };
 function addField(m,line){
  if(++totalFields>l.maxFields)fail();
  const [,attribute,index,s]=m,v=value(s);
  const target=current?current.fields:fragmentFields;
  // Preserve repeats and ordering; do not claim array/cardinality semantics.
  target.push(Object.freeze({attribute,index:index===undefined?null:index.slice(1,-1),kind:v.kind,line}));
  if(v.kind==='string'&&assetSuffix.test(v.raw))pushRef('asset-candidate',v.raw,line,current?.id??null,attribute);
 }
 for(let i=0;i<lines.length;i++){
  const s=lines[i].trim(),line=i+1;
  if(!s||s.startsWith('#')||s.startsWith('//'))continue;
  if(state==='header'){
   if(s==='SiiNunit'){state='root-brace';continue;}
   if(/^SiiNunit\s*\{$/.test(s)){state='root';continue;}fail();
  }
  if(state==='root-brace'){if(s!=='{')fail();state='root';continue;}
  if(state==='done')fail();
  if(state==='unit-brace'){if(s!=='{')fail();state='unit';continue;}
  const inc=/^@include\s+"([^"\\]+)"$/.exec(s);
  if(inc){
   if(!['root','unit','fragment'].includes(state)||!/\.(sii|sui)$/i.test(inc[1]))fail();
   pushRef('include',inc[1],line,current?.id??null,null);continue;
  }
  if(state==='root'){
   if(s==='}'){state='done';continue;}
   const m=unit.exec(s);
   if(!m||units.length>=l.maxUnits||ids.has(m[2]))fail();
   ids.add(m[2]);current={type:m[1],id:m[2],line,fields:[]};state=m[3]?'unit':'unit-brace';continue;
  }
  if(state==='unit'&&s==='}'){
   units.push(Object.freeze({...current,fields:Object.freeze(current.fields)}));current=null;state='root';continue;
  }
  const m=field.exec(s);
  if(!m||!['unit','fragment'].includes(state))fail();
  addField(m,line);
 }
 if(ext==='.sii'&&state!=='done')fail();
 if(ext==='.sui'&&!totalFields&&!references.length)fail();
 return Object.freeze({schemaVersion:1,scope:x.scope,format:ext.slice(1),source,units:Object.freeze(units),
 fragmentFields:Object.freeze(fragmentFields),references:Object.freeze(references),fieldCount:totalFields,
 fixtureScsSubsetValidated:true,fullScsSupport:false,gameIdentified:false,dependenciesResolved:false,
 includesExpanded:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
