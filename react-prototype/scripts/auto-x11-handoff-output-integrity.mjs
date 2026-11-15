// Refuse a partial, stale or altered X11 administrative handoff on the CI
// artifact path. This pure equality check verifies bytes against the current
// in-memory sanitized comparison; it never certifies Electron or the host.
import {createX11AdminHandoff,renderX11AdminHandoffMarkdown}
 from './auto-x11-admin-handoff.mjs';

const refuse=()=>{throw Error('AUTO_X11_HANDOFF_OUTPUT_REFUSED');};
const keys=['comparisonJson','handoffJson','handoffMarkdown'];
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

export function verifyX11HandoffOutputs(comparison,files){
 if(!isRecord(files)||Object.keys(files).length!==3||
  !keys.every(k=>Object.hasOwn(files,k)&&typeof files[k]==='string'))refuse();
 let expected;
 try{
  expected={
   comparisonJson:JSON.stringify(comparison)+'\n',
   handoffJson:JSON.stringify(createX11AdminHandoff(comparison))+'\n',
   handoffMarkdown:renderX11AdminHandoffMarkdown(comparison)
  };
 }catch{refuse();}
 for(const key of keys){
  if(Buffer.byteLength(files[key],'utf8')>8192||
   Buffer.byteLength(files[key],'utf8')===0||
   files[key]!==expected[key])refuse();
 }
 // A successful byte parity check must not be interpreted as sandbox proof.
 return Object.freeze({
  schema:'AUTO_X11_HANDOFF_OUTPUT_INTEGRITY_V1',
  allThreeExactAgainstCurrentComparison:true,
  inputArtifactsAreCIReportsOnly:true,
  packageSignatureVerified:false,rendererSandboxCertified:false,
  nativeWindowRequirementWaived:false,fullReleaseAuthorized:false,
  hostPolicyChanged:false,readOnly:true
 });
}
