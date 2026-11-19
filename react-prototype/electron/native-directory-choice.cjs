'use strict';
const path = require('node:path');
// A native picker can reject when a compositor/portal is unavailable.
// Never forward its exception or malformed response into renderer IPC.
const PICKER_UNAVAILABLE='Não foi possível abrir o seletor de pastas.';
const safeError=()=>({status:'error',message:PICKER_UNAVAILABLE});
function ownData(value,key){
  const prop=Object.getOwnPropertyDescriptor(value,key);
  return prop&&Object.hasOwn(prop,'value')?prop.value:undefined;
}
async function requestNativeDirectory(openNativePicker){
  try {
    if(typeof openNativePicker!=='function')return safeError();
    const choice=await openNativePicker();
    if(!choice||typeof choice!=='object')return safeError();
    const canceled=ownData(choice,'canceled');
    const paths=ownData(choice,'filePaths');
    if(typeof canceled!=='boolean'||!Array.isArray(paths))return safeError();
    if(canceled && paths.length===0)return {status:'cancelled'};
    if(canceled || paths.length!==1)return safeError();
    const selectedPath=ownData(paths,'0');
    if(typeof selectedPath!=='string'||selectedPath.length===0||
       selectedPath.length>32767||selectedPath.includes('\0')||
       !path.isAbsolute(selectedPath))return safeError();
    return {status:'selected',selectedPath};
  } catch {
    // No raw native error, path, stderr or provider response in IPC.
    return safeError();
  }
}
module.exports={requestNativeDirectory,PICKER_UNAVAILABLE};
