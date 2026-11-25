// F1.03: isolated dependency upgrade candidate, not a production runtime.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const VERSION='45.5.0',dir='electron-candidate';
const refuse=msg=>{throw Error(msg);};
const hash=b=>createHash('sha256').update(b).digest('hex');
const raw=p=>readFileSync(p);
const read=p=>JSON.parse(raw(p).toString('utf8'));
const f=n=>join(dir,n);
const out=(n,obj)=>writeFileSync(f(n),JSON.stringify(obj,null,2)+'\n',{flag:'wx',mode:0o600});
function expected(){
 const source=read('package.json');
 if(source.devDependencies?.electron!=='^38.0.0')refuse('UPGRADE_BASE_CHANGED');
 source.devDependencies.electron=VERSION;
 return source;
}
function graph(){
 const m=read(f('package.json')),l=read(f('package-lock.json'));
 if(JSON.stringify(m)!==JSON.stringify(expected())||l.lockfileVersion!==3||
    l.name!==m.name||l.version!==m.version||!l.packages?.['']||
    l.packages['node_modules/electron']?.version!==VERSION)refuse('CANDIDATE_GRAPH_MISMATCH');
 for(const group of ['dependencies','devDependencies']){
  if(JSON.stringify(Object.entries(m[group]||{}).sort())!==JSON.stringify(Object.entries(l.packages[''][group]||{}).sort()))refuse('CANDIDATE_DIRECT_DEPENDENCIES_MISMATCH');
 }
 for(const [key,v] of Object.entries(l.packages)){
  if(!key)continue;
  if(!key.startsWith('node_modules/')||v.link||typeof v.version!=='string'||
     typeof v.resolved!=='string'||!v.resolved.startsWith('https://registry.npmjs.org/')||
     !/^sha(512|384|256|1)-[A-Za-z0-9+/=]+$/.test(v.integrity||''))refuse('CANDIDATE_SOURCE_REFUSED');
 }
 return Object.keys(l.packages).length-1;
}
function record(){
 const count=graph();
 return {schema:1,sourceRevision:process.env.GITHUB_SHA,electron:VERSION,
  baseManifestSha256:hash(raw('package.json')),candidateManifestSha256:hash(raw(f('package.json'))),
  lockSha256:hash(raw(f('package-lock.json'))),entries:count,
  lifecycleScriptsExecuted:false,runtimeValidated:false,releaseAuthorized:false};
}
function audit(){
 const a=read(f('npm-audit.json')),v=a.metadata?.vulnerabilities;
 if(a.error||!a.vulnerabilities||!v||!['info','low','moderate','high','critical','total'].every(k=>Number.isSafeInteger(v[k])&&v[k]>=0)||
  v.total!==v.info+v.low+v.moderate+v.high+v.critical)refuse('CANDIDATE_AUDIT_UNAVAILABLE');
 console.log('CANDIDATE_AUDIT_COUNTS',JSON.stringify(v));
 if(v.high||v.critical)refuse('CANDIDATE_HIGH_OR_CRITICAL_ADVISORY');
}
function verify(){
 const actual=read(f('resolution.json')),expectedRecord=record();
 if(JSON.stringify(actual)!==JSON.stringify(expectedRecord))refuse('CANDIDATE_PROVENANCE_MISMATCH');
 audit();
}
if(process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||!/^[0-9a-f]{40}$/.test(process.env.GITHUB_SHA||''))refuse('CANDIDATE_CI_ONLY');
switch(process.argv[2]){
 case 'prepare':if(existsSync(dir))refuse('CANDIDATE_DIRECTORY_EXISTS');mkdirSync(dir,{mode:0o700});out('package.json',expected());break;
 case 'seal':out('resolution.json',record());break;
 case 'audit':verify();break;
 case 'verify':verify();break;
 case 'handoff':{
  verify();
  for(const name of ['package.json','package-lock.json']){
   const bytes=raw(f(name));
   if(bytes.length>262144)refuse('CANDIDATE_HANDOFF_SIZE');
   const encoded=bytes.toString('base64');
   console.log('CANDIDATE_HANDOFF_META',JSON.stringify({name,bytes:bytes.length,sha256:hash(bytes),
    gitBlobSha:createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex'),
    chunks:Math.ceil(encoded.length/2048)}));
   for(let i=0;i<encoded.length;i+=2048)console.log('CANDIDATE_HANDOFF_CHUNK',name,String(i/2048).padStart(4,'0'),encoded.slice(i,i+2048));
  }
  break;
 }
 case 'installed':verify();if(read(f('node_modules/electron/package.json')).version!==VERSION)refuse('CANDIDATE_INSTALLED_VERSION_MISMATCH');console.log('CANDIDATE_CLEAN_INSTALL_VERIFIED',process.platform,VERSION);break;
 default:refuse('CANDIDATE_ACTION_REFUSED');
}
