// Read-only CI fingerprint for the exact unsigned portable Linux archive.
// No private paths, file contents, stderr, signatures or policy changes are emitted.
import {createHash} from 'node:crypto';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';
const refuse=()=>{throw Error('AUTO_X11_ARCHIVE_PROVENANCE_REFUSED');};
const filename='OMSI-Manager-Preview-Linux-x64.tar.gz';
const sidecarName='OMSI-Manager-Preview-Linux-x64.sha256';
export async function readVerifiedX11ArchiveSha256(archivePath,sidecarPath){
 if(typeof archivePath!=='string'||typeof sidecarPath!=='string'||
    basename(archivePath)!==filename||basename(sidecarPath)!==sidecarName||
    dirname(resolve(archivePath))!==dirname(resolve(sidecarPath)))refuse();
 let archive,sidecar;
 try{
  sidecar=await open(sidecarPath,constants.O_RDONLY|constants.O_NOFOLLOW);
  const meta=await sidecar.stat();
  if(!meta.isFile()||meta.size<66||meta.size>256)refuse();
  const line=await sidecar.readFile({encoding:'utf8'});
  const match=line.match(/^([a-f0-9]{64})  OMSI-Manager-Preview-Linux-x64\.tar\.gz\n$/);
  if(!match)refuse();
  archive=await open(archivePath,constants.O_RDONLY|constants.O_NOFOLLOW);
  const fileMeta=await archive.stat();
  if(!fileMeta.isFile()||fileMeta.size<1||fileMeta.size>2147483648)refuse();
  const hash=createHash('sha256');
  let count=0;
  for await(const chunk of archive.createReadStream({autoClose:false})){
   count+=chunk.length;
   if(count>fileMeta.size)refuse();
   hash.update(chunk);
  }
  if(count!==fileMeta.size)refuse();
  const computed=hash.digest('hex');
  if(computed!==match[1])refuse();
  return computed;
 }catch{refuse();}
 finally{
  await archive?.close().catch(()=>{});
  await sidecar?.close().catch(()=>{});
 }
}
