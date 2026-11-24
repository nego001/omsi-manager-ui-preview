'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDiagnosticHistory:history,MAX_REVISIONS}=require('../scripts/m86-synthetic-diagnostic-history.cjs');
const model=target=>({kind:'vehicle-definition',keyword:'[model]',source:'private.bus',target});
const fixture=(files=['private.bus'],references=[model('private.cfg')],complete=true)=>({files,references,complete});
test('records immutable revision summaries and review progress separately',()=>{
 const h=history(),a=h.begin(fixture());
 const before=h.snapshot();
 h.reviewStep(a,'review-original-package');
 h.reviewRequirement(a,'backup');h.reviewRequirement(a,'reversal');
 const after=h.snapshot();
 assert.equal(before.revisions[0].review.rehearsalChecklistComplete,false);
 assert.equal(after.revisions[0].review.rehearsalChecklistComplete,true);
 assert.equal(after.revisions[0].review.actualConsentGranted,false);
 assert.equal(after.revisions[0].review.backupVerified,false);
 assert.equal(after.actualActivityLog,false);
 assert.equal(after.operationsEnabled,false);
 assert.throws(()=>after.revisions[0].report.counts.high=0,TypeError);
});
test('new revision preserves previous report and freezes earlier acknowledgements',()=>{
 const h=history(),a=h.begin(fixture());
 h.reviewStep(a,'review-original-package');
 const b=h.begin(fixture(['private.bus','private.cfg']));
 const s=h.snapshot();
 assert.equal(s.activeRevision,2);assert.equal(s.revisionCount,2);
 assert.equal(s.revisions[0].report.counts.high,1);
 assert.equal(s.revisions[1].report.counts.info,1);
 assert.deepEqual(s.revisions[0].review.reviewedSteps,['review-original-package']);
 assert.deepEqual(s.revisions[1].review.reviewedSteps,[]);
 assert.throws(()=>h.reviewRequirement(a,'backup'),/M86_HISTORY_REFUSED/);
 assert.equal(b.revision,2);
});
test('cloned or cross-session tickets refuse and do not alter history',()=>{
 const h=history(),other=history(),a=h.begin(fixture()),b=other.begin(fixture());
 const before=h.snapshot();
 for(const ticket of [b,{...a},JSON.parse(JSON.stringify(a))]){
  assert.throws(()=>h.reviewStep(ticket,'review-original-package'),/M86_HISTORY_REFUSED/);
 }
 assert.deepEqual(h.snapshot(),before);
});
test('invalid new fixture does not invalidate the last active valid revision',()=>{
 const h=history(),a=h.begin(fixture());
 assert.throws(()=>h.begin(fixture(['x','x'])),/M81D_FIXTURE_REFUSED/);
 assert.equal(h.snapshot().revisionCount,1);
 assert.equal(h.reviewStep(a,'review-original-package').revisions[0].review.reviewedSteps.length,1);
});
test('history bounds and closed session refuse further records',()=>{
 const h=history();
 for(let i=0;i<MAX_REVISIONS;i++)h.begin(fixture());
 assert.throws(()=>h.begin(fixture()),/M86_HISTORY_REFUSED/);
 assert.equal(h.snapshot().revisionCount,MAX_REVISIONS);
 h.close();assert.throws(()=>h.snapshot(),/M86_HISTORY_REFUSED/);
 assert.throws(()=>h.begin(fixture()),/M86_HISTORY_REFUSED/);
});
test('empty and incomplete revisions preserve uncertainty and omit source data',()=>{
 const h=history();h.begin(fixture([],[],false));
 h.begin(fixture(['private.bus'],[model('../PRIVATE_TOKEN.cfg')],false));
 const s=h.snapshot(),json=JSON.stringify(s);
 assert.equal(s.revisions[0].report.state,'no-reference-evidence');
 assert.equal(s.revisions[1].report.inventoryComplete,false);
 for(const value of ['private.bus','PRIVATE_TOKEN','private.cfg'])assert.ok(!json.includes(value));
 assert.equal(s.compatibilityVerified,false);assert.equal(s.realFilesInspected,false);
});
