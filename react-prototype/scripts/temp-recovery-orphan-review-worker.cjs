'use strict';
// New Node process to inspect a previous claim. Tests only; no Electron IPC.
const {createTemporaryOrphanReview,inspectTemporaryOrphanReview}=
 require('./temp-recovery-orphan-review.cjs');
const [root,nonce,rawHint]=process.argv.slice(2);
(async()=>{
 const hint=rawHint?JSON.parse(rawHint):null;
 const review=await createTemporaryOrphanReview(root,nonce);
 console.log(JSON.stringify(await inspectTemporaryOrphanReview(review,hint)));
})().catch(e=>{console.error(e.message);process.exitCode=3;});
