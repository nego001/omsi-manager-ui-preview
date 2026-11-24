'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const valid=()=>({status:'config-metadata-observed',scope:'selected-file-metadata-only',candidateKind:'bus-candidate',byteCount:16,
 contentOpened:false,dependencyScanPerformed:false,nativeIdentityVerified:false,compatibilityVerified:false,operationsEnabled:false});
test('M131 copies only exact bounded local metadata and normalizes cancellation',async()=>{
 const {projectConfigMetadata:project}=await import('../src/omsi-config-metadata-view.mjs');
 for(const candidateKind of ['bus-candidate','ovh-candidate','cfg-candidate'])for(const byteCount of [1,65536]){
  const input={...valid(),candidateKind,byteCount};const r=project(input);assert.deepEqual(r,input);
  assert.notEqual(r,input);assert.ok(Object.isFrozen(r));
 }
 assert.deepEqual(project({status:'cancelled'}),{status:'cancelled'});
});
test('M131 refuses extra fields, unsafe flags, invalid size and getters without leaking private error text',async()=>{
 const {projectConfigMetadata:project}=await import('../src/omsi-config-metadata-view.mjs');
 let called=0;const getter=valid();Object.defineProperty(getter,'byteCount',{enumerable:true,get(){called++;return 16;}});
 for(const input of [null,{status:'error',message:'/private/file.bus'},{...valid(),path:'/private/file.bus'},
  {...valid(),byteCount:0},{...valid(),byteCount:65537},{...valid(),byteCount:1.5},
  {...valid(),contentOpened:true},{...valid(),operationsEnabled:true},{...valid(),nativeIdentityVerified:true},
  {...valid(),scope:'real-content'},getter,{status:'cancelled',path:'private'}]){
  assert.deepEqual(project(input),{status:'error',message:'Não foi possível conferir a configuração selecionada.'});
 }
 assert.equal(called,0);
});
