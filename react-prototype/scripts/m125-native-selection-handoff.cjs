'use strict';
// Test-only controller. Opaque synthetic selections are NOT OS handles.
// Never import into Electron, accept renderer-supplied evidence or enable I/O.
const {performance}=require('node:perf_hooks');
const {createConsentReview,MAX_AGE}=require('./m113-content-consent.cjs');
const deny=()=>{throw Error('M125_HANDOFF_REFUSED');};
const object=v=>v!==null&&typeof v==='object';
const scopes=['selected-content-only','selected-content-and-bounded-dependency-metadata'];
function createFixtureHandoff({platform,now=()=>performance.now()}={}){
 if(!['linux','win32'].includes(platform)||typeof now!=='function')deny();
 const consent=createConsentReview({now});
 const pending=new WeakMap(),tickets=new WeakMap(),owners=new WeakMap();
 function clock(){const n=now();if(!Number.isFinite(n)||n<0)deny();return n;}
 function release(g){
  if(!g||g.released)return false;
  g.released=true;
  pending.delete(g.request);
  if(g.ticket)tickets.delete(g.ticket);
  if(owners.get(g.owner)===g)owners.delete(g.owner);
  g.signal.removeEventListener('abort',g.abort);
  consent.cancel(g.request);
  return true;
 }
 function live(g){
  const n=clock();
  if(g.released||n<g.lastObserved||n<g.created||n-g.created>=MAX_AGE||
    owners.get(g.owner)!==g||!g.epoch.isCurrent(g.proof)||
    g.epoch.signalFor(g.proof)!==g.signal||g.signal.aborted)deny();
  g.lastObserved=n;
 }
 function begin(owner,epoch,proof,selection,role,encoding){
  if(!object(owner)||!object(selection)||!epoch||!proof)deny();
  const signal=epoch.signalFor(proof);
  if(!signal||signal.aborted||!epoch.isCurrent(proof))deny();
  const old=owners.get(owner);if(old)release(old);
  const created=clock();
  const request=consent.request(owner,epoch,proof,selection,role,encoding);
  const g={owner,epoch,proof,selection,signal,created,lastObserved:created,request,released:false,ticket:null,abort:null};
  g.abort=()=>release(g);
  pending.set(request,g);owners.set(owner,g);
  try{
   signal.addEventListener('abort',g.abort,{once:true});
   live(g);
   return request;
  }catch{release(g);deny();}
 }
 function confirm(request,owner,epoch,proof,selection,content,dependencyMetadata){
  const g=object(request)?pending.get(request):null;
  if(!g)deny();
  pending.delete(request);
  try{
   live(g);
   const review=consent.confirm(request,owner,epoch,proof,selection,content,dependencyMetadata);
   live(g);
   if(!scopes.includes(review.requestedScope))deny();
   const ticket=Object.freeze({kind:'fixture-handoff-ticket',operationsEnabled:false});
   g.ticket=ticket;g.scope=review.requestedScope;g.role=review.role;g.encoding=review.encoding;
   tickets.set(ticket,g);
   return ticket;
  }catch{release(g);deny();}
 }
 function consume(ticket,owner,epoch,proof,selection,scope){
  const g=object(ticket)?tickets.get(ticket):null;
  if(!g)deny();
  tickets.delete(ticket);
  try{
   live(g);
   if(g.owner!==owner||g.epoch!==epoch||g.proof!==proof||g.selection!==selection||g.scope!==scope)deny();
   live(g);
   // This projection is deliberately non-authorizing. No file API, callback,
   // caller bytes, OS descriptor, path or child process is accepted.
   return Object.freeze({schema:'omsi-m125-fixture-handoff-review-v1',platform,scope,role:g.role,encoding:g.encoding,
    maxConfigBytes:65536,maxDependencyEntries:scope===scopes[1]?4096:0,
    fixtureTicketConsumed:true,osHandleTransferred:false,nativeConsentVerified:false,
    contentReadAuthorized:false,dependencyReadAuthorized:false,realModRead:false,operationsEnabled:false});
  }catch{deny();}finally{release(g);}
 }
 function cancel(token){const g=object(token)?pending.get(token)||tickets.get(token):null;return release(g);}
 function revoke(owner){return release(object(owner)?owners.get(owner):null);}
 return Object.freeze({begin,confirm,consume,cancel,revoke});
}
module.exports={createFixtureHandoff};
