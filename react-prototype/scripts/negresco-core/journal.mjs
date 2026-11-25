// F2.06 — disposable SQLite event journal for synthetic sessions only.
// A hash chain detects inconsistent records, not malicious rewriting by an
// administrator. No external path, raw SQL, user data or automatic replay.
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const fail=()=>{throw Error('CORE_FIXTURE_JOURNAL_REFUSED');};
const ID=/^[a-z][a-z0-9-]{0,47}$/;
const ROOT='0'.repeat(64),MAX_TASKS=128,MAX_EVENTS=MAX_TASKS*3;
const finalStates=['completed','failed','cancelled','interrupted'];
function hash(row){return createHash('sha256').update(JSON.stringify(row)).digest('hex');}
function validId(id){if(typeof id!=='string'||!ID.test(id))fail();}
function apply(states,id,next,internal){
 validId(id);const prior=states.get(id);
 if(!prior){if(next!=='queued'||states.size>=MAX_TASKS)fail();}
 else if(prior==='queued'){
  if(!['running','cancelled','interrupted'].includes(next))fail();
 }else if(prior==='running'){
  if(!finalStates.includes(next))fail();
 }else fail();
 if(next==='interrupted'&&!internal)fail();
 states.set(id,next);
}
export function createFixtureJournalLab(){
 const dir=mkdtempSync(join(tmpdir(),'negresco-journal-'));
 let db=null,disposed=false;
 function need(){if(!db||disposed)fail();return db;}
 function read(){
  const rows=need().prepare('SELECT seq,task_id,state,previous_hash,event_hash FROM events ORDER BY seq LIMIT 385').all();
  if(rows.length>MAX_EVENTS)fail();
  const states=new Map();let previous=ROOT;
  for(let i=0;i<rows.length;i++){
   const r=rows[i],body={sequence:i+1,taskId:r.task_id,state:r.state,previousHash:previous};
   if(r.seq!==i+1||r.previous_hash!==previous||r.event_hash!==hash(body))fail();
   apply(states,r.task_id,r.state,true);previous=r.event_hash;
  }
  return {rows,states,previous};
 }
 function append(history,id,next,internal){
  if(history.rows.length>=MAX_EVENTS)fail();
  apply(history.states,id,next,internal);
  const body={sequence:history.rows.length+1,taskId:id,state:next,previousHash:history.previous};
  const eventHash=hash(body);
  need().prepare('INSERT INTO events(seq,task_id,state,previous_hash,event_hash) VALUES(?,?,?,?,?)')
   .run(body.sequence,id,next,body.previousHash,eventHash);
  history.rows.push({seq:body.sequence,task_id:id,state:next,previous_hash:body.previousHash,event_hash:eventHash});
  history.previous=eventHash;
 }
 function atomic(fn){
  const d=need();d.exec('BEGIN IMMEDIATE');
  try{const value=fn();d.exec('COMMIT');return value;}
  catch{try{d.exec('ROLLBACK');}catch{}fail();}
 }
 function close(){if(!db)return false;db.close();db=null;return true;}
 function open(){
  if(disposed||db)fail();
  try{
   db=new DatabaseSync(join(dir,'journal.sqlite'));
   db.exec('PRAGMA trusted_schema=OFF; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL;');
   const version=db.prepare('PRAGMA user_version').get().user_version;
   if(version===0)atomic(()=>db.exec("CREATE TABLE events(seq INTEGER PRIMARY KEY,task_id TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('queued','running','completed','failed','cancelled','interrupted')),previous_hash TEXT NOT NULL CHECK(length(previous_hash)=64),event_hash TEXT NOT NULL CHECK(length(event_hash)=64)) STRICT; PRAGMA user_version=1;"));
   else if(version!==1)fail();
   const check=db.prepare('PRAGMA quick_check').all();
   if(check.length!==1||check[0].quick_check!=='ok')fail();
   const recovered=atomic(()=>{
    const history=read(),ids=[];
    for(const [id,state] of history.states)if(state==='queued'||state==='running'){
     append(history,id,'interrupted',true);ids.push(id);
    }
    return ids;
   });
   return Object.freeze({recovered:Object.freeze(recovered),automaticReplay:false,operationsEnabled:false});
  }catch{try{close();}catch{}fail();}
 }
 function transition(id,next){
  validId(id);if(typeof next!=='string'||!['queued','running','completed','failed','cancelled'].includes(next))fail();
  return atomic(()=>{const history=read();append(history,id,next,false);
   return Object.freeze({taskId:id,state:next,sequence:history.rows.length});});
 }
 function snapshot(){
  const h=read();
  return Object.freeze({scope:'synthetic-fixture',schemaVersion:1,events:h.rows.length,chainHead:h.previous,
   tasks:Object.freeze([...h.states].map(([taskId,state])=>Object.freeze({taskId,state}))),
   operationsEnabled:false,automaticReplay:false,productionJournal:false});
 }
 function events(){
  return Object.freeze(read().rows.map(r=>Object.freeze({sequence:r.seq,taskId:r.task_id,state:r.state,
   previousHash:r.previous_hash,eventHash:r.event_hash})));
 }
 function dispose(){if(disposed)return false;close();rmSync(dir,{recursive:true,force:true});disposed=true;return true;}
 return Object.freeze({open,close,transition,snapshot,events,dispose});
}
