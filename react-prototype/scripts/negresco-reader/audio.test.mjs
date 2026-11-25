import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectFixtureAudio as inspect} from './audio.mjs';
const limits={maxBytes:8192,maxChunks:20,maxChannels:2,maxSampleRate:96000,maxSamples:96000};
const input=(ext,bytes,over={})=>({scope:'synthetic-fixture',path:'vehicle/audio.'+ext,bytes,limits:{...limits,...over}});
const refuse=/^Error: READER_FIXTURE_AUDIO_REFUSED$/;
function chunk(tag,data){
 const b=Buffer.alloc(8+data.length+(data.length&1));b.write(tag);b.writeUInt32LE(data.length,4);data.copy(b,8);return b;
}
function wav({channels=2,bits=16,frames=100,rate=44100,extra=[]}={}){
 const f=Buffer.alloc(16),align=channels*bits/8;
 f.writeUInt16LE(1);f.writeUInt16LE(channels,2);f.writeUInt32LE(rate,4);f.writeUInt32LE(rate*align,8);f.writeUInt16LE(align,12);f.writeUInt16LE(bits,14);
 const h=Buffer.alloc(12);h.write('RIFF');h.write('WAVE',8);
 const b=Buffer.concat([h,chunk('fmt ',f),...extra,chunk('data',Buffer.alloc(frames*align))]);b.writeUInt32LE(b.length-8,4);return b;
}
function crc(b){let v=0;for(const x of b){v^=x<<24;for(let j=0;j<8;j++)v=(v<<1)^((v&0x80000000)?0x04c11db7:0);}return v>>>0;}
function page(seq,flags,granule,packets,serial=123){
 const lace=[];for(const p of packets){let n=p.length;while(n>=255){lace.push(255);n-=255;}lace.push(n);}
 const h=Buffer.alloc(27+lace.length);h.write('OggS');h[5]=flags;h.writeBigUInt64LE(BigInt(granule),6);h.writeUInt32LE(serial,14);h.writeUInt32LE(seq,18);h[26]=lace.length;Buffer.from(lace).copy(h,27);
 const b=Buffer.concat([h,...packets]);b.writeUInt32LE(crc(b),22);return b;
}
function opus({channels=2,preskip=312,granule=48312,serial=123,flags=4,seq=2}={}){
 const h=Buffer.alloc(19);h.write('OpusHead');h[8]=1;h[9]=channels;h.writeUInt16LE(preskip,10);h.writeUInt32LE(44100,12);
 const tags=Buffer.alloc(16);tags.write('OpusTags');
 return [page(0,2,0,[h]),page(1,0,0,[tags]),page(seq,flags,granule,[Buffer.alloc(260,1),Buffer.from([2,3])],serial)];
}
test('WAV PCM bit depths and channels expose exact sample frame duration',()=>{
 for(const bits of [8,16,24,32])for(const channels of [1,2]){
  const r=inspect(input('wav',wav({bits,channels,frames:101})));
  assert.equal(r.bitDepth,bits);assert.equal(r.channels,channels);assert.equal(r.sampleCount,101);assert.equal(r.durationSeconds,101/44100);
 }
});
test('WAV odd chunks padded correctly and bounded',()=>{
 const b=wav({extra:[chunk('JUNK',Buffer.from([1,2,3]))]});assert.equal(inspect(input('wav',b)).chunkCount,3);
 const a=Buffer.from(b);a[47]=1;assert.throws(()=>inspect(input('wav',a)),refuse);
 assert.throws(()=>inspect(input('wav',b,{maxChunks:2})),refuse);
});
test('WAV mismatched RIFF, block alignment, rate and format refused',()=>{
 for(const [o,v] of [[4,0],[20,3],[28,1],[32,1],[34,12],[40,0]]){const b=wav();b.writeUInt16LE(v,o);assert.throws(()=>inspect(input('wav',b)),refuse);}
 for(const b of [wav().subarray(0,-1),Buffer.concat([wav(),Buffer.alloc(1)]),wav({extra:[chunk('LIST',Buffer.alloc(4))]})])assert.throws(()=>inspect(input('wav',b)),refuse);
});
test('Ogg Opus pages CRC and lacing validated, declared granule minus preskip reported',()=>{
 const r=inspect(input('ogg',Buffer.concat(opus())));assert.equal(r.codec,'opus');assert.equal(r.sampleRate,48000);assert.equal(r.channels,2);
 assert.equal(r.sampleCount,48000);assert.equal(r.durationSeconds,1);assert.equal(r.dataBytes,262);assert.equal(r.crcVerified,true);assert.equal(r.codecPayloadValidated,false);
});
test('Ogg CRC errors, serial and sequence mismatches, missing EOS and continuation refused',()=>{
 const b=Buffer.concat(opus());b[b.length-1]^=1;
 for(const x of [b,Buffer.concat(opus({serial:124})),Buffer.concat(opus({seq:3})),Buffer.concat(opus({flags:0})),Buffer.concat(opus({flags:5})),Buffer.concat(opus()).subarray(0,-1)])assert.throws(()=>inspect(input('ogg',x)),refuse);
});
test('Ogg invalid header, granules, channel count and chained stream refused',()=>{
 for(const opts of [{channels:3},{granule:311},{granule:100000}])assert.throws(()=>inspect(input('opus',Buffer.concat(opus(opts)))),refuse);
 const pages=opus();assert.throws(()=>inspect(input('ogg',Buffer.concat([...pages,...pages]))),refuse);
 const h=Buffer.alloc(19);h.write('vorbis');assert.throws(()=>inspect(input('ogg',Buffer.concat([page(0,2,0,[h]),...pages.slice(1)]))),refuse);
});
test('audio limits enforced before data interpretation',()=>{
 for(const over of [{maxBytes:32},{maxSamples:99},{maxChannels:1},{maxSampleRate:8000}])assert.throws(()=>inspect(input('wav',wav(),over)),refuse);
 assert.throws(()=>inspect(input('ogg',Buffer.concat(opus()),{maxChunks:2})),refuse);
});
test('source path, scope, unsupported extensions and accessor refused',()=>{
 const x=input('wav',wav());for(const v of [{...x,path:'../a.wav'},{...x,scope:'real-mod'},{...x,path:'a.mp3'},{...x,extra:true}])assert.throws(()=>inspect(v),refuse);
 let invoked=false;Object.defineProperty(x,'bytes',{get(){invoked=true;return wav()}});assert.throws(()=>inspect(x),refuse);assert.equal(invoked,false);
});
test('audio evidence immutable, deterministic and not playback authorization',()=>{
 const x=input('wav',wav()),r=inspect(x);assert.deepEqual(r,inspect(x));assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.source));
 for(const k of ['codecPayloadValidated','samplesDecoded','audioPlayed','fullAudioSupport','realSecurityGateVerified','realReadsPerformed','operationsEnabled'])assert.equal(r[k],false);
 x.bytes.fill(0);assert.equal(r.sampleCount,100);
});

function vorbis({channels=2,rate=44100,granule=44100,block=0xb8,setupType=5}={}){
 const id=Buffer.alloc(30);id[0]=1;id.write('vorbis',1);id[11]=channels;id.writeUInt32LE(rate,12);id.writeInt32LE(128000,20);id[28]=block;id[29]=1;
 const tags=Buffer.alloc(16);tags[0]=3;tags.write('vorbis',1);tags[15]=1;
 const setup=Buffer.concat([Buffer.from([setupType]),Buffer.from('vorbis'),Buffer.from([0])]);
 return [page(0,2,0,[id]),page(1,0,0,[tags]),page(2,0,0,[setup]),page(3,4,granule,[Buffer.from([0,2,4])])];
}
function mp3frame({v=3,br=9,sr=0,pad=0,mono=false}={}){
 const rates=v===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
 const rate=[44100,48000,32000][sr]/(v===3?1:v===2?2:4);
 const b=Buffer.alloc(Math.floor((v===3?144000:72000)*rates[br]/rate)+pad);
 b.writeUInt32BE((0xffe00000|(v<<19)|(1<<17)|(1<<16)|(br<<12)|(sr<<10)|(pad<<9)|(mono?3<<6:0))>>>0);return b;
}
test('Ogg Vorbis identification, comment and opaque setup packet framing',()=>{
 const r=inspect(input('ogg',Buffer.concat(vorbis())));
 assert.equal(r.codec,'vorbis');assert.equal(r.sampleRate,44100);assert.equal(r.nominalBitrate,128000);
 assert.equal(r.durationSeconds,1);assert.equal(r.durationBasis,'declared-end-granule');assert.equal(r.codecPayloadValidated,false);
});
test('Vorbis unsupported headers, block exponents and codec extension refused',()=>{
 for(const opts of [{channels:0},{rate:0},{block:0x55},{block:0x69},{setupType:7},{granule:0}])assert.throws(()=>inspect(input('ogg',Buffer.concat(vorbis(opts)))),refuse);
 assert.throws(()=>inspect(input('opus',Buffer.concat(vorbis()))),refuse);
 const a=vorbis();a.pop();assert.throws(()=>inspect(input('ogg',Buffer.concat(a))),refuse);
});
test('MPEG 1 Layer III CBR and padding counted without decoding',()=>{
 const r=inspect(input('mp3',Buffer.concat([mp3frame(),mp3frame({pad:1})])));
 assert.equal(r.codec,'mpeg-layer-3');assert.equal(r.nominalBitrate,128000);assert.equal(r.frameCount,2);
 assert.equal(r.sampleCount,2304);assert.equal(r.durationSeconds,2304/44100);assert.equal(r.codecPayloadValidated,false);
});
test('MPEG 2 and 2.5 mono frame rates and variable bitrate',()=>{
 for(const [v,rate] of [[2,22050],[0,11025]]){
  const r=inspect(input('mp3',Buffer.concat([mp3frame({v,mono:true}),mp3frame({v,br:8,mono:true})])));
  assert.equal(r.channels,1);assert.equal(r.sampleRate,rate);assert.equal(r.nominalBitrate,null);assert.equal(r.sampleCount,1152);
 }
});
test('MP3 malformed headers, changed rate or channels, tags and truncation refused',()=>{
 const f=mp3frame();
 for(const offset of [0,1,2]){const b=Buffer.from(f);b[offset]=0;assert.throws(()=>inspect(input('mp3',b)),refuse);}
 for(const b of [f.subarray(0,-1),Buffer.concat([f,Buffer.from('TAG')]),Buffer.concat([f,mp3frame({sr:1})]),Buffer.concat([f,mp3frame({mono:true})]),Buffer.concat([Buffer.from('ID3'),f])])assert.throws(()=>inspect(input('mp3',b)),refuse);
});
test('MP3 sample and frame budgets enforced',()=>{
 const b=Buffer.concat([mp3frame(),mp3frame()]);
 assert.throws(()=>inspect(input('mp3',b,{maxChunks:1})),refuse);
 assert.throws(()=>inspect(input('mp3',b,{maxSamples:1152})),refuse);
});
