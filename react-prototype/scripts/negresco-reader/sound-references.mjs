// F3.08c: conservative sound configuration reference evidence.
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_SOUND_REFUSED');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
function indexed(path,bytes,maxBytes){
 return buildFixtureIndex({scope:'synthetic-fixture',limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes,maxEntryBytes:maxBytes},entries:[{path,kind:'file',bytes}]}).entries[0];
}
export function inspectFixtureSoundReferences(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','path','bytes','encoding','limits']),l=record(x.limits,['maxBytes','maxLines','maxReferences']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,1,1048576)||x.bytes.length>l.maxBytes||
 !int(l.maxLines,1,16384)||!int(l.maxReferences,0,4096)||!['utf-8','windows-1252'].includes(x.encoding))fail();
 const b=Buffer.from(x.bytes),source=indexed(x.path,b,l.maxBytes),format=x.path.split('.').pop().toLowerCase(),refs=[],sections=[];
 let bankSignature=null;
 function ref(path,role,line,event=null){
  if(refs.length>=l.maxReferences)fail();
  const rooted=path.startsWith('/');
  if(role==='omsi-audio'&&rooted)fail();
  indexed(rooted?path.slice(1):path,Buffer.alloc(0),0);
  refs.push(Object.freeze({path,role,line,event,namespace:rooted?'game-virtual-root':'relative-unresolved',resolution:'not-attempted'}));
 }
 if(format==='bank'){
  // RIFF/FEV is only a signature candidate, not proof of a usable FMOD bank.
  if(b.length<12||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='FEV '||b.readUInt32LE(4)!==b.length-8)fail();
  bankSignature='riff-fev-candidate';
 }else if(['cfg','soundref'].includes(format)){
  if(format==='soundref'&&x.encoding!=='utf-8')fail();
  const data=new TextDecoder(x.encoding,{fatal:true}).decode(b);
  if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u2028\u2029\u202a-\u202e\u2066-\u2069\ufeff]/u.test(data)||/\r(?!\n)/.test(data))fail();
  const lines=data.split(/\r?\n/);
  if(lines.length>l.maxLines||lines.some(s=>s.length>2048))fail();
  if(format==='soundref'){
   const nonempty=lines.map((s,i)=>({s:s.trim(),line:i+1})).filter(v=>v.s);
   if(nonempty.length!==1)fail();
   const m=/^source\s*=\s*"([^"#\\]+\.bank)#([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)"$/.exec(nonempty[0].s);
   if(!m||m[2].length>240||m[2].split('/').some(s=>s==='.'||s==='..'))fail();
   ref(m[1],'fmod-bank',nonempty[0].line,m[2]);
  }else{
   // Only the first nonempty value in a sound/loopsound block is interpreted.
   // Other directive values are never executed or interpreted as paths.
   let current=null;
   function finish(){
    if(!current)return;
    const known=['sound','loopsound'].includes(current.tag);
    if(known){
     if(!current.first)fail();
     const path=current.first.value.replace(/\\/g,'/');
     if(!/\.wav$/i.test(path))fail();
     ref(path,'omsi-audio',current.first.line);
    }
    sections.push(Object.freeze({tag:current.tag,line:current.line,status:known?'reference-only':'uninterpreted',valueCount:current.count}));
   }
   for(let j=0;j<lines.length;j++){
    const s=lines[j].trim();if(!s)continue;
    // [3d] is a known numeric-leading OMSI directive; retain it as opaque metadata.
    const m=/^\[(3d|[A-Za-z][A-Za-z0-9_]*)\]$/.exec(s);
    if(m){finish();current={tag:m[1],line:j+1,first:null,count:0};}
    else if(s.startsWith('[')||s.endsWith(']'))fail();
    else if(current){if(!current.first)current.first={value:s,line:j+1};current.count++;}
   }
   finish();if(!sections.length)fail();
  }
 }else fail();
 return Object.freeze({schemaVersion:1,scope:x.scope,format,source,bankSignature,sections:Object.freeze(sections),references:Object.freeze(refs),
 fixtureSoundReferenceSubsetValidated:true,bankPayloadValidated:false,eventExistenceVerified:false,
 fullSoundSupport:false,dependenciesResolved:false,audioPlayed:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
