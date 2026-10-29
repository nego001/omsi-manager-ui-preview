import {test} from 'node:test';
import assert from 'node:assert/strict';
import {categorizeApparmorModule,categorizeApparmorProfile}
 from './auto-x11-host-policy-contract.mjs';

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
