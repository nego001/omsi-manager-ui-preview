// Pure renderer projection, not a permission check or file reader.
const failed=()=>Object.freeze({status:'error',message:'Não foi possível conferir a configuração selecionada.'});
function exact(raw,keys){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||![Object.prototype,null].includes(Object.getPrototypeOf(raw))||
  Reflect.ownKeys(raw).length!==keys.length)return null;
 const values=Object.create(null);
 for(const k of keys){
  const d=Object.getOwnPropertyDescriptor(raw,k);
  if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return null;
  values[k]=d.value;
 }
 return values;
}
const flags=['contentOpened','dependencyScanPerformed','nativeIdentityVerified','compatibilityVerified','operationsEnabled'];
export function projectConfigMetadata(raw){
 try{
  const cancelled=exact(raw,['status']);
  if(cancelled?.status==='cancelled')return Object.freeze({status:'cancelled'});
  const d=exact(raw,['status','scope','candidateKind','byteCount',...flags]);
  if(!d||d.status!=='config-metadata-observed'||d.scope!=='selected-file-metadata-only'||
   !['bus-candidate','ovh-candidate','cfg-candidate'].includes(d.candidateKind)||
   !Number.isSafeInteger(d.byteCount)||d.byteCount<1||d.byteCount>65536||
   !flags.every(k=>d[k]===false))return failed();
  return Object.freeze({status:'config-metadata-observed',scope:'selected-file-metadata-only',
   candidateKind:d.candidateKind,byteCount:d.byteCount,contentOpened:false,dependencyScanPerformed:false,
   nativeIdentityVerified:false,compatibilityVerified:false,operationsEnabled:false});
 }catch{return failed();}
}
