'use strict';
const {publishUntilKilled,inspect}=require('./m97-interrupted-multifile-transaction.cjs');
const [action,root,nonce,point]=process.argv.slice(2);
(async()=>{
 if(action==='publish'&&/^[0-3]$/.test(point))await publishUntilKilled(root,nonce,Number(point));
 else if(action==='inspect')console.log(JSON.stringify(await inspect(root,nonce)));
 else throw Error('M97_FIXTURE_REFUSED');
})().catch(()=>{console.error('M97_FIXTURE_REFUSED');process.exitCode=3;});
