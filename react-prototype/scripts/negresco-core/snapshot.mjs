// F2.01 — fixture-only pure data contract. No IO, IPC, runtime integration
// or authorization. The caller cannot turn this into a real security gate.
import {createHash} from 'node:crypto';
export const MODULES=Object.freeze(['structure','metadata','definitions','resources','audio','media','compatibility']);
const GAMES=['omsi','ets2','ats'];
const SIGNALS=['format-specific','structural','declared','filename'];
const DIGEST=/^[a-f0-9]{64}$/;
const VERSION=/^[1-9][0-9]{0,5}\.[0-9]{1,6}\.[0-9]{1,6}$/;
const fail=()=>{throw Error('CORE_FIXTURE_CONTRACT_REFUSED');};
function data(o,keys){
 if(o===null||typeof o!=='object'||Object.getPrototypeOf(o)!==Object.prototype||
 Reflect.ownKeys(o).length!==keys.length)fail();
 const result={};
 for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();result[k]=d.value;}
 return result;
}
function sequence(a,max){
 if(!Array.isArray(a)||a.length>max||Reflect.ownKeys(a).length!==a.length+1)fail();
 return Array.from({length:a.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(a,String(i));if(!d||!Object.hasOwn(d,'value'))fail();return d.value;});
}
function freeze(o){if(o&&typeof o==='object'){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;}
function digest(o){return createHash('sha256').update(JSON.stringify(o)).digest('hex');}
export function createFixtureSnapshot(input){
 const x=data(input,['scope','sourceDigest','gate','observations']);
 if(x.scope!=='synthetic-fixture'||typeof x.sourceDigest!=='string'||!DIGEST.test(x.sourceDigest)||
 !['fixture-pass','fixture-refused','fixture-incomplete'].includes(x.gate))fail();
 const seen=new Set();
 const observations=sequence(x.observations,MODULES.length).map(value=>{
  const o=data(value,['moduleId','ruleVersion','sourceDigest','state','evidence']);
  if(!MODULES.includes(o.moduleId)||seen.has(o.moduleId)||typeof o.ruleVersion!=='string'||
   !VERSION.test(o.ruleVersion)||o.sourceDigest!==x.sourceDigest||!['complete','incomplete','blocked'].includes(o.state))fail();
  seen.add(o.moduleId);
  const unique=new Set();
  const evidence=sequence(o.evidence,12).map(value=>{
   const e=data(value,['game','signal']);
   if(!GAMES.includes(e.game)||!SIGNALS.includes(e.signal)||unique.has(e.game+':'+e.signal))fail();
   unique.add(e.game+':'+e.signal);return {game:e.game,signal:e.signal};
  }).sort((a,b)=>GAMES.indexOf(a.game)-GAMES.indexOf(b.game)||SIGNALS.indexOf(a.signal)-SIGNALS.indexOf(b.signal));
  return {moduleId:o.moduleId,ruleVersion:o.ruleVersion,sourceDigest:o.sourceDigest,state:o.state,evidence};
 }).sort((a,b)=>MODULES.indexOf(a.moduleId)-MODULES.indexOf(b.moduleId));
 const missingModules=MODULES.filter(id=>!seen.has(id));
 const blocked=x.gate==='fixture-refused'||observations.some(o=>o.state==='blocked');
 const incomplete=x.gate!=='fixture-pass'||missingModules.length>0||observations.some(o=>o.state!=='complete');
 const candidates=GAMES.filter(game=>observations.some(o=>o.evidence.some(e=>e.game===game)));
 const strong=GAMES.filter(game=>observations.some(o=>o.state==='complete'&&o.evidence.some(e=>e.game===game&&e.signal==='format-specific')));
 const status=blocked?'blocked':incomplete?'incomplete':candidates.length>1?'ambiguous':
  strong.length===1&&candidates.length===1?'probable':'unknown';
 const body={schemaVersion:1,scope:x.scope,sourceDigest:x.sourceDigest,gate:x.gate,status,
  gameCandidate:status==='probable'?strong[0]:null,candidates:blocked?[]:candidates,
  missingModules,observations,compatibility:'unknown',installation:'not-verified',
  operationsEnabled:false,realSecurityGateVerified:false,releaseAuthorized:false};
 return freeze({snapshotId:digest(body),...body});
}
// No capabilities inferred from data. Only explicitly known projections.
export function projectFixtureSnapshot(input,sector){
 const x=createFixtureSnapshot(input);
 if(!['library','diagnostics','planner','studio'].includes(sector))fail();
 const common={snapshotId:x.snapshotId,scope:x.scope,status:x.status,gameCandidate:x.gameCandidate,
  compatibility:x.compatibility,operationsEnabled:false};
 if(sector==='library')return freeze({...common,installation:x.installation});
 if(sector==='diagnostics')return freeze({...common,missingModules:x.missingModules,observations:x.observations});
 if(sector==='planner')return freeze({...common,planAvailable:false,reason:'fixture-only'});
 return freeze({...common,skinWorkspace:false,audioWorkspace:false,reason:'fixture-only'});
}
