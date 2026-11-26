// F3.07b: material and texture-object reference evidence; synthetic inputs only.
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_MATERIAL_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
function index(path,bytes,maxBytes){
 return buildFixtureIndex({scope:'synthetic-fixture',limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes,maxEntryBytes:maxBytes},entries:[{path,kind:'file',bytes}]}).entries[0];
}
export function inspectFixtureMaterial(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','path','bytes','limits']),l=record(x.limits,['maxBytes','maxLines','maxReferences']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,1,1024*1024)||x.bytes.length>l.maxBytes||
 !int(l.maxLines,1,16384)||!int(l.maxReferences,0,4096))fail();
 const b=Buffer.from(x.bytes),source=index(x.path,b,l.maxBytes),format=x.path.split('.').pop().toLowerCase();
 const refs=[],attributes=[];let effect=null,sampler=null;
 function ref(path,role,position){
  if(refs.length>=l.maxReferences||!path.toLowerCase().endsWith(role==='texture-object'?'.tobj':'.dds'))fail();
  const rooted=path.startsWith('/');index(rooted?path.slice(1):path,Buffer.alloc(0),0);
  refs.push(Object.freeze({role,path,namespace:rooted?'game-virtual-root':'relative-unresolved',position,resolution:'not-attempted'}));
 }
 if(format==='mat'){
  const data=new TextDecoder('utf-8',{fatal:true}).decode(b);
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/u.test(data)||/\r(?!\n)/.test(data))fail();
  const lines=data.split(/\r?\n/);if(lines.length>l.maxLines||lines.some(s=>s.length>2048))fail();
  let state='header';const keys=new Set();
  for(let j=0;j<lines.length;j++){
   const s=lines[j].trim();if(!s||s.startsWith('#')||s.startsWith('//'))continue;
   if(state==='header'){
    const m=/^material\s*:\s*"([A-Za-z0-9_.-]{1,128})"\s*(\{)?$/.exec(s);
    if(!m)fail();effect=m[1];state=m[2]?'body':'brace';continue;
   }
   if(state==='brace'){if(s!=='{')fail();state='body';continue;}
   if(state!=='body')fail();
   if(s==='}'){state='done';continue;}
   const m=/^([A-Za-z_][A-Za-z0-9_]{0,63}(?:\[[0-9]{1,4}\])?)\s*:\s*(.+)$/.exec(s);
   if(!m||keys.has(m[1]))fail();keys.add(m[1]);const [,key,value]=m;
   const tex=/^texture\[(0|[1-9][0-9]{0,3})\]$/.exec(key);
   const str=/^"([^"\\]*)"$/.exec(value);
   if(tex){if(!str)fail();ref(str[1],'texture-object',j+1);}
   else{
    const num=/^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
    const values=value.startsWith('{')&&value.endsWith('}')?value.slice(1,-1).split(',').map(v=>v.trim()):[value];
    if(!str&&!(values.length>=1&&values.length<=4&&values.every(v=>num.test(v)&&Number.isFinite(Number(v)))))fail();
   }
   attributes.push(Object.freeze({key,line:j+1,kind:tex?'texture-reference':str?'string':'numeric'}));
  }
  if(state!=='done')fail();
 }else if(format==='tobj'){
  if(b.length<48||b.readUInt32LE(0)!==1890650625||b[24]!==2)fail();
  if(![0,1,3].includes(b[26])||![0,1,3].includes(b[27])||b[28]>3||
   [30,31,32].some(o=>b[o]>6)||[33,35,38].some(o=>b[o]>1))fail();
  const len=b.readUInt32LE(40);
  if(!int(len,1,240)||48+len!==b.length)fail();
  const raw=b.subarray(48);if(raw.some(v=>v<32||v>126))fail();
  ref(raw.toString('ascii'),'texture',48);
  sampler=Object.freeze({magFilter:b[26],minFilter:b[27],mipFilter:b[28],addressU:b[30],addressV:b[31],addressW:b[32],
   colorSpace:b[38]?'linear':'srgb',compressionRequested:b[33]===0,anisotropicRequested:b[35]===0});
 }else fail();
 return Object.freeze({schemaVersion:1,scope:x.scope,format,source,effect,sampler,attributes:Object.freeze(attributes),references:Object.freeze(refs),
 fixtureMaterialSubsetValidated:true,fullMaterialSupport:false,dependenciesResolved:false,shaderExecuted:false,
 realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
