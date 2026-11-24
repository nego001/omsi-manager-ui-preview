'use strict';
// Test-only consent state machine, NOT an executable capability or native grant.
// Trusted controller owns selection, owner and epoch references; renderer never sees them.
const {performance}=require('node:perf_hooks');
const MAX_AGE=15000;
const deny=()=>{throw Error('M113_CONSENT_REFUSED');};
const object=v=>v!==null&&typeof v==='object';
const roles=['vehicle-definition','vehicle-model'],encodings=['utf-8','windows-1250','windows-1251','windows-1252'];
function createConsentReview({now=()=>performance.now()}={}){
 if(typeof now!=='function')deny();
 const pending=new WeakMap(),latest=new WeakMap();
 function current(g){
  const n=now();
  if(!Number.isFinite(n)||n<g.created||n-g.created>MAX_AGE||
     !g.epoch.isCurrent(g.proof)||!g.epoch.signalFor(g.proof)||g.epoch.signalFor(g.proof).aborted)deny();
 }
 function request(owner,epoch,proof,selection,role,encoding){
  if(!object(owner)||!object(selection)||!epoch||!proof||!roles.includes(role)||!encodings.includes(encoding))deny();
  const created=now();
  if(!Number.isFinite(created)||created<0)deny();
  const g={owner,epoch,proof,selection,role,encoding,created};
  current(g);
  const old=latest.get(owner);if(old)pending.delete(old);
  const request=Object.freeze({scope:'fixture-consent-review',operationsEnabled:false});
  pending.set(request,g);latest.set(owner,request);
  return request;
 }
 function confirm(request,owner,epoch,proof,selection,content,dependencyMetadata){
  const g=object(request)?pending.get(request):null;
  if(!g)deny();
  pending.delete(request);if(latest.get(g.owner)===request)latest.delete(g.owner);
  if(g.owner!==owner||g.epoch!==epoch||g.proof!==proof||g.selection!==selection||
     typeof content!=='boolean'||typeof dependencyMetadata!=='boolean'||!content)deny();
  current(g);
  return Object.freeze({schema:'omsi-m113-fixture-consent-review-v1',role:g.role,encoding:g.encoding,
   requestedScope:dependencyMetadata?'selected-content-and-bounded-dependency-metadata':'selected-content-only',
   maxConfigBytes:65536,maxDependencyEntries:dependencyMetadata?4096:0,
   nativeConsentVerified:false,nativeHandleVerified:false,contentReadAuthorized:false,dependencyReadAuthorized:false,
   realModRead:false,operationsEnabled:false});
 }
 function cancel(request){
  const g=object(request)?pending.get(request):null;
  if(!g)return false;
  pending.delete(request);if(latest.get(g.owner)===request)latest.delete(g.owner);return true;
 }
 return Object.freeze({request,confirm,cancel});
}
module.exports={createConsentReview,MAX_AGE};
