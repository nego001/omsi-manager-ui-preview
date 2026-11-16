// M31: actually SHA-256 hash IN-MEMORY SYNTHETIC bytes with two runtimes.
// Node crypto + isolated Python hashlib receive the SAME caller-provided
// artificial bytes. This is not independent artifact acquisition, trusted
// package provenance, renderer confinement, real-host approval, or release.
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

export const M31_MAGIC='OMSI_M31_SYNTHETIC_BYTES_V1|';
export const M31_MAX_BYTES=8192;
const MARK=Buffer.from(M31_MAGIC,'ascii');
const LABELS=['GNOME','KDE'];
const PHASES=['baseline','app-specific-pilot','rollback'];
const HEX=/^[a-f0-9]{64}$/;
const REFUSAL='UBUNTU24_SYNTHETIC_BYTE_PROVENANCE_REFUSED';
const refuse=()=>{throw Error(REFUSAL);};
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const exact=(v,k)=>plain(v)&&Object.keys(v).length===k.length&&
 k.every(key=>Object.hasOwn(v,key));

// Python -I -S -B runs a separate interpreter and hashes stdin only.
// No filename, content URI, shell, host capability, mod path or secrets.
const PYTHON_CODE=[
 'import hashlib,sys',
 'data=sys.stdin.buffer.read(8193)',
 'if len(data)>8192 or len(data)<'+String(MARK.length+1)+':sys.exit(4)',
 "if not data.startswith(b'"+M31_MAGIC+"'):sys.exit(5)",
 "sys.stdout.write(hashlib.sha256(data).hexdigest())"
].join('\n');

function pythonHash(bytes){
 const child=spawnSync('python3',['-I','-S','-B','-c',PYTHON_CODE],{
  input:bytes,encoding:'utf8',timeout:3000,maxBuffer:4096,
  windowsHide:true,env:{PATH:'/usr/bin:/bin',PYTHONHASHSEED:'0'}
 });
 if(child.error||child.status!==0||child.signal||
    child.stderr!==''||typeof child.stdout!=='string'||
    !HEX.test(child.stdout))refuse();
 return child.stdout;
}

export function verifyM31SyntheticBytes(input){
 if(!exact(input,['schema','scope','phaseSamples'])||
    input.schema!=='UBUNTU24_M31_SYNTHETIC_BYTES_INPUT_V1'||
    input.scope!=='ci-in-memory-artificial-fixtures-only'||
    !Array.isArray(input.phaseSamples)||input.phaseSamples.length!==6)refuse();

 const snapshots=[];
 let nodePythonAgreements=0,operatorClaimsMatch=0,reviewerClaimsMatch=0;
 let mismatchingClaimPhases=0;
 for(let i=0;i<6;i++){
  const phase=input.phaseSamples[i],label=LABELS[Math.floor(i/3)],
        name=PHASES[i%3];
  if(!exact(phase,['desktopLabel','phase','syntheticBytes',
                    'operatorReportedSha256','reviewerReportedSha256'])||
     phase.desktopLabel!==label||phase.phase!==name||
     !Buffer.isBuffer(phase.syntheticBytes)||
     phase.syntheticBytes.length<MARK.length+1||
     phase.syntheticBytes.length>M31_MAX_BYTES||
     !phase.syntheticBytes.subarray(0,MARK.length).equals(MARK)||
     typeof phase.operatorReportedSha256!=='string'||
     !HEX.test(phase.operatorReportedSha256)||
     typeof phase.reviewerReportedSha256!=='string'||
     !HEX.test(phase.reviewerReportedSha256))refuse();

  // Snapshot is a memory copy, preventing a later caller mutation from
  // altering the bytes delivered to the second hashing process.
  const bytes=Buffer.from(phase.syntheticBytes);
  const nodeDigest=createHash('sha256').update(bytes).digest('hex');
  const pythonDigest=pythonHash(bytes);
  if(nodeDigest!==pythonDigest)refuse();
  nodePythonAgreements++;
  const op=nodeDigest===phase.operatorReportedSha256;
  const reviewer=nodeDigest===phase.reviewerReportedSha256;
  operatorClaimsMatch+=Number(op);
  reviewerClaimsMatch+=Number(reviewer);
  mismatchingClaimPhases+=Number(!op||!reviewer);
  snapshots.push(bytes);
 }
 const same=snapshots.every(b=>b.equals(snapshots[0]));
 const status=mismatchingClaimPhases>0?
   'syntheticReportedDigestsMismatchComputedBytes':
   !same?'syntheticByteDriftBetweenReportedPhases':
   'syntheticByteHashesRecomputedAuthenticationPending';

 // No computed hashes or byte samples are returned. Two runtimes hashing
 // one input source do not establish two independently acquired artifacts.
 return Object.freeze({
  schema:'UBUNTU24_M31_SYNTHETIC_BYTES_PROVENANCE_V1',
  source:'ci-synthetic-in-memory-byte-snapshots',
  status,
  syntheticPhaseSamplesValidated:6,
  runtimeHashImplementations:['node-crypto','python-hashlib'],
  crossRuntimeDigestAgreements:nodePythonAgreements,
  operatorDigestClaimsMatchingSyntheticBytes:operatorClaimsMatch,
  reviewerDigestClaimsMatchingSyntheticBytes:reviewerClaimsMatch,
  reportedDigestMismatchPhaseCount:mismatchingClaimPhases,
  sixSyntheticByteArraysExactlyEqual:same,
  actualSyntheticBytesHashed:true,
  realPackageBytesEverAccessed:false,
  realPackageBytesSha256Verified:false,
  independentArtifactAcquisitionVerified:false,
  independentReviewerIdentityVerified:false,
  provenanceSourceAuthenticated:false,
  m30HumanReceiptAuthenticityVerified:false,
  hostIdentityIndependentlyVerified:false,
  appSpecificAppArmorPolicyVerified:false,
  rollbackIndependentlyVerified:false,
  rendererSandboxIndependentlyVerified:false,
  apparmorCausalityProven:false,
  ubuntu24StrictNativeCIPassing:false,
  branchProtectionSatisfied:false,
  sandboxBypassApplied:false,
  mergeAuthorized:false,
  releaseAuthorized:false,
  installationAuthorized:false
 });
}
