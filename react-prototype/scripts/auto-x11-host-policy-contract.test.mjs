import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categorizeApparmorModule,categorizeApparmorProfile,
 categorizeUnshareFailure} from './auto-x11-host-policy-contract.mjs';

test('AppArmor module capability is reduced to fixed categories',()=>{
 for(const [raw,category] of [
  ['Y\n','enabled'],['N\n','disabled'],
  [undefined,'unavailable'],[null,'unavailable'],
  ['1','unknown'],['y','unknown'],['Y extra','unknown'],
  ['', 'unknown'],[42,'unknown'],['Y'.repeat(200),'unknown']
 ])assert.equal(categorizeApparmorModule(raw),category);
});

test('AppArmor current profile never reveals filenames, locations or names',()=>{
 for(const [raw,category] of [
  ['unconfined\n','unconfined'],
  ['/private/hidden-name (enforce)\n','confined-enforce'],
  ['ci-secret-user-profile (complain)\n','confined-complain'],
  ['/private/hidden-name (kill)\n','unknown'],
  ['unconfined but really not','unknown'],
  [undefined,'unavailable'],[null,'unavailable'],
  ['', 'unknown'],['secret\n(untrusted)','unknown'],
  [123,'unknown'],['/hidden/'.repeat(200)+' (enforce)','unknown']
 ]){
  const observed=categorizeApparmorProfile(raw);
  assert.equal(observed,category);
  assert.ok(!observed.includes('private'));
  assert.ok(!observed.includes('hidden'));
  assert.ok(!observed.includes('secret'));
  assert.ok(!observed.includes('/'));
 }
});

test('unshare failures are classified without leaking raw OS stderr',()=>{
 const fixtures=[
  [{code:'EPERM'},'permission-denied'],
  [{code:'EACCES'},'permission-denied'],
  [{code:1,stderr:'unshare: unshare failed: Operation not permitted\n'},'permission-denied'],
  [{code:1,stderr:'unshare: Permission denied for /home/private/user\n'},'permission-denied'],
  [{code:'ENOENT',message:'path to /home/private/unshare'},'tool-unavailable'],
  [{code:'ETIMEDOUT',stderr:'private data'},'timeout'],
  [{killed:true,stderr:'private data'},'timeout'],
  [{signal:'SIGTERM',stderr:'private data'},'timeout'],
  [{code:1,stderr:'unshare: Function not implemented'},'unsupported'],
  [{code:1,stderr:'unshare: Invalid argument'},'unsupported'],
  [{code:1,stderr:'user namespaces not supported'},'unsupported'],
  [{code:1,stderr:'mount: private /home/user'},'other-failure'],
  [{code:1,stderr:'x'.repeat(5000)+' Operation not permitted'},'other-failure'],
  [{code:1,stderr:'Operation not permitted',killed:true},'timeout'],
  [null,'other-failure'],['private path','other-failure'],[new Error('private path'),'other-failure']
 ];
 const categories=new Set(['permission-denied','tool-unavailable','timeout','unsupported','other-failure']);
 for(const [error,expected] of fixtures){
  const category=categorizeUnshareFailure(error);
  assert.equal(category,expected);
  assert.ok(categories.has(category));
  assert.ok(!category.includes('/'));
  assert.ok(!category.includes('private'));
 }
});
