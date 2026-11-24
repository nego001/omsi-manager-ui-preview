'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDiagnosticHistory:history}=require('../scripts/m86-synthetic-diagnostic-history.cjs');
const model=target=>({kind:'vehicle-definition',keyword:'[model]',source:'private.bus',target});
const fixture=(files=['private.bus'],references=[model('private.cfg')],complete=true)=>({files,references,complete});
const category=(r,code)=>r.categories.find(x=>x.code===code);
test('decreased absent counts and increased exact counts are observations only',()=>{
 const h=history();h.begin(fixture());h.begin(fixture(['private.bus','private.cfg']));
 const r=h.compare(1,2);
 assert.deepEqual(category(r,'absent-from-fixture'),{code:'absent-from-fixture',before:1,after:0,delta:-1,direction:'decreased'});
 assert.deepEqual(category(r,'exact'),{code:'exact',before:0,after:1,delta:1,direction:'increased'});
 assert.deepEqual(r.priorities[0],{priority:'high',before:1,after:0,delta:-1});
 for(const k of ['sameReferencesVerified','correctionVerified','compatibilityVerified','realFilesInspected','operationsEnabled'])assert.equal(r[k],false);
});
test('changed coverage and empty evidence preserve limitations',()=>{
 const h=history();h.begin(fixture());h.begin(fixture([],[],false));
 const r=h.compare(1,2);
 assert.equal(r.coverage.afterComplete,false);assert.equal(r.coverage.equalReferenceCounts,false);
 assert.ok(r.limitations.some(x=>x.includes('incompleto')));
 assert.ok(r.limitations.some(x=>x.includes('total de referências')));
 assert.ok(r.limitations.some(x=>x.includes('não possui evidência')));
 assert.equal(r.correctionVerified,false);
});
test('same counts with different references never establish equal identity',()=>{
 const h=history();h.begin(fixture());h.begin(fixture(['private.bus'],[model('another.cfg')]));
 const r=h.compare(1,2);
 assert.ok(r.categories.every(x=>x.delta===0&&x.direction==='unchanged'));
 assert.equal(r.coverage.equalReferenceCounts,true);assert.equal(r.sameReferencesVerified,false);
 assert.ok(!JSON.stringify(r).includes('another.cfg'));assert.ok(!JSON.stringify(r).includes('private.bus'));
});
test('unsupported and unconfirmed categories retain review caveats',()=>{
 const h=history();h.begin(fixture());
 h.begin(fixture(['private.bus'],[{kind:'vehicle-definition',keyword:'[sound]',source:'private.bus',target:'sound.cfg'}]));
 const r=h.compare(1,2);
 assert.equal(category(r,'unsupported-reference').after,1);
 assert.ok(r.limitations.some(x=>x.includes('limitações de avaliação')));
});
test('invalid or reversed revision selectors, foreign objects and closed sessions refuse',()=>{
 const h=history(),ticket=h.begin(fixture());h.begin(fixture());
 for(const pair of [[0,1],[2,1],[1,1],[1,3],[1,1.5],['1',2],[ticket,2],[NaN,2]])
  assert.throws(()=>h.compare(...pair),/M86_HISTORY_REFUSED/);
 h.close();assert.throws(()=>h.compare(1,2),/M86_HISTORY_REFUSED/);
});
test('comparison is immutable and independent of review acknowledgements',()=>{
 const h=history();h.begin(fixture());const b=h.begin(fixture());
 const before=h.compare(1,2);
 h.reviewStep(b,'review-original-package');
 assert.deepEqual(h.compare(1,2),before);
 assert.throws(()=>{before.categories[0].delta=1;},TypeError);
 assert.throws(()=>{before.priorities.push({});},TypeError);
 assert.equal(before.categories.reduce((n,x)=>n+x.before,0),before.coverage.beforeReferences);
 assert.equal(before.categories.reduce((n,x)=>n+x.after,0),before.coverage.afterReferences);
});
