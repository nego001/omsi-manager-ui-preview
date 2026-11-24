'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
test('M144 fixed activity vocabulary and last thirty only',async()=>{
 const {appendLocalActivity:append,MAX_LOCAL_ACTIVITY}=await import('../src/local-session-activity.mjs');
 let events=[];
 for(let i=0;i<31;i++)events=append(events,i===0?'ats':'omsi','inspection-observed');
 assert.equal(events.length,MAX_LOCAL_ACTIVITY);
 assert.ok(events.every(x=>x.game==='omsi'));
 assert.equal(append(events,'omsi','/private/path'),events);
 assert.equal(append(events,'private-game','inspection-observed'),events);
 const next=append(events,'ets2','inspection-cancelled');
 assert.deepEqual(next.at(-1),{game:'ets2',action:'inspection-cancelled'});
 assert.deepEqual(Object.keys(next.at(-1)),['game','action']);
 assert.equal(events.at(-1).game,'omsi');
});
