// Regression: cross-module static import must terminate (no unresolved
// top-level-await / dynamic-import cycle) and never launch a real app.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const folder=dirname(fileURLToPath(import.meta.url));
const main=join(folder,'auto-x11-sigtrap-syscalls.mjs');
const parser=join(folder,'auto-x11-prctl-context.mjs');
const run=(args)=>spawnSync(process.execPath,args,{
 cwd:folder,
 encoding:'utf8',
 timeout:4000,
 maxBuffer:8192,
 windowsHide:true,
 env:{PATH:'/usr/bin:/bin',LANG:'C',CI:'false',GITHUB_ACTIONS:'false'}
});

test('M33 plus M34 static imports terminate without ESM exit code 13',()=>{
 const x=run(['--input-type=module','-e',
   "await import('./auto-x11-sigtrap-syscalls.mjs');"+
   "await import('./auto-x11-prctl-context.mjs');"+
   "console.log('M34_STATIC_IMPORT_OK')"]);
 assert.equal(x.error,undefined);
 assert.equal(x.signal,null);
 assert.equal(x.status,0);
 assert.equal(x.stdout.trim(),'M34_STATIC_IMPORT_OK');
 assert.ok(!x.stderr.includes('unsettled top-level await'));
});

test('guarded entrypoint refuses offline context without accessing artifacts',()=>{
 const x=run([main]);
 assert.equal(x.error,undefined);
 assert.equal(x.signal,null);
 assert.equal(x.status,1);
 assert.equal(x.stdout,'');
 assert.ok(x.stderr.includes('M33_SYSCALL_DIAGNOSTIC_REFUSED'));
 assert.ok(!x.stderr.includes('unsettled top-level await'));
});

test('real script statically links M34, never dynamically imports it in pending await',()=>{
 const source=readFileSync(main,'utf8');
 assert.match(source,
   /import\s+\{classifyM34PrctlContext\}\s+from\s+['"]\.\/auto-x11-prctl-context\.mjs['"]/);
 assert.doesNotMatch(source,/await\s+import\s*\(\s*['"]\.\/auto-x11-prctl-context\.mjs/);
 const sibling=readFileSync(parser,'utf8');
 assert.match(sibling,/classifyM33SyscallTrace/);
});
