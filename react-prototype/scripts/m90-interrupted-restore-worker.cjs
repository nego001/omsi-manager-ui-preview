'use strict';
const {interrupt,inspectAfterRestart}=require('./m90-interrupted-restore-fixture.cjs');
const [action,root,nonce,point]=process.argv.slice(2);
(async()=>{
 if(action==='interrupt')await interrupt(root,nonce,point);
 else if(action==='inspect')console.log(JSON.stringify(await inspectAfterRestart(root,nonce)));
 else throw Error('M90_FIXTURE_REFUSED');
})().catch(()=>{console.error('M90_FIXTURE_REFUSED');process.exitCode=3;});
