// Test harness only: derive identity from the current checkout and fixed lab script.
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {bindFixtureNativeObservation} from './runtime-native-evidence.mjs';
export function bindExecutedFixture(platform,report,script){
 const p=spawnSync('git',['rev-parse','HEAD'],{cwd:new URL('../../..',import.meta.url),encoding:'utf8',timeout:5000,maxBuffer:4096,windowsHide:true});
 if(p.error||p.status!==0||p.stderr)throw Error('CORE_FIXTURE_CHECKOUT_UNAVAILABLE');
 const checkoutSha=p.stdout.trim();
 if(process.env.GITHUB_ACTIONS==='true'&&checkoutSha!==process.env.GITHUB_SHA)throw Error('CORE_FIXTURE_CHECKOUT_MISMATCH');
 const scriptSha256=createHash('sha256').update(readFileSync(script)).digest('hex');
 return bindFixtureNativeObservation({scope:'synthetic-fixture',platform,report,checkoutSha,scriptSha256});
}
