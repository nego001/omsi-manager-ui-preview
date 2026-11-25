import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureJournalLab as make} from './journal.mjs';
import {createHash} from 'node:crypto';
const refuse=/CORE_FIXTURE_JOURNAL_REFUSED/;
function lab(t){const j=make();t.after(()=>j.dispose());j.open();return j;}
test('persistent ordered event chain survives close and reopen',t=>{
 const j=lab(t);j.transition('analysis','queued');j.transition('analysis','running');j.transition('analysis','completed');
 const before=j.snapshot(),events=j.events();let previous='0'.repeat(64);
 for(const e of events){assert.equal(e.previousHash,previous);assert.equal(e.eventHash,createHash('sha256').update(JSON.stringify({sequence:e.sequence,taskId:e.taskId,state:e.state,previousHash:previous})).digest('hex'));previous=e.eventHash;}
 assert.equal(before.chainHead,previous);j.close();assert.deepEqual(j.open().recovered,[]);
 assert.deepEqual(j.snapshot(),before);assert.deepEqual(j.events(),events);
});
test('recovery marks queued and running tasks interrupted without replay',t=>{
 const j=lab(t);j.transition('queued-job','queued');j.transition('running-job','queued');j.transition('running-job','running');
 j.transition('done','queued');j.transition('done','running');j.transition('done','completed');
 j.close();const result=j.open();assert.deepEqual(result.recovered,['queued-job','running-job']);
 assert.equal(result.automaticReplay,false);assert.deepEqual(j.snapshot().tasks,[
  {taskId:'queued-job',state:'interrupted'},{taskId:'running-job',state:'interrupted'},{taskId:'done',state:'completed'}]);
 const s=j.snapshot();j.close();assert.deepEqual(j.open().recovered,[]);assert.deepEqual(j.snapshot(),s);
});
test('terminal states cannot resume; explicit new task identity required',t=>{
 const j=lab(t);j.transition('first','queued');j.close();j.open();
 for(const next of ['queued','running','completed','cancelled'])assert.throws(()=>j.transition('first',next),refuse);
 j.transition('replacement','queued');j.transition('replacement','running');j.transition('replacement','completed');
 assert.equal(j.snapshot().tasks[0].state,'interrupted');assert.equal(j.snapshot().tasks[1].state,'completed');
});
test('invalid transitions refuse without partial journal changes',t=>{
 const j=lab(t);assert.throws(()=>j.transition('job','running'),refuse);
 j.transition('job','queued');const before=j.snapshot();
 for(const state of ['queued','completed','failed','interrupted','unknown'])assert.throws(()=>j.transition('job',state),refuse);
 assert.deepEqual(j.snapshot(),before);j.transition('job','cancelled');assert.equal(j.snapshot().events,2);
});
test('failed and cancelled running tasks survive restart as terminal',t=>{
 const j=lab(t);for(const state of ['failed','cancelled']){
  j.transition(state,'queued');j.transition(state,'running');j.transition(state,state);
 }
 const before=j.snapshot();j.close();assert.deepEqual(j.open().recovered,[]);assert.deepEqual(j.snapshot(),before);
});
test('bounded lifetime task count retains room for all recovery events',t=>{
 const j=lab(t);
 for(let i=0;i<128;i++){j.transition('job-'+i,'queued');j.transition('job-'+i,'running');}
 assert.throws(()=>j.transition('overflow','queued'),refuse);
 j.close();assert.equal(j.open().recovered.length,128);
 assert.equal(j.snapshot().events,384);assert.ok(j.snapshot().tasks.every(x=>x.state==='interrupted'));
});
test('reject arbitrary paths, SQL-like identifiers, unknown states and forged records',t=>{
 const j=lab(t);
 for(const id of ['../private',"x' OR 1=1",null,{},'x'.repeat(49)])assert.throws(()=>j.transition(id,'queued'),refuse);
 assert.throws(()=>j.transition('job',{state:'queued'}),refuse);
 assert.throws(()=>j.transition('job','interrupted'),refuse);
 assert.equal(j.snapshot().events,0);assert.equal(Object.hasOwn(j,'path'),false);assert.equal(Object.hasOwn(j,'exec'),false);
});
test('immutable sanitized history and closed/disposed boundary',t=>{
 const j=lab(t);j.transition('job','queued');const s=j.snapshot(),e=j.events();
 assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.tasks)&&Object.isFrozen(s.tasks[0])&&Object.isFrozen(e[0]));
 assert.equal(s.productionJournal,false);assert.equal(s.operationsEnabled,false);
 j.transition('job','running');assert.equal(s.tasks[0].state,'queued');assert.equal(e.length,1);
 j.close();assert.throws(()=>j.snapshot(),refuse);assert.throws(()=>j.transition('new','queued'),refuse);
 assert.equal(j.dispose(),true);assert.equal(j.dispose(),false);assert.throws(()=>j.open(),refuse);
});
