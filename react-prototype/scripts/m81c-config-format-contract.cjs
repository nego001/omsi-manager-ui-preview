'use strict';
// Lab-only format admission. Never used by application IPC or file discovery.
const {TextDecoder}=require('node:util');
const {MAX_BYTES}=require('./m81b-config-fixture-reader.cjs');
const refuse=()=>{throw Error('M81C_FORMAT_REFUSED');};
const vehicleEncodings=new Set(['utf-8','windows-1250','windows-1251','windows-1252']);
function decodeFormatFixture(bytes,kind,encoding){
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>MAX_BYTES)refuse();
 const utf16LE=bytes.length>=2&&bytes[0]===255&&bytes[1]===254;
 const utf16BE=bytes.length>=2&&bytes[0]===254&&bytes[1]===255;
 const utf8BOM=bytes.length>=3&&bytes[0]===239&&bytes[1]===187&&bytes[2]===191;
 if(kind==='map-global'||kind==='map-tile'){
  // Deliberately narrower than all possible mods: BOM-marked UTF-16LE only.
  if(encoding!=='utf-16le'||!utf16LE||bytes.length<4||bytes.length%2!==0)refuse();
 }else if(kind==='vehicle-definition'||kind==='vehicle-model'){
  if(!vehicleEncodings.has(encoding)||utf16LE||utf16BE||(utf8BOM&&encoding!=='utf-8'))refuse();
 }else refuse();
 let text;
 try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}catch{refuse();}
 if(!text||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(text))refuse();
 if(text.split(/\r?\n/).length>2048)refuse();
 return {source:'synthetic-format-fixture',kind,encoding,text};
}
// Fixed, deliberately incomplete candidate schema. No path normalization,
// existence check or compatibility claim. Caller must not treat this as a
// complete keyword parser; comments and unknown blocks need later review.
const rules=Object.freeze({
 'vehicle-definition':Object.freeze({'[model]':'vehicle-root','[sound]':'vehicle-root','[paths]':'vehicle-root','[passengercabin]':'vehicle-root'}),
 'vehicle-model':Object.freeze({'[mesh]':'model-directory'}),
 'map-global':Object.freeze({}),
 'map-tile':Object.freeze({})
});
function referenceScope(kind,keyword){
 if(typeof kind!=='string'||typeof keyword!=='string'||!Object.hasOwn(rules,kind))return 'unsupported';
 return Object.hasOwn(rules[kind],keyword)?rules[kind][keyword]:'unsupported';
}
module.exports={decodeFormatFixture,referenceScope};
