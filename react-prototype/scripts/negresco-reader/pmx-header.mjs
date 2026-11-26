// F3.06b: SCS model header/table range evidence, not mesh decoding.
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_PMX_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
export function inspectFixturePmx(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','path','bytes','limits']),l=record(x.limits,['maxBytes','maxRecords']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,4,16*1024*1024)||
 x.bytes.length>l.maxBytes||!int(l.maxRecords,0,250000))fail();
 const b=Buffer.from(x.bytes),source=buildFixtureIndex({scope:x.scope,limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes:l.maxBytes,maxEntryBytes:l.maxBytes},entries:[{path:x.path,kind:'file',bytes:b}]}).entries[0];
 const format=x.path.split('.').pop().toLowerCase(),u=o=>b.readUInt32LE(o),i=o=>b.readInt32LE(o);
 let version,headerBytes,counts={},ranges=[],declaredBounds=null;
 function n(v){if(!int(v,0,l.maxRecords))fail();return v;}
 function region(name,offset,length){
  if(!int(length,0,b.length)||!int(offset,headerBytes,b.length)||length>b.length-offset)fail();
  ranges.push(Object.freeze({name,offset,length}));
 }
 function table(name,offset,count,stride){region(name,offset,n(count)*stride);}
 if(format==='pmd'){
  headerBytes=64;if(b.length<headerBytes||u(0)!==4)fail();version=4;
  const [materials,looks,pieces,variants,parts,attributes]=[4,8,12,16,20,24].map(o=>n(u(o)));
  counts={materials,looks,pieces,variants,parts,attributes};
  table('looks',u(36),looks,8);table('variants',u(40),variants,8);
  table('part-links',u(44),parts,8);table('attribute-definitions',u(52),attributes,16);
  region('attribute-values',u(48),variants*u(28));
  table('material-offsets',u(56),looks*materials,4);region('material-data',u(60),u(32));
 }else if(format==='pmc'){
  headerBytes=40;if(b.length<headerBytes||u(0)!==6)fail();version=6;
  const [looks,variants,materials,pieces]=[4,8,12,16].map(o=>n(u(o)));
  counts={looks,variants,materials,pieces};
  // The material and look payload schemas are intentionally not interpreted.
  // Validate their declared offsets only, without claiming table coverage.
  region('look-start',u(20),0);table('variants',u(24),variants,8);
  region('material-start',u(28),0);table('pieces',u(32),pieces,16);
  table('variant-definitions',u(36),variants,4);
 }else if(format==='pmg'){
  version=b[0];if(![0x14,0x15].includes(version)||b.subarray(1,4).toString('latin1')!=='gmP')fail();
  const delta=version===0x15?8:0;headerBytes=104+delta;if(b.length<headerBytes)fail();
  const [pieces,parts,bones,weightWidth,locators]=[4,8,12,16,20].map(o=>n(i(o)));
  counts={pieces,parts,bones,weightWidth,locators};
  const f=o=>{const v=b.readFloatLE(o);if(!Number.isFinite(v))fail();return v===0?0:v;};
  const center=[0,4,8].map(o=>f(24+delta+o)),diagonal=f(36+delta);
  const min=[0,4,8].map(o=>f(40+delta+o)),max=[0,4,8].map(o=>f(52+delta+o));
  if(diagonal<0||min.some((v,j)=>v>max[j]))fail();
  declaredBounds=Object.freeze({center:Object.freeze(center),diagonal,min:Object.freeze(min),max:Object.freeze(max)});
  table('bones',i(64+delta),bones,200);table('parts',i(68+delta),parts,24);
  table('locators',i(72+delta),locators,44);table('pieces',i(76+delta),pieces,100);
  region('strings',i(80+delta),i(84+delta));region('vertices',i(88+delta),i(92+delta));
  region('indices',i(96+delta),i(100+delta));
 }else fail();
 const occupied=ranges.filter(r=>r.length>0).sort((a,b)=>a.offset-b.offset);
 for(let j=1;j<occupied.length;j++)if(occupied[j].offset<occupied[j-1].offset+occupied[j-1].length)fail();
 return Object.freeze({schemaVersion:1,scope:x.scope,format,version,source,headerBytes,counts:Object.freeze(counts),
 ranges:Object.freeze(ranges),declaredBounds,fixturePmxHeaderSubsetValidated:true,
 payloadValidated:false,geometryDecoded:false,collisionDecoded:false,dependenciesResolved:false,
 fullPmxSupport:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
