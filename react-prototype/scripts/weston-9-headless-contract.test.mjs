import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weston9HeadlessArgs} from './weston-9-headless-contract.mjs';

test('Weston 9 headless uses documented software renderer flag, not newer CLI',()=>{
 const args=weston9HeadlessArgs('omsi-ci-wayland');
 assert.deepEqual(args,[
  '--backend=headless-backend.so','--socket=omsi-ci-wayland',
  '--idle-time=0','--use-pixman'
 ]);
 assert.equal(Object.isFrozen(args),true);
 assert.equal(args.some(x=>x.startsWith('--renderer=')),false);
 assert.equal(args.some(x=>/sandbox|sudo|disable|setcap/.test(x)),false);
});
test('socket name input cannot inject CLI switches, paths or shell syntax',()=>{
 for(const socket of [null,undefined,'','-foo','--renderer=pixman',
  'socket/foo','../socket','/run/user/123','socket space',
  'socket;sudo','socket\n--no-sandbox','socket:wayland','SOCKET',
  'a'.repeat(51),{},42]){
  assert.throws(()=>weston9HeadlessArgs(socket),/^Error: WESTON_HEADLESS_SOCKET_REFUSED$/);
 }
});
