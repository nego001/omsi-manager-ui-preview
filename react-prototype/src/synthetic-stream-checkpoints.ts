// Streaming threat-model using NUMERIC fixture blocks only, never file contents.
// This is not a ZIP/SCS reader or decompressor and cannot grant OS access.
import {
 isIssuedSyntheticStreamDeclarationSource,areIndependentSyntheticScreeningSources,type SyntheticStreamDeclarationSource
} from './synthetic-container-screen';
import {SYNTHETIC_READ_BUDGETS} from './synthetic-read-admission';

export const SYNTHETIC_STREAM_LIMITS=Object.freeze({
 chunks:512,encodedBytesPerChunk:65_536,expandedBytesPerChunk:65_536,
 declaredElapsedMsPerChunk:250
});
export type SyntheticStreamFailure=
 'invalid-chunk'|'chunk-limit'|'size-mismatch'|'entry-order'|
 'resource-limit'|'time-limit'|'truncated-stream'|'cancelled';
export type SyntheticStreamReview=Readonly<{
 scope:'synthetic-chunk-simulation';revision:number;
 realReaderAvailable:false;realBytesRead:false;operationsEnabled:false;
}>;
export type SyntheticStreamCheckpoint=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';
 status:'pending'|'declarations-reviewed'|'blocked'|'cancelled';
 failure:SyntheticStreamFailure|null;
 processedChunks:number;totalDeclaredChunks:number;
 stagedEntries:number;releasedEntries:number;
 stagedEncodedBytes:number;stagedExpandedBytes:number;declaredElapsedMs:number;
 discardedPartialResults:boolean;realBytesRead:0;dataRetainedBytes:0;
 archiveParsed:false;decompressionPerformed:false;
 realIntegrityVerified:false;operationsEnabled:false;
}>;
type DeclaredChunk=Readonly<{
 entryOrdinal:number;encodedBytes:number;expandedBytes:number;
 elapsedMs:number;endOfEntry:boolean;
}>;
type StreamState={
 chunks:readonly unknown[];expected:SyntheticStreamDeclarationSource['entries'];
 screenedOrigin:SyntheticStreamDeclarationSource;
 revision:number;cursor:number;entryIndex:number;
 entryEncoded:number;entryExpanded:number;stagedEntries:number;
 encoded:number;expanded:number;timeMs:number;
 status:SyntheticStreamCheckpoint['status'];failure:SyntheticStreamFailure|null;
 discarded:boolean;
};
const issuedStreams=new WeakMap<object,StreamState>();
const fieldNames=['entryOrdinal','encodedBytes','expandedBytes','elapsedMs','endOfEntry'] as const;
function plainExact(value:unknown):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||
    Object.getPrototypeOf(value)!==Object.prototype)return false;
 const descriptors=Object.getOwnPropertyDescriptors(value);
 const keys=Reflect.ownKeys(value);
 return keys.length===fieldNames.length&&keys.every(key=>
  typeof key==='string'&&fieldNames.includes(key as typeof fieldNames[number])&&
  Object.hasOwn(descriptors[key],'value'));
}
function int(value:unknown):value is number{
 return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
}
function snapshot(s:StreamState):SyntheticStreamCheckpoint{
 const completed=s.status==='declarations-reviewed';
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  status:s.status,failure:s.failure,
  processedChunks:s.cursor,totalDeclaredChunks:s.chunks.length,
  stagedEntries:s.status==='pending'?s.stagedEntries:0,
  releasedEntries:completed?s.expected.length:0,
  stagedEncodedBytes:s.status==='pending'?s.encoded:0,
  stagedExpandedBytes:s.status==='pending'?s.expanded:0,
  declaredElapsedMs:s.status==='pending'?s.timeMs:0,
  discardedPartialResults:s.discarded,
  realBytesRead:0 as const,dataRetainedBytes:0 as const,
  archiveParsed:false as const,decompressionPerformed:false as const,
  realIntegrityVerified:false as const,operationsEnabled:false as const
 });
}
function get(review:SyntheticStreamReview):StreamState{
 const s=review&&typeof review==='object'?issuedStreams.get(review):undefined;
 if(!s)throw Error('Fluxo sintético não emitido.');
 return s;
}
function fail(s:StreamState,reason:SyntheticStreamFailure):SyntheticStreamCheckpoint{
 s.status=reason==='cancelled'?'cancelled':'blocked';
 s.failure=reason;s.discarded=true;
 s.encoded=0;s.expanded=0;s.entryEncoded=0;s.entryExpanded=0;s.timeMs=0;
 s.stagedEntries=0;
 return snapshot(s);
}
export function createSyntheticStreamReview(source:SyntheticStreamDeclarationSource,raw:unknown):SyntheticStreamReview{
 if(!isIssuedSyntheticStreamDeclarationSource(source))
  throw Error('Origem declarativa de fluxo não emitida.');
 if(!Array.isArray(raw))throw Error('Blocos fictícios inválidos.');
 // Above maximum: no individual chunk is examined or retained.
 const tooMany=raw.length>SYNTHETIC_STREAM_LIMITS.chunks;
 const chunks:unknown[]=tooMany?[]:raw.map(value=>{
  if(!plainExact(value))return null;
  return Object.freeze({
   entryOrdinal:value.entryOrdinal,encodedBytes:value.encodedBytes,
   expandedBytes:value.expandedBytes,elapsedMs:value.elapsedMs,endOfEntry:value.endOfEntry
  });
 });
 const handle:SyntheticStreamReview=Object.freeze({
  scope:'synthetic-chunk-simulation',revision:source.revision,
  realReaderAvailable:false,realBytesRead:false,operationsEnabled:false
 });
 issuedStreams.set(handle,{
  chunks:Object.freeze(chunks),expected:source.entries,screenedOrigin:source,revision:source.revision,
  cursor:0,entryIndex:0,entryEncoded:0,entryExpanded:0,stagedEntries:0,
  encoded:0,expanded:0,timeMs:0,
  status:tooMany?'blocked':'pending',failure:tooMany?'chunk-limit':null,
  discarded:tooMany
 });
 return handle;
}
// Recognizes only the original locally issued in-memory simulation object.
// Not an OS capability, file handle or proof of real file consent.
export function isIssuedSyntheticStreamReview(value:unknown):value is SyntheticStreamReview{
 return !!value&&typeof value==='object'&&issuedStreams.has(value);
}
// Scope validation includes the original synthetic screening, not just
// identical-looking public revision numbers or replayable declaration objects.
export function areIndependentlyScreenedSyntheticStreams(
 previous:unknown,next:unknown
):boolean{
 if(!previous||typeof previous!=='object'||!next||typeof next!=='object')return false;
 const a=issuedStreams.get(previous),b=issuedStreams.get(next);
 return !!a&&!!b&&areIndependentSyntheticScreeningSources(a.screenedOrigin,b.screenedOrigin);
}
export function snapshotSyntheticStreamReview(review:SyntheticStreamReview):SyntheticStreamCheckpoint{
 return snapshot(get(review));
}
export function cancelSyntheticStreamReview(review:SyntheticStreamReview):SyntheticStreamCheckpoint{
 const s=get(review);
 return s.status==='pending'?fail(s,'cancelled'):snapshot(s);
}
// A checkpoint consumes only one METADATA record. No synchronous payload work,
// actual clocks or I/O occur. The future native worker must enforce these itself.
export function advanceSyntheticStreamReview(review:SyntheticStreamReview):SyntheticStreamCheckpoint{
 const s=get(review);
 if(s.status!=='pending')return snapshot(s);
 if(s.cursor===s.chunks.length){
  if(s.entryIndex!==s.expected.length)return fail(s,'truncated-stream');
  s.status='declarations-reviewed';
  return snapshot(s);
 }
 const raw=s.chunks[s.cursor];
 if(!plainExact(raw)||!int(raw.entryOrdinal)||raw.entryOrdinal===0||
    !int(raw.encodedBytes)||!int(raw.expandedBytes)||!int(raw.elapsedMs)||
    typeof raw.endOfEntry!=='boolean')return fail(s,'invalid-chunk');
 const expected=s.expected[s.entryIndex];
 if(!expected||expected.ordinal!==raw.entryOrdinal)return fail(s,'entry-order');
 if(raw.encodedBytes>SYNTHETIC_STREAM_LIMITS.encodedBytesPerChunk||
    raw.expandedBytes>SYNTHETIC_STREAM_LIMITS.expandedBytesPerChunk||
    raw.expandedBytes>Math.max(1,raw.encodedBytes)*SYNTHETIC_READ_BUDGETS.ratio)
  return fail(s,'resource-limit');
 if(raw.elapsedMs>SYNTHETIC_STREAM_LIMITS.declaredElapsedMsPerChunk||
    s.timeMs+raw.elapsedMs>SYNTHETIC_READ_BUDGETS.timeMs)return fail(s,'time-limit');
 const e=s.entryEncoded+raw.encodedBytes,x=s.entryExpanded+raw.expandedBytes;
 const encoded=s.encoded+raw.encodedBytes,expanded=s.expanded+raw.expandedBytes;
 if(e>expected.encodedBytes||x>expected.expandedBytes||
    encoded>SYNTHETIC_READ_BUDGETS.encodedBytes||
    expanded>SYNTHETIC_READ_BUDGETS.expandedBytes||
    expanded>Math.max(1,encoded)*SYNTHETIC_READ_BUDGETS.ratio)return fail(s,'resource-limit');
 if(raw.endOfEntry&&(e!==expected.encodedBytes||x!==expected.expandedBytes))
  return fail(s,'size-mismatch');
 if(!raw.endOfEntry&&e===expected.encodedBytes&&x===expected.expandedBytes)
  return fail(s,'size-mismatch');
 s.cursor++;s.encoded=encoded;s.expanded=expanded;s.timeMs+=raw.elapsedMs;
 s.entryEncoded=e;s.entryExpanded=x;
 if(raw.endOfEntry){
  s.entryIndex++;s.stagedEntries++;
  s.entryEncoded=0;s.entryExpanded=0;
 }
 if(s.cursor===s.chunks.length){
  if(s.entryIndex!==s.expected.length)return fail(s,'truncated-stream');
  s.status='declarations-reviewed';
 }
 return snapshot(s);
}
