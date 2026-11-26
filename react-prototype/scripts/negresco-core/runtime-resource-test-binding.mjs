// Test harness only: fixed resource scripts, checkout and script identity.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {bindFixtureResourceObservation} from './runtime-resource-evidence.mjs';
const scripts=Object.freeze({
 linuxAddress:'negresco-linux-memory-fixture.py',
 linuxCgroup:'negresco-linux-cgroup-discovery.py',
 windowsProcess:'negresco-windows-memory-fixture.ps1',
 windowsLifecycle:'negresco-windows-job-lifecycle.ps1',
 windowsDescendant:'negresco-windows-job-descendant.ps1',
 windowsAggregate:'negresco-windows-aggregate-memory.ps1'
});
export function bindExecutedResource(kind,report,script){
 if(!Object.hasOwn(scripts,kind)||script!==fileURLToPath(new URL('../../native-lab/'+scripts[kind],import.meta.url)))throw Error('CORE_RESOURCE_SCRIPT_MISMATCH');
 const p=spawnSync('git',['rev-parse','HEAD'],{cwd:new URL('../../..',import.meta.url),encoding:'utf8',timeout:5000,maxBuffer:4096,windowsHide:true});
 if(p.error||p.status!==0||p.stderr)throw Error('CORE_RESOURCE_CHECKOUT_UNAVAILABLE');
 const checkoutSha=p.stdout.trim();
 if(process.env.GITHUB_ACTIONS==='true'&&checkoutSha!==process.env.GITHUB_SHA)throw Error('CORE_RESOURCE_CHECKOUT_MISMATCH');
 const scriptSha256=createHash('sha256').update(readFileSync(script)).digest('hex');
 return bindFixtureResourceObservation({scope:'synthetic-fixture',kind,platform:process.platform,report,checkoutSha,scriptSha256});
}
