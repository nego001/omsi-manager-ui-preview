'use strict';
// Separate Node process, never bundled in the Electron app.
const {claimTemporaryFixture,inspectTemporaryClaim}=
 require('./temp-recovery-concurrency.cjs');
const [action,root,nonce,actor]=process.argv.slice(2);
(async()=>{
 if(action==='inspect'){
  console.log(JSON.stringify(await inspectTemporaryClaim(root,nonce)));
  return;
 }
 if(action!=='try'&&action!=='hold')
  throw Error('Unknown concurrency fixture action');
 const state=await claimTemporaryFixture(root,nonce,actor);
 console.log(JSON.stringify(state));
 if(action==='hold'&&state.status==='claimed'){
  // Keep only the test subprocess alive until the parent forcibly ends it.
  // No cleanup hook, unlink, or automatic lease stealing is registered.
  setInterval(()=>{},1000);
 }
})().catch(error=>{console.error(error.message);process.exitCode=3;});
