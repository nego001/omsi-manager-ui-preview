import {resolve,join} from 'node:path';
import { packager } from '@electron/packager';
import {writeBuildManifest} from './portable-build-manifest.mjs';
import boundary from './m101-runtime-boundary.cjs';

import {readFile} from 'node:fs/promises';

const root=resolve('.');
const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
const installed=JSON.parse(await readFile(join(root,'node_modules','electron','package.json'),'utf8'));
if(manifest.devDependencies?.electron!=='45.5.0'||installed.name!=='electron'||installed.version!==manifest.devDependencies.electron)throw Error('WINDOWS_ELECTRON_VERSION_REFUSED');
const bundled=await packager({
 electronVersion:installed.version,
 dir:root,
 name:'OMSI-Manager-Preview',
 platform:'win32',
 arch:'x64',
 out:resolve('release'),
 overwrite:true,
 prune:true,
 asar:true,
 ignore:[
  /[/\\]electron[/\\][^/\\]+\.test\.cjs$/,
  /[/\\](tests|examples|scripts|native-lab|native-launcher|test-results|playwright-report|release)([/\\]|$)/,
  /[/\\](\.git|\.github)([/\\]|$)/
 ]
});
if(bundled.length!==1)throw new Error('Era esperado exatamente um pacote portátil Windows.');
console.log('M101_PACKAGED_BOUNDARY',JSON.stringify(boundary.auditPackagedRuntime(join(bundled[0],'resources','app.asar'))));
await writeBuildManifest(bundled[0],{platform:'win32'});
console.log('Pacote portátil criado em:', bundled[0]);
