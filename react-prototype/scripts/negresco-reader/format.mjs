// F3.02 — bounded signature inspection of synthetic buffers, not decoding.
// No filesystem, archive expansion, executable invocation or authorization.
const fail=()=>{throw Error('READER_FIXTURE_FORMAT_REFUSED');};
const sig=(hex)=>Buffer.from(hex,'hex');
const rules=[
 {format:'zip',magic:sig('504b0304'),min:30,category:'archive'},
 {format:'zip',magic:sig('504b0506'),min:22,category:'archive'},
 {format:'rar5',magic:sig('526172211a070100'),min:9,category:'archive'},
 {format:'rar4',magic:sig('526172211a0700'),min:8,category:'archive'},
 {format:'7z',magic:sig('377abcaf271c'),min:32,category:'archive'},
 {format:'scs-hashfs',magic:sig('53435323'),min:8,category:'archive'},
 {format:'dds',magic:sig('44445320'),min:128,category:'texture',check:b=>b.readUInt32LE(4)===124&&b.readUInt32LE(76)===32&&b.readUInt32LE(12)>0&&b.readUInt32LE(16)>0},
 {format:'png',magic:sig('89504e470d0a1a0a'),min:33,category:'texture',check:b=>b.readUInt32BE(8)===13&&b.subarray(12,16).equals(Buffer.from('IHDR'))&&b.readUInt32BE(16)>0&&b.readUInt32BE(20)>0},
 {format:'jpeg',magic:sig('ffd8ff'),min:4,category:'texture'},
 {format:'ogg',magic:sig('4f676753'),min:27,category:'audio',check:b=>b[4]===0&&b.length>=27+b[26]},
 {format:'riff-wave',magic:sig('52494646'),min:12,category:'audio',check:b=>b.subarray(8,12).equals(Buffer.from('WAVE'))&&b.readUInt32LE(4)>=4}
];
const extensions=Object.freeze({
 zip:['zip','scs'],rar4:['rar'],rar5:['rar'],'7z':['7z'],'scs-hashfs':['scs'],
 dds:['dds'],png:['png'],jpeg:['jpg','jpeg'],ogg:['ogg'],'riff-wave':['wav']
});
const candidates=Object.freeze({
 bus:'omsi-config-candidate',ovh:'omsi-config-candidate',cfg:'config-candidate',
 osc:'omsi-script-candidate',o3d:'omsi-model-candidate',sii:'scs-definition-candidate',
 sui:'scs-definition-candidate',pmd:'scs-model-candidate',pmg:'scs-model-candidate',
 pma:'scs-animation-candidate',tobj:'scs-texture-reference-candidate',
 bank:'audio-bank-candidate'
});
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
function prefix(b,m){return b.length>=m.length&&b.subarray(0,m.length).equals(m);}
export function identifyFixtureFormat(input){
 const x=record(input,['scope','bytes','extension']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||x.bytes.length>16*1024*1024||
 typeof x.extension!=='string'||!/^(?:[a-z0-9]{1,12})?$/.test(x.extension))fail();
 const b=x.bytes,ext=x.extension;
 let format=null,category=null,status='unknown',evidence='none',extensionMatch=null,extensionHint=null;
 // Only compare actual magic bytes, never infer a verified format from a name.
 const rule=rules.find(r=>prefix(b,r.magic));
 if(rule){
  // RIFF is a container family, not necessarily WAVE. Distinguish non-WAVE.
  if(rule.format==='riff-wave'&&b.length>=12&&!b.subarray(8,12).equals(Buffer.from('WAVE'))){
   status='unsupported-riff';evidence='family-signature';category='container';
  }else{
   format=rule.format;category=rule.category;evidence='binary-signature';
   status=b.length<rule.min?'truncated':rule.check&&!rule.check(b)?'invalid-header':'signature-recognized';
   extensionMatch=ext?extensions[format].includes(ext):null;
  }
 }else if(b.length>=2&&rules.some(r=>b.length<r.magic.length&&r.magic.subarray(0,b.length).equals(b))){
  status='truncated-signature';evidence='partial-signature';
 }else if(ext&&Object.hasOwn(candidates,ext)){
  status='extension-hint-only';extensionHint=candidates[ext];evidence='extension-only';
 }
 return Object.freeze({schemaVersion:1,scope:x.scope,status,format,category,evidence,
  extensionMatch,extensionHint,byteCount:b.length,fullFormatValidated:false,
  gameIdentityVerified:false,compatibilityVerified:false,realReadsPerformed:false,
  extractionPerformed:false,operationsEnabled:false});
}
