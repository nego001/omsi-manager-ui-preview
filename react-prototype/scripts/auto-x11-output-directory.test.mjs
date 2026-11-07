import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,lstat,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareFreshX11OutputDirectory as prepare,
 verifyX11OutputDirectoryIdentity as verify}
 from './auto-x11-output-directory.mjs';

const refused=/^Error: AUTO_X11_HANDOFF_OUTPUT_REFUSED$/;
async function withPrivateRoot(fn){
 const root=await mkdtemp(join(tmpdir(),'omsi-x11-private-'));
 try{await fn(root);}finally{await rm(root,{force:true,recursive:true});}
}
test('fresh output directory is private and exclusive, second initialization fails',async()=>{
 await withPrivateRoot(async root=>{
  const output=await prepare(root);
  const stat=await lstat(output.path);
  assert.equal(stat.isDirectory(),true);
  assert.equal(stat.mode&0o777,0o700);
  assert.equal(Object.isFrozen(output),true);
  assert.equal(await verify(output),true);
  await assert.rejects(prepare(root),refused);
 });
});
test('preexisting output file and nonempty directory are rejected without overwrite',async()=>{
 await withPrivateRoot(async root=>{
  const path=join(root,'x11-diff-output');
  await writeFile(path,'keep');
  await assert.rejects(prepare(root),refused);
  assert.equal(await readFile(path,'utf8'),'keep');
  await rm(path);
  await mkdir(path,{mode:0o700});
  await writeFile(join(path,'sentinel'),'preserve');
  await assert.rejects(prepare(root),refused);
  assert.equal(await readFile(join(path,'sentinel'),'utf8'),'preserve');
 });
});
test('preexisting symlink cannot redirect output into another directory',async()=>{
 await withPrivateRoot(async root=>{
  const elsewhere=join(root,'elsewhere');
  await mkdir(elsewhere);
  await symlink(elsewhere,join(root,'x11-diff-output'));
  await assert.rejects(prepare(root),refused);
  assert.deepEqual(await (await import('node:fs/promises')).readdir(elsewhere),[]);
 });
});
test('replaced directory identity or loosened permissions cannot be accepted',async()=>{
 await withPrivateRoot(async root=>{
  const output=await prepare(root);
  await rm(output.path,{recursive:true});
  await mkdir(output.path,{mode:0o755});
  await assert.rejects(verify(output),refused);
  await rm(output.path,{recursive:true});
  await symlink(root,output.path);
  await assert.rejects(verify(output),refused);
 });
});
test('invalid roots and invalid identities fail closed',async()=>{
 for(const root of [null,'',{},false])await assert.rejects(prepare(root),refused);
 for(const record of [null,{},[],{path:'/tmp',device:0,inode:0}])
  await assert.rejects(verify(record),refused);
});
