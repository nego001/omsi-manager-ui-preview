import {resolve} from 'node:path';
import {packager} from '@electron/packager';

// Read-only Linux desktop preview. This is not a service, installer, Wine/
// Proton integration or an authorisation to modify any game installation.
if(process.platform!=='linux')throw new Error('Linux package requires Linux host');
const root=resolve('.');
const bundled=await packager({
 dir:root,
 name:'OMSI-Manager-Preview',
 platform:'linux',
 arch:'x64',
 out:resolve('release'),
 overwrite:true,
 prune:true,
 asar:true,
 ignore:[
  /[/\\](tests|examples|scripts|native-lab|test-results|playwright-report|release)([/\\]|$)/,
  /[/\\](\.git|\.github)([/\\]|$)/
 ]
});
if(bundled.length!==1)throw new Error('Expected exactly one Linux portable package');
console.log('Linux read-only preview created at:',bundled[0]);
