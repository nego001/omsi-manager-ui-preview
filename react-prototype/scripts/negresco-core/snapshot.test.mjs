import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureSnapshot as snapshot,projectFixtureSnapshot as project,MODULES} from './snapshot.mjs';
const hash='a'.repeat(64),refuse=/CORE_FIXTURE_CONTRACT_REFUSED/;
function fixture(){return {scope:'synthetic-fixture',sourceDigest:hash,gate:'fixture-pass',
 observations:MODULES.map(moduleId=>({moduleId,ruleVersion:'1.0.0',sourceDigest:hash,state:'complete',
 evidence:moduleId==='definitions'?[{game:'omsi',signal:'format-specific'}]:[]}))};}
test('complete fixture produces probable candidate, never compatibility or authority',()=>{
 const s=snapshot(fixture());assert.equal(s.status,'probable');assert.equal(s.gameCandidate,'omsi');
 assert.equal(s.compatibility,'unknown');assert.equal(s.installation,'not-verified');
 assert.equal(s.operationsEnabled,false);assert.equal(s.realSecurityGateVerified,false);assert.equal(s.releaseAuthorized,false);
 assert.match(s.snapshotId,/^[a-f0-9]{64}$/);
});
test('snapshot identity independent of module order and evidence order',()=>{
 const f=fixture();f.observations[0].evidence=[{game:'omsi',signal:'declared'},{game:'omsi',signal:'structural'}];
 const id=snapshot(f).snapshotId;f.observations.reverse();f.observations.at(-1).evidence.reverse();
 assert.equal(snapshot(f).snapshotId,id);f.observations[0].ruleVersion='2.0.0';assert.notEqual(snapshot(f).snapshotId,id);
});
test('deep immutability and no references to mutable inputs',()=>{
 const f=fixture(),s=snapshot(f);f.observations[2].evidence[0].game='ats';
 assert.equal(s.gameCandidate,'omsi');assert.equal(s.observations[2].evidence[0].game,'omsi');
 assert.throws(()=>{s.observations[2].evidence[0].game='ats';},TypeError);
 assert.ok(Object.isFrozen(s.observations[2].evidence));
});
test('refused gate dominates and suppresses candidate',()=>{
 const f=fixture();f.gate='fixture-refused';const s=snapshot(f);
 assert.equal(s.status,'blocked');assert.deepEqual(s.candidates,[]);assert.equal(s.gameCandidate,null);
});
test('module block dominates gate',()=>{const f=fixture();f.observations[0].state='blocked';assert.equal(snapshot(f).status,'blocked');});
test('missing or incomplete module and incomplete gate never imply recognition',()=>{
 const f=fixture();f.observations.pop();assert.equal(snapshot(f).status,'incomplete');
 assert.deepEqual(snapshot(f).missingModules,['compatibility']);
 const a=fixture();a.observations[0].state='incomplete';assert.equal(snapshot(a).status,'incomplete');
 const b=fixture();b.gate='fixture-incomplete';assert.equal(snapshot(b).status,'incomplete');
});
test('contradictory candidates are ambiguous even with stronger evidence',()=>{
 const f=fixture();f.observations[1].evidence=[{game:'ats',signal:'declared'}];const s=snapshot(f);
 assert.equal(s.status,'ambiguous');assert.equal(s.gameCandidate,null);
});
test('name-only or declared signals never establish game identity',()=>{
 const f=fixture();f.observations[2].evidence[0].signal='filename';assert.equal(snapshot(f).status,'unknown');
});
test('refuses duplicates, foreign digest, unexpected fields, malformed rule version',()=>{
 for(const mutate of [f=>f.observations[1].moduleId='structure',f=>f.observations[0].sourceDigest='b'.repeat(64),
 f=>f.operationsEnabled=true,f=>f.observations[0].ruleVersion='latest',f=>f.observations[0].evidence=[{game:'omsi',signal:'filename',path:'/secret'}],
 f=>f.observations[0].evidence=[{game:'omsi',signal:'filename'},{game:'omsi',signal:'filename'}]]){
  const f=fixture();mutate(f);assert.throws(()=>snapshot(f),refuse);
 }
});
test('rejects real input and accessor fields without invoking getter',()=>{
 const f=fixture();f.scope='real-mod';assert.throws(()=>snapshot(f),refuse);
 let invoked=false;const a=fixture();Object.defineProperty(a,'gate',{get(){invoked=true;return 'fixture-pass';},enumerable:true});
 assert.throws(()=>snapshot(a),refuse);assert.equal(invoked,false);
});
test('all sector projections share identity and deny operations',()=>{
 const f=fixture(),id=snapshot(f).snapshotId;
 for(const sector of ['library','diagnostics','planner','studio']){
  const p=project(f,sector);assert.equal(p.snapshotId,id);assert.equal(p.operationsEnabled,false);assert.equal(p.compatibility,'unknown');
 }
 assert.equal(project(f,'planner').planAvailable,false);assert.equal(project(f,'studio').skinWorkspace,false);
 assert.equal(Object.hasOwn(project(f,'library'),'observations'),false);assert.throws(()=>project(f,'installer'),refuse);
});
