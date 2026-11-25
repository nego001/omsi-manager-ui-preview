import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkLayout,checkInitialHomeLayout} from './desktop-layout-contract.mjs';
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

test('dashboard-first home still rejects offscreen or missing primary content',()=>{
 const home={...fixture(),banner:r(240,1260,20,250),dashboard:r(240,1000,265,355),heading:r(250,700,1100,1200)};
 assert.equal(checkInitialHomeLayout(home).status,'PASS');
 // The old strict heading contract remains unchanged until heading is scrolled.
 assert.throws(()=>checkLayout(home),/DESKTOP_GEOMETRY_NOT_VERIFIED/);
 assert.equal(checkLayout({...home,heading:r(250,700,320,400)}).status,'PASS');
 for(const patch of [{dashboard:null},{banner:null},{dashboard:r(240,1000,900,990)},
  {dashboard:r(240,1000,100,180)},{banner:r(-15,1260,20,250)},
  {heading:null},{heading:r(250,1400,1100,1200)},{overflow:90},{install:true},{remove:true},{execute:true}]){
  assert.throws(()=>checkInitialHomeLayout({...home,...patch}),/DESKTOP_(HOME_PRIMARY_)?GEOMETRY_NOT_VERIFIED/);
 }
});
