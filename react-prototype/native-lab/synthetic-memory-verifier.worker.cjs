'use strict';
// TEST-ONLY process boundary: ephemeral key never leaves this child process.
// Same-user administrators/debuggers can still inspect/replace the process;
// there is NO distinct operating-system principal, TPM or production trust.
const {createSyntheticServiceBoundary,boundedFrames,LAB_POLICY}=
 require('./synthetic-service-boundary.cjs');
const {randomBytes,createHmac,timingSafeEqual}=require('node:crypto');
const {readSyntheticOperationLedger}=require('./synthetic-operation-ledger.cjs');

const DOMAIN='OMSI-SYNTHETIC-VOLATILE-VERIFIER-V1';
const REFUSAL='Synthetic memory verifier refused';
const args=process.argv.slice(2);
let secret=null;
let seal=null;
let armed=false;
let ended=false;
const admission=createSyntheticServiceBoundary();
function mac(witness,nonce){
 const input=JSON.stringify({
  domain:DOMAIN,nonce,head:witness.chainHead,count:witness.events.length
 });
 return createHmac('sha256',secret).update(input,'utf8').digest();
}
function send(obj){process.stdout.write(JSON.stringify(obj)+'\n');}
async function handle(req){
 if(!req||!['arm','verify','shutdown'].includes(req.op)){
  send({id:null,result:'refused'});return;
 }
 if(req.op==='shutdown'){
  if(secret)secret.fill(0);
  secret=null;seal=null;ended=true;
  send({id:req.id,result:'closed'});
  process.exitCode=0;
  process.stdin.pause();
  return;
 }
 if(req.op==='arm'){
  if(armed){send({id:req.id,result:'refused'});return;}
  // A key is generated inside this process and is never returned or
  // persisted. No caller-supplied digest, pathname or content is accepted.
  try{
   const witness=await readSyntheticOperationLedger(args[0],args[1]);
   secret=randomBytes(32);
   seal=mac(witness,args[1]);
   armed=true;
   send({id:req.id,result:'armed'});
  }catch{send({id:req.id,result:'refused'});}
  return;
 }
 if(!armed||!secret||!seal){
  send({id:req.id,result:'unverifiable_incomplete'});return;
 }
 try{
  const witness=await readSyntheticOperationLedger(args[0],args[1]);
  const fresh=mac(witness,args[1]);
  const verified=timingSafeEqual(seal,fresh);
  fresh.fill(0);
  send({id:req.id,result:verified?'matched':'unverifiable_incomplete',
   status:verified?witness.status:'unverifiable_incomplete'});
 }catch{
  send({id:req.id,result:'unverifiable_incomplete',
   status:'unverifiable_incomplete'});
 }
}
async function main(){
 if(args.length!==2)throw Error(REFUSAL);
 // Authenticate the nonce-marked, disposable fixture before indicating ready.
 await readSyntheticOperationLedger(args[0],args[1]);
 send({result:'ready'});
 // No privilege or identity claims are derived from client IPC. This
 // experiment explicitly DOES NOT attest a separate OS service principal.
 if(LAB_POLICY.principalSeparationProven||
    LAB_POLICY.operationsEnabled||LAB_POLICY.supportsRealGameInspection)
  throw Error(REFUSAL);
 // Streaming decoder bounds memory BEFORE a newline. Session IDs must be
 // strictly increasing; invalid frames never authorize any operation.
 for await(const line of boundedFrames(process.stdin)){
  if(ended)break;
  await handle(admission.admit(line));
  if(ended)break;
 }
}
main().catch(()=>{
 process.stderr.write(REFUSAL+'\n');
 process.exitCode=3;
}).finally(()=>{
 if(secret)secret.fill(0);
 secret=null;seal=null;
});
