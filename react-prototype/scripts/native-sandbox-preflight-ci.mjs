// CI-only check: execute the exact packaged native ELF in diagnostic mode.
// The mode does not start Electron, create user namespaces or alter host policy.
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {validateNativeSandboxPreflight} from './native-sandbox-preflight-contract.mjs';

if(process.platform!=='linux'||process.getuid?.()===0||
   process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true')
 throw Error('NATIVE_SANDBOX_PREFLIGHT_CI_ONLY');
const binary=resolve('release/OMSI-Manager-Preview-linux-x64/OMSI-Manager-Auto');
let output;
try{
 output=execFileSync(binary,['--diagnose-sandbox'],{
  encoding:'utf8',timeout:4000,maxBuffer:2048,shell:false,
  cwd:dirname(binary),env:{PATH:'/usr/bin:/bin',LANG:'C'},windowsHide:true,
  stdio:['ignore','pipe','pipe']
 });
}catch{
 // Never emit raw native output/error objects; these may include paths.
 throw Error('NATIVE_SANDBOX_PREFLIGHT_EXECUTION_REFUSED');
}
const result=validateNativeSandboxPreflight(output);
console.log('PASS_NATIVE_SANDBOX_PREFLIGHT_CI',JSON.stringify(result));
