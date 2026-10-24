import {resolve} from 'node:path';
import { packager } from '@electron/packager';

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
  /[/\\](tests|examples|scripts|test-results|playwright-report|release)([/\\]|$)/,
  /[/\\](\.git|\.github)([/\\]|$)/
 ]
});
if(bundled.length!==1)throw new Error('Era esperado exatamente um pacote portátil Windows.');
console.log('Pacote portátil criado em:', bundled[0]);
