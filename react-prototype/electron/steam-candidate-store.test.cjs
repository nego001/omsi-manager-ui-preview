'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createCandidateStore,preferenceFor,isPreference}=require('./steam-candidate-store.cjs');
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

test('saved preference matches a freshly discovered path, not the old ordinal or ID',()=>{
 const owner={},proof={},s=createCandidateStore();
 const [a,b]=s.publish(owner,proof,'omsi',[p,q]);
 const pref=preferenceFor('omsi',q);
 assert.equal(isPreference(pref),true);
 assert.equal(s.preferredId(owner,proof,'omsi',pref),b.id);
 const newer=createCandidateStore(),nextProof={};
 const [first,second]=newer.publish(owner,nextProof,'omsi',[q,p]);
 assert.notEqual(first.id,b.id);
 assert.equal(newer.preferredId(owner,nextProof,'omsi',pref),first.id);
 assert.equal(newer.resolve(owner,nextProof,'omsi',pref),null);
 assert.equal(newer.preferredId(owner,nextProof,'ats',pref),null);
});
test('missing path, wrong epoch and arbitrary path cannot be used as preferences',()=>{
 const owner={},proof={},s=createCandidateStore();
 s.publish(owner,proof,'omsi',[p]);
 for(const pref of [preferenceFor('omsi',q),preferenceFor('ats',p),q,null,'a'.repeat(65)])
  assert.equal(s.preferredId(owner,proof,'omsi',pref),null);
 assert.equal(s.preferredId(owner,{},'omsi',preferenceFor('omsi',p)),null);
});
