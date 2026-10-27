import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findPreviewWindow,verifyMappedWindow,verifyNativeCommandLine}
 from './auto-real-x11-contract.mjs';
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
