'use strict';
// Separate PROCESS used solely by Node regression tests, not the Electron app.
const {simulate,reconcile} = require('./temp-recovery-fixture.cjs');
const [action,root,nonce,checkpoint] = process.argv.slice(2);
(async()=>{
  if (action === 'simulate') {
    console.log(JSON.stringify(await simulate(root,nonce,checkpoint)));
  } else if (action === 'reconcile') {
    console.log(JSON.stringify(await reconcile(root,nonce)));
  } else { throw Error('Unknown fixture-only worker command'); }
})().catch(err=>{console.error(err.message);process.exitCode=3;});
