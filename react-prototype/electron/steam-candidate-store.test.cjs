'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createCandidateStore}=require('./steam-candidate-store.cjs');
const p=path.resolve('private-fixture','Steam','OMSI 2'),q=path.resolve('another-private','OMSI 2');
test('multiple candidates expose only opaque IDs and ordinal labels',()=>{
 const s=createCandidateStore(),owner={},proof={};
 const rows=s.publish(owner,proof,'omsi',[p,q,p]);
 assert.equal(rows.length,2);
 assert.deepEqual(Object.keys(rows[0]).sort(),['id','label']);
 assert.equal(JSON.stringify(rows).includes('private'),false);
 assert.equal(s.resolve(owner,proof,'omsi',rows[1].id),q);
});
test('wrong owner, game, epoch or arbitrary path cannot resolve candidate',()=>{
 const s=createCandidateStore(),owner={},proof={},[r]=s.publish(owner,proof,'omsi',[p]);
 for(const [o,e,g,t] of [[{},proof,'omsi',r.id],[owner,{},'omsi',r.id],[owner,proof,'ats',r.id],[owner,proof,'omsi',p]])
  assert.equal(s.resolve(o,e,g,t),null);
});
test('refresh and explicit invalidation retire old IDs',()=>{
 const s=createCandidateStore(),owner={},proof={},[a]=s.publish(owner,proof,'omsi',[p]);
 const [b]=s.publish(owner,proof,'omsi',[q]);
 assert.equal(s.resolve(owner,proof,'omsi',a.id),null);
 assert.equal(s.resolve(owner,proof,'omsi',b.id),q);
 s.clear(owner,'omsi');assert.equal(s.resolve(owner,proof,'omsi',b.id),null);
});
