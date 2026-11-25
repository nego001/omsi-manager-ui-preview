// F3.08b: bounded WAV PCM, MPEG Layer III and Ogg container evidence; no playback or decoding.
import {buildFixtureIndex} from './index.mjs';
const fail=()=>{throw Error('READER_FIXTURE_AUDIO_REFUSED');};
const int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
function record(o,keys){
 if(!o||Object.getPrototypeOf(o)!==Object.prototype||Reflect.ownKeys(o).length!==keys.length)fail();
 const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(o,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)fail();r[k]=d.value;}return r;
}
// Ogg CRC: non-reflected polynomial 0x04c11db7, checksum field treated as zero.
const crcTable=Uint32Array.from({length:256},(_,i)=>{let v=i<<24;for(let j=0;j<8;j++)v=(v<<1)^((v&0x80000000)?0x04c11db7:0);return v>>>0;});
function oggCrc(b,start,end){let v=0;for(let p=start;p<end;p++){const x=p-start>=22&&p-start<26?0:b[p];v=((v<<8)^crcTable[((v>>>24)^x)&255])>>>0;}return v;}
export function inspectFixtureAudio(input){try{return inspect(input);}catch{fail();}}
function inspect(input){
 const x=record(input,['scope','path','bytes','limits']);
 const l=record(x.limits,['maxBytes','maxChunks','maxChannels','maxSampleRate','maxSamples']);
 if(x.scope!=='synthetic-fixture'||!Buffer.isBuffer(x.bytes)||!int(l.maxBytes,1,16*1024*1024)||x.bytes.length>l.maxBytes||
 !int(l.maxChunks,1,4096)||!int(l.maxChannels,1,8)||!int(l.maxSampleRate,8000,384000)||!int(l.maxSamples,1,2**32))fail();
 const b=Buffer.from(x.bytes),source=buildFixtureIndex({scope:x.scope,limits:{maxEntries:1,maxNodes:32,maxDepth:32,maxBytes:l.maxBytes,maxEntryBytes:l.maxBytes},entries:[{path:x.path,kind:'file',bytes:b}]}).entries[0];
 const format=x.path.split('.').pop().toLowerCase();
 let codec,channels,sampleRate,bitDepth=null,sampleCount,chunkCount=0,crcVerified=false,preSkip=null,dataBytes=0,nominalBitrate=null,frameCount=null;
 if(format==='wav'){
  if(b.length<44||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WAVE'||b.readUInt32LE(4)!==b.length-8)fail();
  let p=12,seenFmt=false,seenData=false,align=0;
  while(p<b.length){
   if(++chunkCount>l.maxChunks||p+8>b.length)fail();
   const tag=b.toString('ascii',p,p+4),len=b.readUInt32LE(p+4),s=p+8;
   if(len>b.length-s||len+(len&1)>b.length-s)fail();
   const end=s+len;
   if((len&1)&&b[end]!==0)fail();
   if(tag==='fmt '){
    if(seenFmt||seenData||len!==16||b.readUInt16LE(s)!==1)fail();
    channels=b.readUInt16LE(s+2);sampleRate=b.readUInt32LE(s+4);bitDepth=b.readUInt16LE(s+14);
    if(!int(channels,1,l.maxChannels)||!int(sampleRate,8000,l.maxSampleRate)||![8,16,24,32].includes(bitDepth))fail();
    align=channels*bitDepth/8;
    if(b.readUInt16LE(s+12)!==align||b.readUInt32LE(s+8)!==sampleRate*align)fail();
    seenFmt=true;
   }else if(tag==='data'){
    if(!seenFmt||seenData||!len||len%align)fail();
    dataBytes=len;sampleCount=len/align;seenData=true;
   }else if(tag!=='JUNK'&&tag!=='PAD ')fail();
   p=end+(len&1);
  }
  if(!seenFmt||!seenData)fail();
  codec='pcm-integer';
 }else if(format==='ogg'||format==='opus'){
  // Single logical stream, whole packets on each page; no continued/chained streams.
  let p=0,serial=null,seq=0,stage=0,previousGranule=0n,eos=false;
  while(p<b.length){
   if(++chunkCount>l.maxChunks||p+27>b.length||b.toString('ascii',p,p+4)!=='OggS'||b[p+4]!==0||eos)fail();
   const flags=b[p+5],granule=b.readBigUInt64LE(p+6),s=b.readUInt32LE(p+14),n=b[p+26];
   if((flags&~6)!==0||!n||p+27+n>b.length||b.readUInt32LE(p+18)!==seq)fail();
   if(seq===0){if(flags!==2)fail();serial=s;}else if(s!==serial||(flags&2))fail();
   const lace=b.subarray(p+27,p+27+n),body=p+27+n;
   let length=0;for(const v of lace)length+=v;
   const end=body+length;
   if(end>b.length||lace[n-1]===255||oggCrc(b,p,end)!==b.readUInt32LE(p+22))fail();
   const packets=[];let cursor=body,packetLength=0;
   for(const v of lace){packetLength+=v;if(v!==255){if(!packetLength)fail();packets.push(b.subarray(cursor,cursor+packetLength));cursor+=packetLength;packetLength=0;}}
   if(stage===0){
    if(packets.length!==1||granule!==0n)fail();
    const h=packets[0];
    if(h.length===19&&h.toString('ascii',0,8)==='OpusHead'){
     if(h[8]!==1||![1,2].includes(h[9])||h[18]!==0)fail();
     codec='opus';channels=h[9];sampleRate=48000;preSkip=h.readUInt16LE(10);
    }else{
     if(format!=='ogg'||h.length!==30||h[0]!==1||h.toString('ascii',1,7)!=='vorbis'||h.readUInt32LE(7)!==0||h[29]!==1)fail();
     codec='vorbis';channels=h[11];sampleRate=h.readUInt32LE(12);
     const small=h[28]&15,large=h[28]>>4;
     if(!int(small,6,13)||!int(large,small,13))fail();
     const declared=h.readInt32LE(20);if(declared>0)nominalBitrate=declared;
    }
    if(!int(channels,1,l.maxChannels)||!int(sampleRate,8000,l.maxSampleRate))fail();
    if(channels>l.maxChannels||sampleRate>l.maxSampleRate)fail();stage=1;
   }else if(stage===1){
    if(packets.length!==1||granule!==0n||flags!==0)fail();
    const t=packets[0];
    const v=codec==='vorbis',prefix=v?7:8;
    if(t.length<prefix+8+(v?1:0)||(v? t[0]!==3||t.toString('ascii',1,7)!=='vorbis':t.toString('ascii',0,8)!=='OpusTags'))fail();
    let q=prefix+4+t.readUInt32LE(prefix);
    if(q+4>t.length)fail();
    const comments=t.readUInt32LE(q);q+=4;
    if(comments>l.maxChunks)fail();
    for(let j=0;j<comments;j++){if(q+4>t.length)fail();const len=t.readUInt32LE(q);q+=4;if(len>t.length-q)fail();q+=len;}
    if(v?(q!==t.length-1||t[q]!==1):q!==t.length)fail();stage=v?2:3;
   }else if(stage===2){
    if(packets.length!==1||granule!==0n||flags!==0||packets[0].length<8||packets[0][0]!==5||packets[0].toString('ascii',1,7)!=='vorbis')fail();
    stage=3; // Setup body deliberately opaque, not codec validation.
   }else{
    if(granule===0xffffffffffffffffn||granule<previousGranule||granule>BigInt(l.maxSamples)+BigInt(preSkip??0))fail();
    for(const packet of packets){if(codec==='vorbis'&&(packet[0]&1))fail();dataBytes+=packet.length;}
    previousGranule=granule;stage=4;
   }
   if(flags&4){if(stage!==4||end!==b.length)fail();eos=true;}
   p=end;seq++;
  }
  if(!eos||stage!==4||previousGranule<=BigInt(preSkip??0))fail();
  sampleCount=Number(previousGranule-BigInt(preSkip??0));crcVerified=true;
 }else if(format==='mp3'){
  // MPEG-1/2/2.5 Layer III, no tags, CRC-protected frames or free bitrate.
  const rates1=[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320];
  const rates2=[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
  let p=0,version=null,bitrate=null;sampleCount=0;frameCount=0;
  while(p<b.length){
   if(++frameCount>l.maxChunks||p+4>b.length)fail();
   const h=b.readUInt32BE(p),v=(h>>>19)&3,layer=(h>>>17)&3,br=(h>>>12)&15,sr=(h>>>10)&3,pad=(h>>>9)&1;
   if((h>>>21)!==0x7ff||v===1||layer!==1||!(h&0x10000)||!int(br,1,14)||sr===3||(h&3)===2)fail();
   const rate=[44100,48000,32000][sr]/(v===3?1:v===2?2:4),ch=((h>>>6)&3)===3?1:2,kbps=(v===3?rates1:rates2)[br];
   if(!int(rate,8000,l.maxSampleRate)||ch>l.maxChannels)fail();
   if(version===null){version=v;sampleRate=rate;channels=ch;bitrate=kbps;}
   else if(version!==v||sampleRate!==rate||channels!==ch)fail();
   if(bitrate!==kbps)bitrate=0;
   const length=Math.floor((v===3?144000:72000)*kbps/rate)+pad;
   const sideInfo=v===3?(ch===1?17:32):(ch===1?9:17);
   if(length<4+sideInfo||length>b.length-p)fail();
   sampleCount+=v===3?1152:576;if(sampleCount>l.maxSamples)fail();p+=length;
  }
  if(!frameCount)fail();
  codec='mpeg-layer-3';dataBytes=b.length;chunkCount=frameCount;nominalBitrate=bitrate?bitrate*1000:null;
 }else fail();
 if(!int(sampleCount,1,l.maxSamples))fail();
 return Object.freeze({schemaVersion:1,scope:x.scope,format,source,codec,channels,sampleRate,bitDepth,sampleCount,
 durationSeconds:sampleCount/sampleRate,durationBasis:codec==='opus'?'declared-end-granule-minus-preskip':codec==='vorbis'?'declared-end-granule':codec==='mpeg-layer-3'?'mpeg-frame-count-no-gapless-trim':'pcm-frame-count',
 chunkCount,dataBytes,preSkip,crcVerified,nominalBitrate,frameCount,fixtureAudioStructureValidated:true,codecPayloadValidated:false,
 samplesDecoded:false,audioPlayed:false,fullAudioSupport:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
