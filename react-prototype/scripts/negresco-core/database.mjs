// F2.04 — real SQLite persistence of synthetic fixtures only.
// Owns a disposable directory, accepts no caller path or raw SQL.
// No production database, real mod content, IPC or authority.
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFixtureSnapshot} from './snapshot.mjs';
const fail=()=>{throw Error('CORE_FIXTURE_DATABASE_REFUSED');};
const DIGEST=/^[a-f0-9]{64}$/;
const MAX_ROWS=256,MAX_PAYLOAD=65536;
function validDigest(id){if(typeof id!=='string'||!DIGEST.test(id))fail();}
function encode(input){
 const s=createFixtureSnapshot(input);
 const payload=JSON.stringify({scope:s.scope,sourceDigest:s.sourceDigest,gate:s.gate,observations:s.observations});
 if(Buffer.byteLength(payload)>MAX_PAYLOAD)fail();
 return {s,payload};
}
function decode(row){
 if(!row||typeof row.payload!=='string'||Buffer.byteLength(row.payload)>MAX_PAYLOAD)fail();
 validDigest(row.snapshot_id);
 const {s,payload}=encode(JSON.parse(row.payload));
 if(s.snapshotId!==row.snapshot_id||payload!==row.payload||
   (Object.hasOwn(row,'source_digest')&&s.sourceDigest!==row.source_digest))fail();
 return s;
}
export function createFixtureDatabaseLab(){
 const directory=mkdtempSync(join(tmpdir(),'negresco-core-fixture-'));
 let db=null,disposed=false;
 function need(){if(disposed||!db)fail();return db;}
 function version(){return need().prepare('PRAGMA user_version').get().user_version;}
 function transaction(fn){
  const d=need();d.exec('BEGIN IMMEDIATE');
  try{const result=fn(d);d.exec('COMMIT');return result;}
  catch{try{d.exec('ROLLBACK');}catch{}fail();}
 }
 function migrate(target,fault){
  const current=version();
  if(![0,1,2].includes(current)||current>target)fail();
  if(current===0)transaction(d=>{
   d.exec('CREATE TABLE snapshots(snapshot_id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL CHECK(length(payload)<=65536)) STRICT; PRAGMA user_version=1;');
  });
  if(version()===1&&target===2)transaction(d=>{
   const rows=d.prepare('SELECT snapshot_id,payload FROM snapshots ORDER BY snapshot_id LIMIT 257').all();
   if(rows.length>MAX_ROWS)fail();
   d.exec('ALTER TABLE snapshots ADD COLUMN source_digest TEXT');
   const update=d.prepare('UPDATE snapshots SET source_digest=? WHERE snapshot_id=?');
   for(const row of rows){const s=decode(row);update.run(s.sourceDigest,s.snapshotId);}
   d.exec('CREATE INDEX snapshots_by_source ON snapshots(source_digest,snapshot_id)');
   // A fixed test-only fault proves DDL, data and version roll back together.
   if(fault==='rollback-v2')fail();
   d.exec('PRAGMA user_version=2');
  });
 }
 function close(){if(!db)return false;db.close();db=null;return true;}
 function open(target=2,fault='none'){
  if(disposed||db||![1,2].includes(target)||!['none','rollback-v2'].includes(fault)||
     (fault!=='none'&&target!==2))fail();
  try{
   db=new DatabaseSync(join(directory,'fixtures.sqlite'));
   db.exec('PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
   migrate(target,fault);
   if(version()!==target)fail();
   const check=db.prepare('PRAGMA quick_check').all();
   if(check.length!==1||check[0].quick_check!=='ok')fail();
   return status();
  }catch{try{close();}catch{}fail();}
 }
 function count(){return need().prepare('SELECT COUNT(*) AS n FROM snapshots').get().n;}
 function status(){return Object.freeze({scope:'synthetic-fixture',schemaVersion:version(),snapshotCount:count(),
  persistentFixtureStorage:true,operationsEnabled:false,productionDatabase:false});}
 function select(id){
  validDigest(id);const d=need();
  const row=d.prepare(version()===1?'SELECT snapshot_id,payload FROM snapshots WHERE snapshot_id=?':
   'SELECT snapshot_id,payload,source_digest FROM snapshots WHERE snapshot_id=?').get(id);
  return row?decode(row):null;
 }
 function putBatch(inputs){
  need();if(!Array.isArray(inputs)||inputs.length<1||inputs.length>32||Reflect.ownKeys(inputs).length!==inputs.length+1)fail();
  const values=Array.from({length:inputs.length},(_,i)=>{
   const desc=Object.getOwnPropertyDescriptor(inputs,String(i));if(!desc||!Object.hasOwn(desc,'value'))fail();return desc.value;
  });
  return transaction(d=>{
   const ids=[];
   for(const input of values){
    const {s,payload}=encode(input),existing=select(s.snapshotId);
    if(existing){if(JSON.stringify(existing)!==JSON.stringify(s))fail();}
    else{
     if(count()>=MAX_ROWS)fail();
     if(version()===1)d.prepare('INSERT INTO snapshots(snapshot_id,payload) VALUES(?,?)').run(s.snapshotId,payload);
     else d.prepare('INSERT INTO snapshots(snapshot_id,payload,source_digest) VALUES(?,?,?)').run(s.snapshotId,payload,s.sourceDigest);
    }
    ids.push(s.snapshotId);
   }
   return Object.freeze(ids);
  });
 }
 function findBySource(source){
  validDigest(source);if(version()!==2)fail();
  const rows=need().prepare('SELECT snapshot_id,payload,source_digest FROM snapshots WHERE source_digest=? ORDER BY snapshot_id LIMIT 257').all(source);
  if(rows.length>MAX_ROWS)fail();
  return Object.freeze(rows.map(decode));
 }
 function dispose(){if(disposed)return false;close();rmSync(directory,{recursive:true,force:true});disposed=true;return true;}
 return Object.freeze({open,close,dispose,status,putBatch,select,findBySource});
}
