'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {blankDesktopSelectorClaim:blank,projectDesktopSelectorEvidence:project}=require('../scripts/m128-desktop-selector-evidence.cjs');
function ready(platform='linux',session='hyprland-wayland'){
 const r=blank(platform,session);
 for(const k of Object.keys(r.preflight))r.preflight[k]='operator-claimed-satisfied';
 return r;
}
function complete(platform,session){
 const r=ready(platform,session);
 for(const k of Object.keys(r.cases))r.cases[k]='observed';
 return r;
}
test('blank external records remain unexecuted and do not certify desktop',()=>{
 for(const [p,s] of [['linux','hyprland-wayland'],['win32','windows-11-ntfs']]){
  const r=project(blank(p,s));
  assert.equal(r.status,'awaiting-custody-claims');
  assert.equal(r.counts['not-executed'],10);
  assert.equal(r.preflightClaimsComplete,false);
  assert.equal(r.actualDesktopCertified,false);
 }
});
test('complete claims cannot authorize native handles, content, sandbox or release',()=>{
 for(const [p,s] of [['linux','gnome-x11'],['win32','windows-10-ntfs']]){
  const r=project(complete(p,s));
  assert.equal(r.status,'operator-claimed-complete-unverified');
  assert.equal(r.counts.observed,10);
  for(const k of ['independentlyVerified','operatorAuthenticated','actualDesktopCertified','portalBackendVerified','rendererSandboxCertified','nativeHandleTransferred','contentReadAuthorized','realModValidated','strictUbuntu24GateWaived','mergeAuthorized','releaseAuthorized','operationsEnabled'])assert.equal(r[k],false);
 }
});
test('observed failure and unavailable scenarios cannot be counted as successful',()=>{
 const claim=complete('linux','kde-wayland');
 claim.cases.navigation='unavailable';claim.cases.busy='not-executed';
 let r=project(claim);
 assert.equal(r.status,'operator-claimed-incomplete');
 assert.deepEqual(r.incompleteCases,['navigation','busy']);
 assert.equal(r.counts.observed,8);
 claim.cases.oversize='failed';
 r=project(claim);assert.equal(r.status,'operator-reported-failure');
 assert.equal(r.counts.failed,1);
});
test('custody must be claimed before observations; no picker observations after failed startup',()=>{
 const claim=complete('linux','gnome-wayland');
 claim.preflight.outerArchiveDigest='failed';assert.throws(()=>project(claim));
 claim.preflight.outerArchiveDigest='operator-claimed-satisfied';
 claim.cases.startup='failed';assert.throws(()=>project(claim));
 for(const k of Object.keys(claim.cases))if(k!=='startup')claim.cases[k]='not-executed';
 claim.cases.cleanup='observed';
 assert.equal(project(claim).status,'operator-reported-failure');
});
test('reject wrong candidate, platform, artifact, unsupported session, unknown fields and invalid categories',()=>{
 const d=complete('win32','windows-11-ntfs');
 for(const x of [{...d,candidateHead:'other'},{...d,runId:1},{...d,artifactId:14932127039},
  {...d,session:'hyprland-wayland'},{...d,platform:'darwin'},{...d,path:'private'},
  {...d,cases:{...d.cases,extra:'observed'}},{...d,cases:{...d.cases,cleanup:true}},
  {...d,preflight:{...d.preflight,outerArchiveDigest:true}},{...d,releaseAuthorized:true}])assert.throws(()=>project(x),/M128_DESKTOP_EVIDENCE_REFUSED/);
 assert.throws(()=>blank('linux','hyprland-x11'));
});
test('getters are refused without evaluation and result is categorical only',()=>{
 const d=complete('linux','hyprland-wayland');let called=0;
 Object.defineProperty(d.cases,'cleanup',{enumerable:true,get(){called++;return 'observed';}});
 assert.throws(()=>project(d));assert.equal(called,0);
 const r=project(complete('linux','hyprland-wayland'));
 assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.counts));assert.ok(Object.isFrozen(r.incompleteCases));
 assert.doesNotMatch(JSON.stringify(r),/\.bus|\.cfg|\/tmp\//);
});
