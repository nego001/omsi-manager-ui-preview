// F3.04: deliberately narrow OMSI configuration reader for synthetic buffers.
// No filesystem, script execution, asset loading or dependency resolution.
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_OMSI_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
const rules=new Map([
 ['model',['vehicle','model-config','.cfg',false]],['sound',['vehicle','sound-config','.cfg',false]],
 ['script',['vehicle','script','.osc',true]],['varnamelist',['vehicle','variables','.txt',true]],
 ['stringvarnamelist',['vehicle','string-variables','.txt',true]],['constfile',['vehicle','constants','.txt',true]],
 ['mesh',['config','mesh','.o3d',false]]
]);
const tag=/^\[([a-zA-Z][a-zA-Z0-9_]*)\]$/;
function pathIndex(path,bytes,maxBytes){
 return buildFixtureIndex({scope:'synthetic-fixture',limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes,maxEntryBytes:maxBytes},
 entries:[{path,kind:'file',bytes}]}).entries[0];
}
export function inspectFixtureOmsi(input){
 try{return inspect(input);}catch{fail();}
}
function inspect(input){
 const x=record(input,['scope','path','bytes','encoding','limits']);
 const l=record(x.limits,['maxBytes','maxLines','maxLineLength','maxSections','maxReferences']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,1,1024*1024)||
 x.bytes.length>l.maxBytes||!int(l.maxLines,1,16384)||!int(l.maxLineLength,1,2048)||
 !int(l.maxSections,1,2048)||!int(l.maxReferences,0,4096)||!['utf-8','windows-1252'].includes(x.encoding))fail();
 const bytes=Buffer.from(x.bytes),source=pathIndex(x.path,bytes,l.maxBytes);
 const ext=x.path.slice(x.path.lastIndexOf('.')).toLowerCase();
 if(!['.bus','.ovh','.cfg'].includes(ext))fail();
 const kind=ext==='.cfg'?'config':'vehicle';
 let data=new TextDecoder(x.encoding,{fatal:true}).decode(bytes);
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/u.test(data)||/\r(?!\n)/.test(data))fail();
 const lines=data.split(/\r?\n/);
 if(lines.length>l.maxLines||lines.some(s=>s.length>l.maxLineLength))fail();
 const sections=[],references=[];
 let current=null,unparsedLineCount=0;
 function finish(){
  if(!current)return;
  const {name,line,rows}=current;
  const rule=rules.get(name);
  if(!rule||rule[0]!==kind){
   sections.push(Object.freeze({tag:name,line,status:'uninterpreted',valueCount:rows.length}));
   return;
  }
  const [,role,suffix,counted]=rule;
  let values=rows;
  if(counted){
   if(!rows.length||!/^(0|[1-9][0-9]{0,3})$/.test(rows[0].value))fail();
   if(Number(rows[0].value)!==rows.length-1)fail();
   values=rows.slice(1);
  }else if(rows.length!==1)fail();
  for(const v of values){
   const path=v.value.replace(/\\/g,'/');
   if(!path.toLowerCase().endsWith(suffix)||references.length>=l.maxReferences)fail();
   pathIndex(path,Buffer.alloc(0),0);
   references.push(Object.freeze({role,tag:name,sectionLine:line,line:v.line,path,resolution:'not-attempted'}));
  }
  sections.push(Object.freeze({tag:name,line,status:'parsed-subset',valueCount:rows.length}));
 }
 for(let i=0;i<lines.length;i++){
  const raw=lines[i],v=raw.trim();
  if(!v)continue;
  const m=tag.exec(v);
  if(m){
   finish();
   if(sections.length>=l.maxSections)fail();
   current={name:m[1],line:i+1,rows:[]};
  }else{
   if(v.startsWith('[')||v.endsWith(']'))fail();
   if(!current)unparsedLineCount++;
   else current.rows.push({value:v,line:i+1});
  }
 }
 finish();
 if(!sections.length)fail();
 const uninterpretedSectionCount=sections.filter(s=>s.status==='uninterpreted').length;
 return Object.freeze({schemaVersion:1,scope:x.scope,format:ext.slice(1),source,encoding:x.encoding,
 sections:Object.freeze(sections),references:Object.freeze(references),unparsedLineCount,uninterpretedSectionCount,
 fixtureOmsiSubsetValidated:true,fullOmsiSupport:false,dependenciesResolved:false,
 realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
