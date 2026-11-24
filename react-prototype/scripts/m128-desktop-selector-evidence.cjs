'use strict';
// Pure test/review contract. Never consumes a file path or performs desktop I/O.
// An operator claim, even complete, does NOT authenticate an observation.
const deny=()=>{throw Error('M128_DESKTOP_EVIDENCE_REFUSED');};
const HEAD='07e14cc1a2682a8ec14fa3fe5914830e7bbf42c8',RUN=45413711697;
const artifacts=Object.freeze({linux:14932127039,win32:14932250410});
const sessions=Object.freeze({
 linux:Object.freeze(['gnome-wayland','gnome-x11','kde-wayland','kde-x11','hyprland-wayland']),
 win32:Object.freeze(['windows-10-ntfs','windows-11-ntfs'])
});
const caseNames=Object.freeze(['startup','cancellation','first-selection','second-selection','oversize','empty','navigation','busy','feature-boundary','cleanup']);
const statuses=Object.freeze(['not-executed','observed','failed','unavailable']);
const preflightNames=Object.freeze(['operatorAuthorization','disposableEnvironment','outerArchiveDigest','innerArchiveProvenance','executableAndAsarCustody']);
const preflightStatuses=Object.freeze(['not-checked','operator-claimed-satisfied','failed','unavailable']);
const topKeys=['schema','candidateHead','runId','artifactId','platform','session','preflight','cases'];
function record(raw,keys){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw))||
  Reflect.ownKeys(raw).length!==keys.length)deny();
 const out=Object.create(null);
 for(const k of keys){
  const d=Object.getOwnPropertyDescriptor(raw,k);
  if(!d||!d.enumerable||!Object.hasOwn(d,'value'))deny();
  out[k]=d.value;
 }
 return out;
}
function projectDesktopSelectorEvidence(raw){
 try{
  const d=record(raw,topKeys);
  if(d.schema!=='omsi-m128-desktop-selector-operator-claim-v1'||d.candidateHead!==HEAD||d.runId!==RUN||
    typeof d.platform!=='string'||!Object.hasOwn(artifacts,d.platform)||
    d.artifactId!==artifacts[d.platform]||!sessions[d.platform].includes(d.session))deny();
  const preflight=record(d.preflight,preflightNames);
  const cases=record(d.cases,caseNames);
  if(!preflightNames.every(k=>preflightStatuses.includes(preflight[k]))||
     !caseNames.every(k=>statuses.includes(cases[k])))deny();
  const ready=preflightNames.every(k=>preflight[k]==='operator-claimed-satisfied');
  // Observations after failed or unconfirmed custody are inadmissible.
  if(!ready&&caseNames.some(k=>cases[k]==='observed'||cases[k]==='failed'))deny();
  if(cases.startup!=='observed'&&caseNames.slice(1,-1).some(k=>cases[k]!=='not-executed'&&cases[k]!=='unavailable'))deny();
  if(cases.startup==='not-executed'&&cases.cleanup==='observed')deny();
  const counts=Object.freeze(Object.fromEntries(statuses.map(s=>[s,caseNames.filter(k=>cases[k]===s).length])));
  const incomplete=caseNames.filter(k=>cases[k]!=='observed');
  const status=!ready?'awaiting-custody-claims':counts.failed?'operator-reported-failure':
    counts.observed===10?'operator-claimed-complete-unverified':'operator-claimed-incomplete';
  return Object.freeze({schema:'omsi-m128-desktop-selector-review-v1',platform:d.platform,session:d.session,
   candidateHead:HEAD,runId:RUN,artifactId:d.artifactId,status,counts,
   incompleteCases:Object.freeze(incomplete),preflightClaimsComplete:ready,
   independentlyVerified:false,operatorAuthenticated:false,actualDesktopCertified:false,
   portalBackendVerified:false,rendererSandboxCertified:false,nativeHandleTransferred:false,
   contentReadAuthorized:false,realModValidated:false,strictUbuntu24GateWaived:false,
   mergeAuthorized:false,releaseAuthorized:false,operationsEnabled:false});
 }catch{deny();}
}
function blankDesktopSelectorClaim(platform,session){
 if(typeof platform!=='string'||!Object.hasOwn(artifacts,platform)||!sessions[platform].includes(session))deny();
 return {schema:'omsi-m128-desktop-selector-operator-claim-v1',candidateHead:HEAD,runId:RUN,artifactId:artifacts[platform],platform,session,
  preflight:Object.fromEntries(preflightNames.map(k=>[k,'not-checked'])),
  cases:Object.fromEntries(caseNames.map(k=>[k,'not-executed']))};
}
module.exports={projectDesktopSelectorEvidence,blankDesktopSelectorClaim};
