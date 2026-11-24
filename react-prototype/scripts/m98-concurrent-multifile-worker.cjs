'use strict';
// Test-only cooperating processes. Exclusive file creation is a reservation,
// not a native OS lock or proof of ownership. Never reclaim it automatically.
const {claimTemporaryFixture}=require('./temp-recovery-concurrency.cjs');
const {publishUntilKilled}=require('./m97-interrupted-multifile-transaction.cjs');
const [root,nonce,actor,point]=process.argv.slice(2);
async function main(){
 if(typeof process.send!=='function'||!process.connected||
    !['session-a','session-b'].includes(actor)||!/^[0-3]$/.test(point||''))
  throw Error('M98_FIXTURE_REFUSED');
 const claim=await claimTemporaryFixture(root,nonce,actor);
 if(claim.status==='busy'){
  // A refused worker never reaches the publication function.
  await new Promise((resolve,reject)=>process.send({kind:'m98-busy'},e=>e?reject(e):resolve()));
  process.disconnect();
  return;
 }
 if(claim.status!=='claimed')throw Error('M98_FIXTURE_REFUSED');
 await publishUntilKilled(root,nonce,Number(point));
}
main().catch(()=>{
 console.error('M98_FIXTURE_REFUSED');process.exitCode=3;
 if(process.connected)process.disconnect();
});
