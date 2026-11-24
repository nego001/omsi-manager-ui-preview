'use strict';
// Only the test controller forks this worker. No PID input or external kill API.
const {interrupt}=require('./m90-interrupted-restore-fixture.cjs');
const [root,nonce,point]=process.argv.slice(2);
interrupt(root,nonce,point,'external').then(()=>{
 // A requested external checkpoint must never complete normally.
 process.exitCode=4;
}).catch(()=>{console.error('M91_FIXTURE_REFUSED');process.exitCode=3;});
