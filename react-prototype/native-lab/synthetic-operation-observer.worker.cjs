'use strict';
// Disposable witness subprocess for CI only; never bundled with Electron.
// A separate test parent sends fixed events and forcibly stops this observer.
const {createInterface}=require('node:readline');
const {createSyntheticOperationLedger}=require('./synthetic-operation-ledger.cjs');
const EVENTS=new Set([
 'started','intermediate_observed','bytes_restored_unconfirmed',
 'interrupted','completed_observed'
]);

async function main(){
 if(process.argv.length!==4)throw Error('unexpected arguments');
 const witness=await createSyntheticOperationLedger(process.argv[2],process.argv[3]);
 try{
  process.stdout.write('OBSERVER_READY\n');
  const reader=createInterface({input:process.stdin,crlfDelay:Infinity});
  for await(const event of reader){
   if(event==='CLOSE'){
    process.stdout.write('OBSERVER_CLOSED\n');
    break;
   }
   if(!EVENTS.has(event))throw Error('unexpected synthetic event');
   await witness.append(event); // Handle.sync() finishes before acknowledgement
   process.stdout.write('SYNCED:'+event+'\n');
  }
 }finally{
  await witness.close();
 }
}
main().catch(()=>{
 process.stderr.write('Synthetic operation witness refused\n');
 process.exitCode=3;
});
