import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixturePublicationLab as make} from './publication.mjs';
import {MODULES} from './snapshot.mjs';
function fixture(){const sourceDigest='a'.repeat(64);return {scope:'synthetic-fixture',sourceDigest,gate:'fixture-pass',observations:MODULES.map(moduleId=>({moduleId,sourceDigest,ruleVersion:'1.0.0',state:'complete',evidence:moduleId==='definitions'?[{game:'omsi',signal:'format-specific'}]:[]}))};}
function lab(t){const p=make();t.after(()=>p.dispose());p.open();return p;}
test('completion cannot be manufactured without an atomic snapshot binding',t=>{
 const p=lab(t);p.transition('job','queued');p.transition('job','running');
 assert.throws(()=>p.transition('job','completed'),/REFUSED/);
 const s=p.complete('job',fixture());assert.deepEqual(p.select(s.snapshotId),s);
 assert.deepEqual(p.status().journal.publications,[{taskId:'job',snapshotId:s.snapshotId}]);
 assert.throws(()=>p.complete('job',fixture()),/REFUSED/);
 p.close();assert.deepEqual(p.open().recovered,[]);assert.deepEqual(p.select(s.snapshotId),s);
});
test('reopen interrupts unfinished tasks with no publication',t=>{
 const p=lab(t);p.transition('one','queued');p.transition('two','queued');p.transition('two','running');
 p.close();assert.deepEqual(p.open().recovered,['one','two']);
 assert.equal(p.status().database.snapshotCount,0);assert.deepEqual(p.status().journal.publications,[]);
 p.close();assert.deepEqual(p.open().recovered,[]);
});
test('incomplete or refused fixture cannot complete a running task',t=>{
 const p=lab(t);p.transition('job','queued');p.transition('job','running');
 const f=fixture();f.gate='fixture-refused';assert.throws(()=>p.complete('job',f),/REFUSED/);
 assert.equal(p.status().database.snapshotCount,0);assert.equal(p.status().journal.tasks[0].state,'running');
 p.transition('job','failed');assert.deepEqual(p.status().journal.publications,[]);
});
