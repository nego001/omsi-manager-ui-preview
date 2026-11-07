import {resolve} from 'node:path';
import { packager } from '@electron/packager';
import {writeBuildManifest} from './portable-build-manifest.mjs';

const root=resolve('.');
const bundled=await packager({
 dir:root,
 name:'OMSI-Manager-Preview',
 platform:'win32',
 arch:'x64',
 out:resolve('release'),
 overwrite:true,
 prune:true,
 asar:true,
 ignore:[
  /[/\\](tests|examples|scripts|native-lab|native-launcher|test-results|playwright-report|release)([/\\]|$)/,
  /[/\\](\.git|\.github)([/\\]|$)/
 ]
});
if(bundled.length!==1)throw new Error('Era esperado exatamente um pacote portátil Windows.');
await writeBuildManifest(bundled[0],{platform:'win32'});
console.log('Pacote portátil criado em:', bundled[0]);
