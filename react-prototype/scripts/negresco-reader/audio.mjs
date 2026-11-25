// F3.08a: bounded WAV PCM and Ogg Opus container evidence; no playback or decoding.
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
 let codec,channels,sampleRate,bitDepth=null,sampleCount,chunkCount=0,crcVerified=false,preSkip=null,dataBytes=0;
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
  // Single logical stream, Opus mapping family 0, whole packets on each page.
  // No chained streams, packet continuation, multi-channel mappings or Vorbis setup.
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
    if(h.length!==19||h.toString('ascii',0,8)!=='OpusHead'||h[8]!==1||![1,2].includes(h[9])||h[18]!==0)fail();
    channels=h[9];sampleRate=48000;preSkip=h.readUInt16LE(10);
    if(channels>l.maxChannels||sampleRate>l.maxSampleRate)fail();stage=1;
   }else if(stage===1){
    if(packets.length!==1||granule!==0n||flags!==0)fail();
    const t=packets[0];
    if(t.length<16||t.toString('ascii',0,8)!=='OpusTags')fail();
    let q=12+t.readUInt32LE(8);
    if(q+4>t.length)fail();
    const comments=t.readUInt32LE(q);q+=4;
    if(comments>l.maxChunks)fail();
    for(let j=0;j<comments;j++){if(q+4>t.length)fail();const len=t.readUInt32LE(q);q+=4;if(len>t.length-q)fail();q+=len;}
    if(q!==t.length)fail();stage=2;
   }else{
    if(granule===0xffffffffffffffffn||granule<previousGranule||granule>BigInt(l.maxSamples)+BigInt(preSkip))fail();
    for(const packet of packets)dataBytes+=packet.length;
    previousGranule=granule;stage=3;
   }
   if(flags&4){if(stage!==3||end!==b.length)fail();eos=true;}
   p=end;seq++;
  }
  if(!eos||stage!==3||previousGranule<=BigInt(preSkip))fail();
  sampleCount=Number(previousGranule-BigInt(preSkip));codec='opus';crcVerified=true;
 }else fail();
 if(!int(sampleCount,1,l.maxSamples))fail();
 return Object.freeze({schemaVersion:1,scope:x.scope,format,source,codec,channels,sampleRate,bitDepth,sampleCount,
 durationSeconds:sampleCount/sampleRate,durationBasis:codec==='opus'?'declared-end-granule-minus-preskip':'pcm-frame-count',
 chunkCount,dataBytes,preSkip,crcVerified,fixtureAudioStructureValidated:true,codecPayloadValidated:false,
 samplesDecoded:false,audioPlayed:false,fullAudioSupport:false,realSecurityGateVerified:false,realReadsPerformed:false,operationsEnabled:false});
}
