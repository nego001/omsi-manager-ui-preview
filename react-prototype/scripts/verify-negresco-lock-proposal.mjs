import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Error(code);};
// Pure byte contract: never normalize, reserialize or accept a different digest.
export function verifyProposal({record,revision,gitManifest,manifest,artifactManifest,lock,trackedLock}){
 if(!record||record.schema!==1||record.sourceRevision!==revision||
    typeof revision!=='string'||!/^[0-9a-f]{40}$/.test(revision))fail('LOCK_PROPOSAL_REVISION_MISMATCH');
 if(record.lifecycleScriptsExecuted!==false||record.buildValidated!==false||
    record.releaseAuthorized!==false)fail('LOCK_PROPOSAL_BOUNDARY_MISMATCH');
 if(hash(gitManifest)!==record.manifestSha256)fail('LOCK_PROPOSAL_GIT_MANIFEST_MISMATCH');
 if(!manifest.equals(gitManifest)){
  if(manifest.equals(Buffer.from(gitManifest.toString('utf8').replace(/\n/g,'\r\n'))))
   fail('LOCK_PROPOSAL_CHECKOUT_CRLF');
  fail('LOCK_PROPOSAL_CHECKOUT_MANIFEST_MISMATCH');
 }
 if(hash(artifactManifest)!==record.manifestSha256)fail('LOCK_PROPOSAL_ARTIFACT_MANIFEST_MISMATCH');
 if(hash(lock)!==record.lockSha256)fail('LOCK_PROPOSAL_ARTIFACT_LOCK_MISMATCH');
 if(trackedLock!==null&&!trackedLock.equals(lock))fail('TRACKED_LOCK_MISMATCH');
 return true;
}
function main(){
 const record=JSON.parse(readFileSync('lock-proposal/resolution.json','utf8'));
 const lock=readFileSync('lock-proposal/package-lock.json');
 verifyProposal({record,revision:process.env.GITHUB_SHA,
  gitManifest:execFileSync('git',['show','HEAD:react-prototype/package.json'],{maxBuffer:65536}),
  manifest:readFileSync('package.json'),
  artifactManifest:readFileSync('lock-proposal/package.json'),lock,
  trackedLock:existsSync('package-lock.json')?readFileSync('package-lock.json'):null});
 if(!existsSync('package-lock.json'))writeFileSync('package-lock.json',lock,{flag:'wx'});
 console.log('LOCK_PROPOSAL_EXACT_BYTES_VERIFIED',process.platform);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main();
