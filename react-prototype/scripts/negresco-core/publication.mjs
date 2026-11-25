// F2.08: single SQLite transaction for synthetic publication and completion.
// Disposable owned lab only; no raw SQL, external path, real content or authority.
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createFixtureSnapshot} from './snapshot.mjs';
const fail=()=>{throw Error('CORE_FIXTURE_PUBLICATION_REFUSED');};
const ROOT='0'.repeat(64),ID=/^[a-z][a-z0-9-]{0,47}$/,DIGEST=/^[a-f0-9]{64}$/;
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
function encode(input){
 const s=createFixtureSnapshot(input);
 if(s.status!=='probable'||s.gate!=='fixture-pass'||s.missingModules.length)fail();
 const payload=JSON.stringify({scope:s.scope,sourceDigest:s.sourceDigest,gate:s.gate,observations:s.observations});
 if(Buffer.byteLength(payload)>65536)fail();
 return {s,payload};
}
function decode(row){
 if(!row||typeof row.payload!=='string'||Buffer.byteLength(row.payload)>65536)fail();
 const {s,payload}=encode(JSON.parse(row.payload));
 if(s.snapshotId!==row.id||payload!==row.payload)fail();return s;
}
function step(states,id,state,snapshotId){
 if(typeof id!=='string'||!ID.test(id))fail();
 const prior=states.get(id);
 if(!prior){if(state!=='queued'||states.size>=128)fail();}
 else if(prior==='queued'){if(!['running','cancelled','interrupted'].includes(state))fail();}
 else if(prior==='running'){if(!['completed','failed','cancelled','interrupted'].includes(state))fail();}
 else fail();
 if(state==='completed'?(typeof snapshotId!=='string'||!DIGEST.test(snapshotId)):snapshotId!==null)fail();
 states.set(id,state);
}
export function createFixturePublicationLab(){
 const dir=mkdtempSync(join(tmpdir(),'negresco-publication-'));let db=null,disposed=false;
 function need(){if(!db||disposed)fail();return db;}
 function atomic(fn){
  const d=need();d.exec('BEGIN IMMEDIATE');
  try{const result=fn();d.exec('COMMIT');return result;}
  catch{try{d.exec('ROLLBACK');}catch{}fail();}
 }
 function read(){
  const d=need(),rows=d.prepare('SELECT id,payload FROM snapshots ORDER BY id LIMIT 129').all();
  const events=d.prepare('SELECT seq,task_id,state,snapshot_id,previous_hash,event_hash FROM events ORDER BY seq LIMIT 385').all();
  if(rows.length>128||events.length>384)fail();
  const snapshots=new Map(rows.map(r=>[r.id,decode(r)])),states=new Map(),published=new Set();let previous=ROOT;
  for(let i=0;i<events.length;i++){
   const r=events[i],body={sequence:i+1,taskId:r.task_id,state:r.state,snapshotId:r.snapshot_id,previousHash:previous};
   if(r.seq!==i+1||r.previous_hash!==previous||r.event_hash!==hash(body))fail();
   step(states,r.task_id,r.state,r.snapshot_id);
   if(r.snapshot_id!==null){if(!snapshots.has(r.snapshot_id))fail();published.add(r.snapshot_id);}
   previous=r.event_hash;
  }
  if(published.size!==snapshots.size)fail();
  return {snapshots,states,events,previous};
 }
 function append(h,id,state,snapshotId=null){
  if(h.events.length>=384)fail();step(h.states,id,state,snapshotId);
  const body={sequence:h.events.length+1,taskId:id,state,snapshotId,previousHash:h.previous};
  const eventHash=hash(body);
  need().prepare('INSERT INTO events(seq,task_id,state,snapshot_id,previous_hash,event_hash) VALUES(?,?,?,?,?,?)')
   .run(body.sequence,id,state,snapshotId,h.previous,eventHash);
  h.events.push(body);h.previous=eventHash;
 }
 function close(){if(!db)return false;db.close();db=null;return true;}
 function open(){
  if(disposed||db)fail();
  try{
   db=new DatabaseSync(join(dir,'publication.sqlite'));
   db.exec('PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
   const v=db.prepare('PRAGMA user_version').get().user_version;
   if(v===0)atomic(()=>db.exec("CREATE TABLE snapshots(id TEXT PRIMARY KEY NOT NULL,payload TEXT NOT NULL CHECK(length(payload)<=65536)) STRICT; CREATE TABLE events(seq INTEGER PRIMARY KEY,task_id TEXT NOT NULL,state TEXT NOT NULL,snapshot_id TEXT REFERENCES snapshots(id),previous_hash TEXT NOT NULL,event_hash TEXT NOT NULL,CHECK((state='completed' AND snapshot_id IS NOT NULL) OR (state<>'completed' AND snapshot_id IS NULL))) STRICT; PRAGMA user_version=1;"));
   else if(v!==1)fail();
   const check=db.prepare('PRAGMA quick_check').all();if(check.length!==1||check[0].quick_check!=='ok')fail();
   if(db.prepare('PRAGMA foreign_key_check').all().length)fail();
   const recovered=atomic(()=>{const h=read(),ids=[];for(const [id,state] of h.states)if(state==='queued'||state==='running'){append(h,id,'interrupted');ids.push(id);}return ids;});
   return Object.freeze({recovered:Object.freeze(recovered),automaticReplay:false,operationsEnabled:false});
  }catch{try{close();}catch{}fail();}
 }
 function transition(id,state){
  if(!['queued','running','failed','cancelled'].includes(state))fail();
  atomic(()=>append(read(),id,state));
 }
 function complete(id,input,fault='none'){
  if(!['none','after-snapshot-insert','after-completion-event'].includes(fault))fail();
  return atomic(()=>{
   const h=read(),{s,payload}=encode(input);if(h.states.get(id)!=='running')fail();
   if(!h.snapshots.has(s.snapshotId))need().prepare('INSERT INTO snapshots(id,payload) VALUES(?,?)').run(s.snapshotId,payload);
   else if(JSON.stringify(h.snapshots.get(s.snapshotId))!==JSON.stringify(s))fail();
   if(fault==='after-snapshot-insert')fail();
   append(h,id,'completed',s.snapshotId);
   if(fault==='after-completion-event')fail();
   return s;
  });
 }
 function select(id){if(typeof id!=='string'||!DIGEST.test(id))fail();return read().snapshots.get(id)??null;}
 function status(){
  const h=read();
  return Object.freeze({database:Object.freeze({scope:'synthetic-fixture',schemaVersion:1,snapshotCount:h.snapshots.size,persistentFixtureStorage:true,operationsEnabled:false,productionDatabase:false}),
   journal:Object.freeze({scope:'synthetic-fixture',schemaVersion:1,events:h.events.length,chainHead:h.previous,
    tasks:Object.freeze([...h.states].map(([taskId,state])=>Object.freeze({taskId,state}))),
    publications:Object.freeze(h.events.filter(e=>e.state==='completed').map(e=>Object.freeze({taskId:e.task_id,snapshotId:e.snapshot_id}))),
    operationsEnabled:false,automaticReplay:false,productionJournal:false})});
 }
 function dispose(){if(disposed)return false;close();rmSync(dir,{recursive:true,force:true});disposed=true;return true;}
 return Object.freeze({open,close,transition,complete,select,status,dispose});
}
