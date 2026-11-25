import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyProposal} from './verify-negresco-lock-proposal.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function sample(){
 const manifest=Buffer.from('{\n  "name": "sample"\n}\n');
 const lock=Buffer.from('{"lockfileVersion":3}\n');
 const revision='a'.repeat(40);
 return {revision,gitManifest:manifest,manifest,artifactManifest:manifest,lock,trackedLock:null,
  record:{schema:1,sourceRevision:revision,manifestSha256:hash(manifest),lockSha256:hash(lock),
   lifecycleScriptsExecuted:false,buildValidated:false,releaseAuthorized:false}};
}
test('accepts exact byte identity, including an identical tracked lock',()=>{
 const x=sample();assert.equal(verifyProposal(x),true);
 assert.equal(verifyProposal({...x,trackedLock:Buffer.from(x.lock)}),true);
});
test('refuses CRLF checkout with a specific diagnostic rather than weakening the hash',()=>{
 const x=sample();
 assert.throws(()=>verifyProposal({...x,manifest:Buffer.from(x.manifest.toString().replace(/\n/g,'\r\n'))}),/LOCK_PROPOSAL_CHECKOUT_CRLF/);
});
test('refuses altered revision, Git blob, artifact, local manifest, lock and tracked lock',()=>{
 const x=sample(),bad=Buffer.from('altered');
 for(const [patch,reason] of [
  [{revision:'b'.repeat(40)},/REVISION_MISMATCH/],
  [{gitManifest:bad},/GIT_MANIFEST_MISMATCH/],
  [{manifest:bad},/CHECKOUT_MANIFEST_MISMATCH/],
  [{artifactManifest:bad},/ARTIFACT_MANIFEST_MISMATCH/],
  [{lock:bad},/ARTIFACT_LOCK_MISMATCH/],
  [{trackedLock:bad},/TRACKED_LOCK_MISMATCH/],
  [{record:{...x.record,releaseAuthorized:true}},/BOUNDARY_MISMATCH/]
 ])assert.throws(()=>verifyProposal({...x,...patch}),reason);
});
