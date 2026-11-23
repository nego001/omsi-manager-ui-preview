// CI-only read-only evidence; refuses if run outside hosted non-root jobs.
import {resolve} from 'node:path';
import {installedVersion,verifyEvidence} from './electron-build-identity.mjs';
async function main(){
 const a=process.argv.slice(2);
 if(process.platform!=='linux'||process.getuid?.()===0||
  process.env.GITHUB_ACTIONS!=='true'||process.env.CI!=='true'||
  a.length>1||(a.length===1&&a[0]!=='--packaged-only'))
  throw Error('ELECTRON_IDENTITY_CI_REFUSED');
 const packedOnly=a[0]==='--packaged-only';
 const expected=packedOnly?undefined:await installedVersion(resolve('.'));
 const report=await verifyEvidence(
  resolve('release/OMSI-Manager-Preview-linux-x64'),expected);
 console.log('PASS_M68_PACKAGED_ELECTRON_IDENTITY',JSON.stringify({
  electronPackageVersion:report.resolvedPackageVersion,
  packagedELFSha256:report.packagedELFSha256,
  packagedELFBytes:report.packagedELFBytes,
  mode:packedOnly?'extracted-archive':'installed-and-packaged',
  matchedActualELFBytes:true,independentRuntimeVersionProof:false,
  independentRendererSandboxProof:false,hostPolicyChanged:false,
  sandboxBypassApplied:false,strictUbuntu24GatePassed:false,
  installationAuthorized:false,releaseAuthorized:false
 }));
}
main().catch(()=>{console.error('ELECTRON_IDENTITY_CI_REFUSED');process.exitCode=1;});
