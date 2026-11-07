'use strict';
// TEST-ONLY proposed IPC boundary for a future separately-privileged verifier.
// Does not create a service, authenticate an OS user, or grant permissions.
const MAX_FRAME_BYTES=160;
const MAX_ACCEPTED=32;
const MAX_ATTEMPTS=128;
const OPS=Object.freeze(['arm','verify','shutdown']);
const LAB_POLICY=Object.freeze({
 schema:'omsi-synthetic-service-boundary-v1',
 principalSeparationProven:false,
 peerCredentialsVerified:false,
 osProtectedChannel:false,
 persistentKeyCustodyProven:false,
 operationsEnabled:false,
 supportsRealGameInspection:false,
 acceptsClientPaths:false,
 acceptsClientKeys:false,
 allowsSigningArbitraryData:false
});

// Streaming framing discards overlength input BEFORE JSON parsing. It never
// accumulates more than 160 bytes for a frame, even without a newline.
async function* boundedFrames(source){
 let bytes=[],oversize=false;
 for await(const chunk of source){
  for(const byte of chunk){
   if(byte===10){
    yield oversize?null:Buffer.from(bytes).toString('utf8');
    bytes=[];oversize=false;
   }else if(!oversize){
    if(bytes.length>=MAX_FRAME_BYTES)oversize=true;
    else bytes.push(byte);
   }
  }
 }
 if(oversize||bytes.length)yield null;
}
function createSyntheticServiceBoundary(){
 let highest=0,accepted=0,attempts=0,closed=false;
 return Object.freeze({
  // No arbitrary scope or role claims. Caller cannot "attest" itself:
  // OS peer identity and ACLs MUST be proven separately in future work.
  admit(line){
   attempts++;
   if(closed||attempts>MAX_ATTEMPTS||
      typeof line!=='string'||Buffer.byteLength(line,'utf8')>MAX_FRAME_BYTES)
    return null;
   let value;
   try{value=JSON.parse(line);}catch{return null;}
   if(!value||Array.isArray(value)||typeof value!=='object'||
      Object.keys(value).sort().join(',')!=='id,op'||
      !Number.isSafeInteger(value.id)||value.id<=highest||
      value.id<1||value.id>9999||
      !OPS.includes(value.op)||
      JSON.stringify({id:value.id,op:value.op})!==line||
      accepted>=MAX_ACCEPTED)return null;
   // Monotonic session IDs resist simple replay and reordering, not
   // cross-process attacks or replay after a new process is launched.
   highest=value.id;
   accepted++;
   if(value.op==='shutdown')closed=true;
   return Object.freeze({id:value.id,op:value.op});
  },
  policy(){
   return LAB_POLICY; // invariant data, NEVER a runtime attestation
  }
 });
}
module.exports={createSyntheticServiceBoundary,boundedFrames,LAB_POLICY,
 MAX_FRAME_BYTES,MAX_ACCEPTED,MAX_ATTEMPTS};
