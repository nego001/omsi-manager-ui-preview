// F3.07b: bounded texture structure evidence; no pixel decoding or file access.
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_TEXTURE_REFUSED');};
const int=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?(n>>>1)^0xedb88320:n>>>1;return n>>>0;});
function crc32(b){let v=0xffffffff;for(const x of b)v=(v>>>8)^crcTable[(v^x)&255];return (v^0xffffffff)>>>0;}
export function inspectFixtureTexture(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','path','bytes','limits']),l=record(x.limits,['maxBytes','maxDimension','maxPixels','maxChunks','maxMipmaps']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,1,16*1024*1024)||x.bytes.length>l.maxBytes||
 !int(l.maxDimension,1,16384)||!int(l.maxPixels,1,67108864)||!int(l.maxChunks,1,4096)||!int(l.maxMipmaps,1,15))fail();
 const b=Buffer.from(x.bytes),source=buildFixtureIndex({scope:x.scope,limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes:l.maxBytes,maxEntryBytes:l.maxBytes},entries:[{path:x.path,kind:'file',bytes:b}]}).entries[0];
 const format=x.path.split('.').pop().toLowerCase();
 let width,height,channels,bitDepth,alphaMode,compression,mipmapCount=1,levels=[],chunkCount=0,crcVerified=false;
 function dimensions(w,h){if(!int(w,1,l.maxDimension)||!int(h,1,l.maxDimension)||w*h>l.maxPixels)fail();width=w;height=h;}
 if(format==='dds'){
  if(b.length<128||b.toString('latin1',0,4)!=='DDS '||b.readUInt32LE(4)!==124||b.readUInt32LE(76)!==32)fail();
  const u=o=>b.readUInt32LE(o),flags=u(8),caps=u(108);
  if((flags&0x1007)!==0x1007||!(flags&0x80000)||(flags&~0xa1007)!==0||!(caps&0x1000)||u(24)>1||u(112)||u(116)||u(120)||u(124))fail();
  dimensions(u(16),u(12));
  if(u(80)!==4||u(88)||u(92)||u(96)||u(100)||u(104))fail();
  compression=b.toString('latin1',84,88);
  if(!['DXT1','DXT3','DXT5'].includes(compression))fail();
  channels=4;bitDepth=null;alphaMode=compression==='DXT1'?'possible-bc1-alpha':'alpha-capable';
  mipmapCount=(flags&0x20000)?u(28):1;
  if(!int(mipmapCount,1,Math.min(l.maxMipmaps,1+Math.floor(Math.log2(Math.max(width,height)))))||
    (!(flags&0x20000)&&u(28)>1)||(mipmapCount>1&&((caps&0x400008)!==0x400008))||(caps&~0x401008)!==0)fail();
  let offset=128,w=width,h=height;
  for(let n=0;n<mipmapCount;n++){
   const length=Math.ceil(w/4)*Math.ceil(h/4)*(compression==='DXT1'?8:16);
   if(length>b.length-offset)fail();
   levels.push(Object.freeze({level:n,width:w,height:h,offset,length}));offset+=length;
   w=Math.max(1,Math.floor(w/2));h=Math.max(1,Math.floor(h/2));
  }
  if(offset!==b.length||u(20)!==levels[0].length)fail();
 }else if(format==='png'){
  if(b.length<45||!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail();
  let p=8,seenHeader=false,seenData=false,done=false,dataBytes=0;
  while(p<b.length){
   if(++chunkCount>l.maxChunks||p+12>b.length)fail();
   const len=b.readUInt32BE(p),start=p+8;
   if(len>b.length-start-4)fail();
   const end=start+len,tag=b.toString('latin1',p+4,start);
   if(crc32(b.subarray(p+4,end))!==b.readUInt32BE(end))fail();
   if(!seenHeader){
    if(tag!=='IHDR'||len!==13)fail();
    dimensions(b.readUInt32BE(start),b.readUInt32BE(start+4));
    bitDepth=b[start+8];const color=b[start+9];
    if(bitDepth!==8||![0,2,4,6].includes(color)||b[start+10]||b[start+11]||b[start+12])fail();
    channels=({0:1,2:3,4:2,6:4})[color];alphaMode=[4,6].includes(color)?'alpha-capable':'none-declared';
    seenHeader=true;compression='deflate';
   }else if(tag==='IDAT'){
    seenData=true;dataBytes+=len;
   }else if(tag==='IEND'){
    if(len||!seenData||!dataBytes||end+4!==b.length)fail();done=true;
   }else fail(); // ancillary chunks, palette and tRNS intentionally unsupported
   p=end+4;if(done)break;
  }
  if(!done)fail();crcVerified=true;
 }else if(format==='bmp'){
  if(b.length<54||b.toString('latin1',0,2)!=='BM'||b.readUInt32LE(2)!==b.length||
    b.readUInt32LE(6)||b.readUInt32LE(10)!==54||b.readUInt32LE(14)!==40)fail();
  const h=b.readInt32LE(22);dimensions(b.readInt32LE(18),Math.abs(h));
  bitDepth=8;const bits=b.readUInt16LE(28);
  if(b.readUInt16LE(26)!==1||bits!==24||b.readUInt32LE(30)||b.readUInt32LE(46)||b.readUInt32LE(50))fail();
  const stride=Math.ceil(width*3/4)*4,length=stride*height;
  if(length!==b.length-54||![0,length].includes(b.readUInt32LE(34)))fail();
  channels=3;alphaMode='none-declared';compression='none';
  levels.push(Object.freeze({level:0,width,height,offset:54,length,rowStride:stride,orientation:h<0?'top-down':'bottom-up'}));
 }else if(format==='tga'){
  if(b.length<18||b[0]||b[1]||![2,3,10,11].includes(b[2])||b.subarray(3,8).some(Boolean)||b.readUInt32LE(8))fail();
  dimensions(b.readUInt16LE(12),b.readUInt16LE(14));
  const gray=[3,11].includes(b[2]),rle=[10,11].includes(b[2]),bits=b[16],desc=b[17];
  if(!(gray?bits===8:[24,32].includes(bits))||(desc&0xd0)||(desc&15)!==(bits===32?8:0))fail();
  channels=bits/8;bitDepth=8;alphaMode=bits===32?'alpha-capable':'none-declared';compression=rle?'rle':'none';
  let p=18,remaining=width*height;
  if(rle){
   while(remaining){
    if(++chunkCount>l.maxChunks||p>=b.length)fail();
    const packet=b[p++],n=(packet&127)+1,len=(packet&128?1:n)*channels;
    if(n>remaining||len>b.length-p)fail();p+=len;remaining-=n;
   }
  }else p+=remaining*channels;
  if(p!==b.length)fail();
  levels.push(Object.freeze({level:0,width,height,offset:18,length:b.length-18,orientation:desc&32?'top-down':'bottom-up'}));
 }else if(['jpg','jpeg'].includes(format)){
  if(b.length<4||b[0]!==255||b[1]!==216)fail();
  let p=2,frame=null,done=false;
  while(p<b.length){
   if(++chunkCount>l.maxChunks||p+4>b.length||b[p++]!==255)fail();
   const marker=b[p++],length=b.readUInt16BE(p),start=p+2,end=p+length;
   if(length<2||end>b.length)fail();
   if(marker===0xc0){
    if(frame||length<8||b[start]!==8)fail();
    dimensions(b.readUInt16BE(start+3),b.readUInt16BE(start+1));channels=b[start+5];
    if(![1,3].includes(channels)||length!==8+3*channels)fail();
    frame=new Set();
    for(let j=0;j<channels;j++){
     const o=start+6+j*3,id=b[o],sampling=b[o+1];
     if(frame.has(id)||!int(sampling>>4,1,4)||!int(sampling&15,1,4)||b[o+2]>3)fail();frame.add(id);
    }
   }else if(marker===0xda){
    if(!frame||length!==6+2*channels||b[start]!==channels)fail();
    const ids=new Set();
    for(let j=0;j<channels;j++){
     const id=b[start+1+2*j],table=b[start+2+2*j];
     if(!frame.has(id)||ids.has(id)||(table>>4)>3||(table&15)>3)fail();ids.add(id);
    }
    if(b[end-3]!==0||b[end-2]!==63||b[end-1]!==0)fail();
    p=end;const scanStart=p;
    while(p<b.length){
     if(b[p++]!==255)continue;
     if(p>=b.length)fail();
     const next=b[p++];
     if(next===0)continue;
     if(next===217&&p===b.length&&p-scanStart>2){done=true;break;}
     fail();
    }
    break;
   }else if(!((marker>=0xe0&&marker<=0xef)||[0xfe,0xdb,0xc4].includes(marker)))fail();
   p=end;
  }
  if(!done||!frame)fail();
  bitDepth=8;alphaMode='none-declared';compression='jpeg-baseline';
 }else fail();
 return Object.freeze({schemaVersion:1,scope:x.scope,format,source,width,height,channels,bitDepth,alphaMode,compression,mipmapCount,
 levels:Object.freeze(levels),chunkCount,crcVerified,fixtureTextureStructureValidated:true,pixelsDecoded:false,
 actualTransparencyKnown:false,fullTextureSupport:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
