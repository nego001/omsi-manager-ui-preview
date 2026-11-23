// M68: unsigned and advisory. Installed npm metadata is not runtime attestation.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {open,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export const NAME='OMSI-Manager-Preview-electron-evidence.json';
const RANGE='^38.0.0',VERSION=/^38\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const refuse=()=>{throw Error('ELECTRON_BUILD_IDENTITY_REFUSED');};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.getPrototypeOf(o)===Object.prototype;
const fields=['schema','source','platform','declaredElectronRange','resolvedPackageVersion',
 'packagedELFSha256','packagedELFBytes','explicitPackagerVersionInput',
 'nativeRuntimeVersionIndependentlyVerified','packageSignatureVerified',
 'rendererSandboxVerified','hostPolicyChanged','sandboxBypassApplied',
 'nativeUbuntu24GatePassed','releaseAuthorized'];
async function json(file,max){
 let fd;
 try{
  fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  const st=await fd.stat();if(!st.isFile()||st.size<2||st.size>max)refuse();
  return JSON.parse(await fd.readFile('utf8'));
 }catch{refuse();}finally{await fd?.close().catch(()=>{});}
}
export function validateVersion(version,range){
 if(range!==RANGE||typeof version!=='string'||!VERSION.test(version))refuse();
 return version;
}
export async function installedVersion(project){
 const [a,b]=await Promise.all([
  json(join(project,'package.json'),65536),
  json(join(project,'node_modules','electron','package.json'),65536)]);
 if(!plain(a)||!plain(b)||b.name!=='electron')refuse();
 return validateVersion(b.version,a.devDependencies?.electron);
}
async function elfBytes(directory){
 let fd;
 try{
  fd=await open(join(directory,'OMSI-Manager-Preview'),
   constants.O_RDONLY|constants.O_NOFOLLOW);
  const st=await fd.stat();if(!st.isFile()||st.size<4||st.size>1073741824)refuse();
  let count=0,first=null;const hash=createHash('sha256');
  for await(const chunk of fd.createReadStream({autoClose:false})){
   if(count===0)first=chunk.subarray(0,4);
   count+=chunk.length;if(count>st.size)refuse();hash.update(chunk);
  }
  if(count!==st.size||!first?.equals(Buffer.from([127,69,76,70])))refuse();
  return {hash:hash.digest('hex'),size:count};
 }catch{refuse();}finally{await fd?.close().catch(()=>{});}
}
export function validateEvidence(x){
 if(!plain(x)||Object.keys(x).length!==fields.length||
    !fields.every(k=>Object.hasOwn(x,k))||
    x.schema!=='OMSI_ELECTRON_LINUX_BUILD_IDENTITY_V1'||
    x.source!=='installed-npm-package-explicit-packager-input-and-elf-bytes'||
    x.platform!=='linux'||x.declaredElectronRange!==RANGE||
    typeof x.resolvedPackageVersion!=='string'||!VERSION.test(x.resolvedPackageVersion)||
    typeof x.packagedELFSha256!=='string'||!/^[0-9a-f]{64}$/.test(x.packagedELFSha256)||
    !Number.isSafeInteger(x.packagedELFBytes)||x.packagedELFBytes<4||
    x.packagedELFBytes>1073741824||x.explicitPackagerVersionInput!==true||
    ['nativeRuntimeVersionIndependentlyVerified','packageSignatureVerified',
     'rendererSandboxVerified','hostPolicyChanged','sandboxBypassApplied',
     'nativeUbuntu24GatePassed','releaseAuthorized'].some(k=>x[k]!==false))refuse();
 return x;
}
export async function writeEvidence(directory,version){
 validateVersion(version,RANGE);const e=await elfBytes(directory);
 const record=validateEvidence({
  schema:'OMSI_ELECTRON_LINUX_BUILD_IDENTITY_V1',
  source:'installed-npm-package-explicit-packager-input-and-elf-bytes',
  platform:'linux',declaredElectronRange:RANGE,resolvedPackageVersion:version,
  packagedELFSha256:e.hash,packagedELFBytes:e.size,explicitPackagerVersionInput:true,
  nativeRuntimeVersionIndependentlyVerified:false,packageSignatureVerified:false,
  rendererSandboxVerified:false,hostPolicyChanged:false,sandboxBypassApplied:false,
  nativeUbuntu24GatePassed:false,releaseAuthorized:false
 });
 try{await writeFile(join(directory,NAME),JSON.stringify(record)+'\n',
  {flag:'wx',mode:0o644});}catch{refuse();}
 return record;
}
export async function verifyEvidence(directory,expectedVersion){
 const record=validateEvidence(await json(join(directory,NAME),2048));
 if(expectedVersion!==undefined&&record.resolvedPackageVersion!==validateVersion(expectedVersion,RANGE))refuse();
 const e=await elfBytes(directory);
 if(e.hash!==record.packagedELFSha256||e.size!==record.packagedELFBytes)refuse();
 return record;
}
