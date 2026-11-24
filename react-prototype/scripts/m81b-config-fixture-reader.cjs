'use strict';
// CI fixture laboratory only. No pathname, CLI, IPC or runtime integration.
// A test-owned handle is NOT authenticated provenance or a production sandbox.
const {TextDecoder}=require('node:util');
const MAX_BYTES=65536,CHUNK=4096;
const refuse=()=>{throw Error('M81B_FIXTURE_REFUSED');};
function identity(s){
 if(!s.isFile()||s.nlink!==1n||s.size<1n||s.size>BigInt(MAX_BYTES))refuse();
 return [s.dev,s.ino,s.size,s.mode,s.nlink,s.mtimeNs,s.ctimeNs].join(':');
}
async function readSyntheticHandle(handle){
 try{
  const before=await handle.stat({bigint:true}),expected=identity(before);
  const size=Number(before.size);
  const snapshots=[];
  for(let pass=0;pass<2;pass++){
   const out=Buffer.alloc(size);
   let offset=0;
   while(offset<size){
    const length=Math.min(CHUNK,size-offset);
    const {bytesRead}=await handle.read(out,offset,length,offset);
    if(!Number.isInteger(bytesRead)||bytesRead<1||bytesRead>length)refuse();
    offset+=bytesRead;
   }
   if(identity(await handle.stat({bigint:true}))!==expected)refuse();
   snapshots.push(out);
  }
  if(!snapshots[0].equals(snapshots[1]))refuse();
  return snapshots[0];
 }catch{refuse();}
}
function decodeSyntheticConfig(bytes,encoding){
 if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>MAX_BYTES)refuse();
 // Explicit fixture encoding; no silent fallback or real OMSI encoding claim.
 if(!['utf-8','windows-1252'].includes(encoding))refuse();
 if(encoding==='windows-1252'&&bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf)refuse();
 let text;
 try{text=new TextDecoder(encoding,{fatal:true}).decode(bytes);}
 catch{refuse();}
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/u.test(text))refuse();
 return text;
}
module.exports={readSyntheticHandle,decodeSyntheticConfig,MAX_BYTES};
