import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CSP_META,PACKAGED_CSP} from './packaged-content-security.mjs';

// Build-time validation: the shipped index.html must contain the exact CSP
// *before* any script or stylesheet. This fails the build, never waives CI.
const refused=()=>{throw Error('PACKAGED_CSP_ARTIFACT_REFUSED');};
const index=readFileSync(join(process.cwd(),'dist','index.html'),'utf8');
const headIndex=index.indexOf('<head>');
const metaIndex=index.indexOf(CSP_META);
const firstScript=index.search(/<script\b/i);
const firstStyle=index.search(/<(?:link|style)\b/i);
if(headIndex<0||metaIndex!==headIndex+'<head>'.length||
   index.indexOf(CSP_META,metaIndex+1)!==-1||
   !PACKAGED_CSP.includes("connect-src 'none'")||
   !PACKAGED_CSP.includes("script-src 'self'")||
   /script-src[^;]*unsafe-(?:inline|eval)/.test(PACKAGED_CSP)||
   firstScript<0||firstScript<metaIndex||
   (firstStyle>=0&&firstStyle<metaIndex))refused();
console.log('PACKAGED_CSP_ARTIFACT_VERIFIED');
