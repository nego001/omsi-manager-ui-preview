import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findPreviewWindow,verifyMappedWindow,verifyNativeCommandLine,
 verifyNativeWindowOwner,verifyNativeDesktopResults} from './auto-real-x11-contract.mjs';
test('accepts one mapped OMSI window and rejects unrelated or ambiguous titles',()=>{
 const example='     0x200007 "OMSI Manager · Prévia segura": ("app" "App")  1440x900+0+0';
 assert.equal(findPreviewWindow('xwininfo tree\n'+example),'0x200007');
 for(const invalid of ['', '0x100 "Another app": 800x600',
  example+'\n'+example,'0x100 "OMSI Manager" 800x600',
  '0x2 "OMSI Manager", not an actual window']){
  assert.throws(()=>findPreviewWindow(invalid),/X11_WINDOW_NOT_VERIFIED/);
 }
});
test('requires viewable window with bounded minimum geometry',()=>{
 assert.deepEqual(verifyMappedWindow('Map State: IsViewable\nWidth: 1024\nHeight: 768'),
  {mapped:true,usableWindow:true});
 for(const input of ['Map State: IsUnMapped\nWidth: 1440\nHeight: 900',
  'Map State: IsViewable\nWidth: 250\nHeight: 900',
  'Map State: IsViewable\nWidth: 1440\nHeight: 300'])
  assert.throws(()=>verifyMappedWindow(input));
});
test('native launcher execs the packaged ELF and never suppresses its sandbox',()=>{
 assert.equal(verifyNativeCommandLine(
  Buffer.from('/portable/OMSI-Manager-Preview\0--ozone-platform=x11\0'),'x11'),true);
 for(const input of [
  '/portable/OMSI-Manager-Preview\0--no-sandbox\0--ozone-platform=x11\0',
  '/portable/OMSI-Manager-Preview\0--ozone-platform=auto\0',
  '/portable/another-binary\0--ozone-platform=x11\0'
 ])assert.throws(()=>verifyNativeCommandLine(Buffer.from(input),'x11'));
});

test('X11 CI only passes when GNOME and KDE EACH map with no process failure',()=>{
 const success=[
  {desktop:'GNOME',mapped:true,failed:false,nativeProcess:true,windowOwned:true},
  {desktop:'KDE',mapped:true,failed:false,nativeProcess:true,windowOwned:true}
 ];
 assert.equal(verifyNativeDesktopResults(success),true);
 for(const missingOrBad of [
  [],
  [success[0]],
  [success[1]],
  [success[0],success[0]],
  [success[1],success[0]],
  [success[0],{desktop:'KDE',mapped:false,failed:true}],
  [{desktop:'GNOME',mapped:false,failed:true},success[1]],
  [{desktop:'GNOME',mapped:true,failed:true},success[1]],
  [success[0],{desktop:'KDE',mapped:true,failed:true}],
  [success[0],{...success[1],windowOwned:false}],
  [{...success[0],nativeProcess:false},success[1]],
  [success[0],{...success[1],windowOwned:'true'}],
  [success[0],{...success[1],nativeProcess:0}],
  [success[0],{desktop:'KDE',mapped:'true',failed:false}]
 ]){
  assert.throws(()=>verifyNativeDesktopResults(missingOrBad),
   /AUTO_X11_NATIVE_GUI_NOT_VERIFIED/);
 }
});

test('X11 window ownership requires one exact xprop PID matching the launched process',()=>{
 assert.equal(verifyNativeWindowOwner('_NET_WM_PID(CARDINAL) = 12345\n',12345),true);
 for(const [raw,pid] of [
  ['',12345],
  ['_NET_WM_PID: not found.\n',12345],
  ['_NET_WM_PID(CARDINAL) = 22222\n',12345],
  ['_NET_WM_PID(CARDINAL) = 12345\n_NET_WM_PID(CARDINAL) = 12345\n',12345],
  ['_NET_WM_PID(CARDINAL) = 0\n',0],
  ['_NET_WM_PID(CARDINAL) = -1\n',-1],
  ['_NET_WM_PID(CARDINAL) = 12345\n',12345.2],
  ['_NET_WM_PID(CARDINAL) = 12345\n',0],
  ['_NET_WM_PID(CARDINAL) = 12345\n',2147483648],
  ['_NET_WM_PID(CARDINAL) = 12345\n',null],
  ['_NET_WM_PID(CARDINAL) = 12345\n',12346],
  ['_NET_WM_PID(CARDINAL) = 12345; spoofed\n',12345]
 ])assert.throws(()=>verifyNativeWindowOwner(raw,pid),
  /X11_WINDOW_OWNER_NOT_VERIFIED/);
});
