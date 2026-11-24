'use strict';
// Test-only candidate format admission. No full OMSI grammar, dependency
// resolution, file writes, runtime import or IPC authorization.
const {candidateKind,readCandidate}=require('./m102-bounded-omsi-config-reader.cjs');
const {decodeFormatFixture}=require('./m81c-config-format-contract.cjs');
const MAX_LINE=1024,MAX_MARKERS=256;
const rules=Object.freeze({
 'vehicle-definition':Object.freeze({model:'.cfg',sound:'.cfg',paths:'.cfg',passengercabin:'.cfg'}),
 'vehicle-model':Object.freeze({mesh:'.o3d'}),
 'map-global':Object.freeze({})
});
const refuse=()=>{throw Error('M103_FORMAT_REFUSED');};
function active(signal){if(signal?.aborted)throw Error('M103_FORMAT_CANCELLED');}
function admitRole(basename,role){
 const kind=candidateKind(basename);
 if(role==='vehicle-definition'&&['bus-candidate','ovh-candidate'].includes(kind))return;
 if(role==='vehicle-model'&&kind==='cfg-candidate'&&basename.toLowerCase()!=='global.cfg')return;
 if(role==='map-global'&&kind==='cfg-candidate'&&basename.toLowerCase()==='global.cfg')return;
 refuse();
}
function analyzeCandidateBytes(bytes,role,encoding,signal){
 try{
  active(signal);
  if(typeof role!=='string'||!Object.hasOwn(rules,role))refuse();
  // Existing deliberately narrow encoding contract; no automatic fallback.
  const {text}=decodeFormatFixture(bytes,role,encoding);
  if(/\r(?!\n)/.test(text)||!text.trim())refuse();
  const lines=text.split(/\r?\n/);
  if(lines.some(line=>line.length>MAX_LINE))refuse();
  const marker=line=>/^\[([A-Za-z][A-Za-z0-9_]*)\]$/.exec(line.trim());
  const counts=Object.keys(rules[role]).map(keyword=>({keyword,occurrences:0,extensionHints:0,unresolvedArguments:0}));
  let markerCount=0,unknownMarkers=0,unrecognizedBracketLines=0;
  for(let i=0;i<lines.length;i++){
   active(signal);
   const line=lines[i].trim(),m=marker(line);
   if(!m){if(line.startsWith('['))unrecognizedBracketLines++;continue;}
   if(++markerCount>MAX_MARKERS)refuse();
   // Exact lower-case marker spelling only; no claim that uppercase is
   // invalid in OMSI. Unknown blocks are observations, not errors.
   const row=counts.find(c=>c.keyword===m[1]);
   if(!row){unknownMarkers++;continue;}
   row.occurrences++;
   const next=lines[i+1]?.trim()||'';
   // This is merely a suffix hint on the immediate next line. No path
   // trust or reference admission; comments/unknown grammar stay unresolved.
   const suffix=rules[role][row.keyword];
   if(next&&!next.startsWith('[')&&!next.startsWith(';')&&!next.startsWith('#')&&
      next.toLowerCase().endsWith(suffix))row.extensionHints++;
   else row.unresolvedArguments++;
  }
  const knownMarkers=counts.reduce((n,c)=>n+c.occurrences,0);
  return Object.freeze({schema:'omsi-m103-format-observation-v1',scope:'bounded-config-candidate-only',role,encoding,
   byteCount:bytes.length,lineCount:lines.length,markerCount,knownMarkers,unknownMarkers,unrecognizedBracketLines,
   outcome:knownMarkers?'known-marker-hints-observed':markerCount?'unclassified-markers-observed':'no-marker-evidence',
   markers:Object.freeze(counts.map(c=>Object.freeze(c))),
   decodingSucceeded:true,fullGrammarVerified:false,referencesResolved:false,compatibilityVerified:false,
   nativeIdentityVerified:false,realModValidated:false,operationsEnabled:false});
 }catch{
  if(signal?.aborted)throw Error('M103_FORMAT_CANCELLED');
  refuse();
 }
}
async function inspectCandidateFormat(root,basename,role,encoding,signal){
 try{
  active(signal);admitRole(basename,role);
  const result=await readCandidate(root,basename,signal);
  active(signal);
  return analyzeCandidateBytes(result.bytes,role,encoding,signal);
 }catch{
  if(signal?.aborted)throw Error('M103_FORMAT_CANCELLED');
  refuse();
 }
}
module.exports={analyzeCandidateBytes,inspectCandidateFormat,admitRole,MAX_LINE,MAX_MARKERS};
