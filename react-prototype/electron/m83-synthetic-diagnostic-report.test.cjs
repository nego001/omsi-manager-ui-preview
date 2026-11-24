'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createSyntheticDiagnosticReport:create,serializeSyntheticDiagnosticReport:serialize,MAX_REPORT_BYTES}=require('../scripts/m83-synthetic-diagnostic-report.cjs');
const model=(target,source='private.bus')=>({kind:'vehicle-definition',keyword:'[model]',source,target});
const fixture=(references=[],complete=true)=>({files:['private.bus','model/Private.cfg'],references,complete});
test('JSON projection is versioned, deterministic and count-consistent',()=>{
 const input=fixture([model('model/Private.cfg'),model('model/private.cfg'),model('missing.cfg')]);
 const report=JSON.parse(serialize(input));
 assert.deepEqual(report,create(input));
 assert.equal(report.schema,'omsi-manager-synthetic-dependency-report-v1');
 assert.equal(report.scope,'synthetic-virtual-inventory-only');
 assert.equal(report.countUnit,'reference-occurrences');
 assert.deepEqual(report.counts,{high:1,review:1,info:1});
 assert.equal(report.findings.reduce((n,x)=>n+x.count,0),report.totalReferences);
 assert.equal(serialize(input),serialize(input));
});
test('report never echoes paths, source names, arbitrary labels or supplied verdict',()=>{
 const input={...fixture([model('../PRIVATE_SECRET.cfg')]),state:'compatible',
  source:'C:\\Users\\PRIVATE_SECRET',reportId:'PRIVATE_SECRET',compatibilityVerified:true,operationsEnabled:true};
 for(const format of ['text','json']){
  const out=serialize(input,format);
  for(const secret of ['PRIVATE_SECRET','private.bus','Private.cfg','C:\\Users','"compatibilityVerified": true','"operationsEnabled": true'])
   assert.ok(!out.includes(secret),secret);
 }
 const report=create(input);
 assert.equal(report.realFilesInspected,false);
 assert.equal(report.compatibilityVerified,false);
 assert.equal(report.operationsEnabled,false);
});
test('text report retains incomplete inventory qualification and warnings',()=>{
 const input=fixture([model('missing.cfg')],false);
 const out=serialize(input,'text');
 assert.match(out,/Inventário sintético: incompleto/);
 assert.match(out,/Referência não observada/);
 assert.doesNotMatch(out,/Ausente no inventário fictício/);
 assert.match(out,/Compatibilidade real não verificada/);
 assert.equal(create(input).state,'review-required');
});
test('empty reference set is explicitly no evidence, not success',()=>{
 const input=fixture();
 assert.equal(create(input).state,'no-reference-evidence');
 assert.match(serialize(input,'text'),/Nenhuma referência avaliada/);
 assert.equal(create(input).totalReferences,0);
});
test('reference occurrence counts and bounded text remain valid at maximum input',()=>{
 const input=fixture(Array.from({length:256},()=>model('missing.cfg')));
 for(const format of ['text','json'])assert.ok(Buffer.byteLength(serialize(input,format),'utf8')<=MAX_REPORT_BYTES);
 assert.equal(create(input).counts.high,256);
 assert.equal(create(input).findings.length,1);
 assert.equal(create(input).findings[0].count,256);
});
test('invalid fixture and unsupported output formats fail closed',()=>{
 assert.throws(()=>serialize(fixture(),'html'),/M83_FORMAT_REFUSED/);
 assert.throws(()=>serialize({...fixture(),complete:'true'}),/M81D_FIXTURE_REFUSED/);
 assert.throws(()=>serialize({...fixture(),files:['duplicate','duplicate']}),/M81D_FIXTURE_REFUSED/);
});
