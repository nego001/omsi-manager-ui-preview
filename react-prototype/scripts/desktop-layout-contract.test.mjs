import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkLayout} from './desktop-layout-contract.mjs';
const r=(left,right,top,bottom)=>({left,right,top,bottom});
const fixture=(width=1280,height=800,scale=1)=>({
 width,height,dpr:scale,overflow:0,
 heading:r(250,700,140,220),nav:r(10,200,130,500),
 main:r(230,width-10,100,height+50),sidebar:r(0,230,0,height),
 mode:'read-only',install:false,remove:false,execute:false
});
test('common desktop widths and fractional scale observations are bounded',()=>{
 for(const [w,h,d] of [[850,600,1],[1024,720,1.25],[1280,800,1.5],[1440,900,2]]){
  const report=checkLayout(fixture(w,h,d));
  assert.deepEqual(report.viewport,[w,h]);
  assert.equal(report.scale,d);
  assert.equal(report.readOnly,true);
  assert.equal(Object.isFrozen(report),true);
 }
});
test('clipping, missing navigation, overflow and write capabilities fail closed',()=>{
 for(const patch of [
  {width:400},{height:300},{dpr:0},{dpr:12},{overflow:90},
  {heading:r(-20,500,120,220)},{heading:r(250,1400,120,220)},
  {heading:r(250,700,1100,1200)},
  {heading:null},{nav:null},{main:null},{sidebar:null},
  {mode:'write'},{install:true},{remove:true},{execute:true}
 ]){
  assert.throws(()=>checkLayout({...fixture(),...patch}),/DESKTOP_GEOMETRY_NOT_VERIFIED/);
 }
});
