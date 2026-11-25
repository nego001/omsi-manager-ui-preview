import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureDatabaseLab as make} from './database.mjs';
import {createFixtureSnapshot,MODULES} from './snapshot.mjs';
const refuse=/CORE_FIXTURE_DATABASE_REFUSED/;
const hash='a'.repeat(64);
function fixture(sourceDigest=hash,ruleVersion='1.0.0'){
 return {scope:'synthetic-fixture',sourceDigest,gate:'fixture-pass',observations:MODULES.map(moduleId=>({
  moduleId,ruleVersion,sourceDigest,state:'complete',evidence:moduleId==='definitions'?[{game:'omsi',signal:'format-specific'}]:[]
 }))};
}
function lab(t){const db=make();t.after(()=>db.dispose());return db;}
test('SQLite database persists fixture across close/reopen with verified immutable identity',t=>{
 const d=lab(t),f=fixture(),expected=createFixtureSnapshot(f);
 assert.equal(d.open().schemaVersion,2);
 assert.deepEqual(d.putBatch([f]),[expected.snapshotId]);
 assert.deepEqual(d.select(expected.snapshotId),expected);
 assert.equal(d.close(),true);assert.equal(d.close(),false);
 assert.throws(()=>d.select(expected.snapshotId),refuse);
 assert.equal(d.open().snapshotCount,1);
 const s=d.select(expected.snapshotId);assert.deepEqual(s,expected);assert.ok(Object.isFrozen(s.observations));
 assert.equal(s.operationsEnabled,false);assert.equal(s.compatibility,'unknown');
});
test('identical content deduplicates while rule changes create a new snapshot',t=>{
 const d=lab(t);d.open();const f=fixture(),g=fixture(hash,'2.0.0');
 const [a,b,c]=d.putBatch([f,f,g]);assert.equal(a,b);assert.notEqual(a,c);
 assert.equal(d.status().snapshotCount,2);
 const matches=d.findBySource(hash);assert.equal(matches.length,2);
 assert.deepEqual(matches.map(x=>x.snapshotId),[a,c].sort());
 assert.deepEqual(d.findBySource('b'.repeat(64)),[]);
});
test('migration preserves v1 snapshot and creates indexed source lookup',t=>{
 const d=lab(t);d.open(1);const [id]=d.putBatch([fixture()]);
 assert.throws(()=>d.findBySource(hash),refuse);
 d.close();assert.equal(d.open(2).schemaVersion,2);
 assert.equal(d.findBySource(hash)[0].snapshotId,id);assert.equal(d.status().snapshotCount,1);
 d.close();assert.throws(()=>d.open(1),refuse);
 assert.equal(d.open(2).snapshotCount,1);
});
test('injected migration fault rolls back schema, row updates and version',t=>{
 const d=lab(t);d.open(1);const [id]=d.putBatch([fixture()]);d.close();
 assert.throws(()=>d.open(2,'rollback-v2'),refuse);
 assert.equal(d.open(1).schemaVersion,1);assert.equal(d.select(id).sourceDigest,hash);
 assert.throws(()=>d.findBySource(hash),refuse);
 d.close();assert.equal(d.open(2).schemaVersion,2);assert.equal(d.findBySource(hash)[0].snapshotId,id);
});
test('bad later record rolls back earlier insertion in the same batch',t=>{
 const d=lab(t);d.open();const f=fixture(),bad=fixture('b'.repeat(64));bad.scope='real-mod';
 assert.throws(()=>d.putBatch([f,bad]),refuse);assert.equal(d.status().snapshotCount,0);
 assert.equal(d.select(createFixtureSnapshot(f).snapshotId),null);
 assert.equal(d.putBatch([f]).length,1);assert.equal(d.status().snapshotCount,1);
});
test('lifetime row cap is transactional even when a batch partially fits',t=>{
 const d=lab(t);d.open();
 for(let i=0;i<8;i++){const start=i*32,n=i===7?31:32;
  d.putBatch(Array.from({length:n},(_,j)=>fixture((start+j).toString(16).padStart(64,'0'))));}
 assert.equal(d.status().snapshotCount,255);
 assert.throws(()=>d.putBatch([fixture('c'.repeat(64)),fixture('d'.repeat(64))]),refuse);
 assert.equal(d.status().snapshotCount,255);assert.deepEqual(d.findBySource('c'.repeat(64)),[]);
 d.putBatch([fixture('c'.repeat(64))]);assert.equal(d.status().snapshotCount,256);
});
test('SQL-like keys, real content, forged metadata and oversized batches refuse',t=>{
 const d=lab(t);d.open();
 for(const key of ["' OR 1=1 --",'/private/file',null,{},'A'.repeat(64)]){
  assert.throws(()=>d.select(key),refuse);assert.throws(()=>d.findBySource(key),refuse);
 }
 assert.throws(()=>d.putBatch([]),refuse);assert.throws(()=>d.putBatch(Array(33).fill(fixture())),refuse);
 const f=fixture();f.path='/private/file';assert.throws(()=>d.putBatch([f]),refuse);
 let invoked=false;const a=[fixture()];Object.defineProperty(a,'0',{get(){invoked=true;return fixture();}});
 assert.throws(()=>d.putBatch(a),refuse);assert.equal(invoked,false);assert.equal(d.status().snapshotCount,0);
});
test('only sanitized immutable database status and no external path or SQL API',t=>{
 const d=lab(t);const status=d.open();assert.ok(Object.isFrozen(status));
 assert.equal(status.productionDatabase,false);assert.equal(status.operationsEnabled,false);
 assert.equal(Object.hasOwn(d,'path'),false);assert.equal(Object.hasOwn(d,'exec'),false);
 assert.throws(()=>d.open(),refuse);assert.equal(d.dispose(),true);assert.equal(d.dispose(),false);
 assert.throws(()=>d.open(),refuse);assert.throws(()=>d.status(),refuse);
});
