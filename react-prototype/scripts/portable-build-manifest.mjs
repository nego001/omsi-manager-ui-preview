// Unsigned advisory provenance: never an authorization to modify game files.
import {join} from 'node:path';
import {lstat,readFile,writeFile} from 'node:fs/promises';
export const MANIFEST_NAME='OMSI-Manager-Preview-build.json';
const SHA=/^[0-9a-f]{40}$/;
export function createBuildManifest({platform,env=process.env}={}){
 if(!['win32','linux'].includes(platform))throw Error('Unsupported portable platform');
 const sha=env.GITHUB_SHA;
 if((env.GITHUB_ACTIONS==='true'||sha!==undefined)&&
    (typeof sha!=='string'||!SHA.test(sha)))
  throw Error('Build revision missing or malformed');
 return Object.freeze({
  schemaVersion:1,product:'OMSI Manager Preview',
  operatingSystem:platform==='win32'?'windows':'linux',
  architecture:'x64',sourceRevision:sha??null,
  buildEnvironment:env.GITHUB_ACTIONS==='true'?'github-actions':'local',
  mode:'read-only',modificationEnabled:false,signatureStatus:'unsigned'
 });
}
export async function writeBuildManifest(directory,options){
 const data=createBuildManifest(options);
 await writeFile(join(directory,MANIFEST_NAME),JSON.stringify(data,null,2)+'\n',
  {flag:'wx',mode:0o644});
 return data;
}
export async function verifyBuildManifest(directory,options){
 const filename=join(directory,MANIFEST_NAME);
 const stat=await lstat(filename);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.size<1||stat.size>2048)
  throw Error('Build manifest refused');
 const candidate=JSON.parse(await readFile(filename,'utf8'));
 const expected=createBuildManifest(options);
 if(!candidate||typeof candidate!=='object'||Array.isArray(candidate)||
    Object.keys(candidate).length!==Object.keys(expected).length||
    Object.keys(expected).some(key=>!Object.hasOwn(candidate,key)||
       candidate[key]!==expected[key]))
  throw Error('Build manifest does not match the expected platform and revision');
 return candidate;
}
