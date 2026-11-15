// M4: bounded SHA-256 check over explicitly provided IN-MEMORY fixture bytes.
// No filesystem, ZIP/SCS parser, IPC, file chooser, network, or permission grant.
// A matching SHA-256 proves only that these caller-supplied bytes match a
// caller-supplied expectation, NEVER that a game package or mod is authentic.
import {
 projectSyntheticIndex,type SyntheticPackageIndex
} from './synthetic-package-index';

export const SYNTHETIC_BYTE_DIGEST_LIMIT=65_536;
export type SyntheticFixtureDigestReason=
 'none'|'invalid-index'|'invalid-handle'|'invalid-claim'|
 'byte-limit'|'declared-size-mismatch'|'digest-mismatch'|'crypto-unavailable';
export type SyntheticFixtureByteReceipt=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';
 stage:'in-memory-byte-digest-only';
 status:'matched'|'rejected';reason:SyntheticFixtureDigestReason;
 handle:string|null;fixtureByteCount:number;fixtureSha256:string|null;
 bytesHashedFromMemory:boolean;expectedFixtureDigestMatched:boolean;
 realPackageDigestVerified:false;realPackageRead:false;
 gameVerified:false;compatibilityVerified:false;
 installationVerified:false;operationsEnabled:false;
}>;
type Binding=Readonly<{index:SyntheticPackageIndex;handle:string;digest:string}>;
const issued=new WeakMap<object,Binding>();
const sha256Pattern=/^[a-f0-9]{64}$/;
function rejected(reason:Exclude<SyntheticFixtureDigestReason,'none'>):SyntheticFixtureByteReceipt{
 // Do not return a partial digest or caller-provided content after rejection.
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  stage:'in-memory-byte-digest-only' as const,
  status:'rejected' as const,reason,handle:null,fixtureByteCount:0,
  fixtureSha256:null,bytesHashedFromMemory:false,
  expectedFixtureDigestMatched:false,realPackageDigestVerified:false as const,
  realPackageRead:false as const,gameVerified:false as const,
  compatibilityVerified:false as const,installationVerified:false as const,
  operationsEnabled:false as const
 });
}
function hexDigest(bytes:Uint8Array):string{
 return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
}

// A future native reader MUST have its own consent, file-handle isolation,
// immutable entry index and revalidation. This function grants NONE of these.
// The fixture index's digest remains a DECLARED string, not a real package hash.
// We copy the input before the first await, so mutation during asynchronous
// hashing cannot change which bytes are evaluated.
export async function checkSyntheticFixtureBytes(
 index:SyntheticPackageIndex,handle:unknown,bytes:unknown,expectedSha256:unknown
):Promise<SyntheticFixtureByteReceipt>{
 let entries:ReturnType<typeof projectSyntheticIndex>['entries'];
 try{entries=projectSyntheticIndex(index,'definitions').entries;}
 catch{return rejected('invalid-index');}
 if(typeof handle!=='string'||!handle.startsWith('synthetic-entry-'))
  return rejected('invalid-handle');
 const entry=entries.find(item=>item.handle===handle&&item.kind==='file');
 if(!entry)return rejected('invalid-handle');
 if(!(bytes instanceof Uint8Array)||typeof expectedSha256!=='string'||
    !sha256Pattern.test(expectedSha256))return rejected('invalid-claim');
 if(bytes.byteLength>SYNTHETIC_BYTE_DIGEST_LIMIT)return rejected('byte-limit');
 if(bytes.byteLength===0||bytes.byteLength!==entry.expandedBytes)
  return rejected('declared-size-mismatch');
 if(!globalThis.crypto?.subtle)return rejected('crypto-unavailable');
 const copy=new Uint8Array(bytes);
 let digest:string;
 try{
  const result=await globalThis.crypto.subtle.digest('SHA-256',copy);
  digest=hexDigest(new Uint8Array(result));
 }catch{
  return rejected('crypto-unavailable');
 }finally{
  copy.fill(0);
 }
 if(digest!==expectedSha256)return rejected('digest-mismatch');
 const receipt:SyntheticFixtureByteReceipt=Object.freeze({
  schemaVersion:1,source:'synthetic-fixture',stage:'in-memory-byte-digest-only',
  status:'matched',reason:'none',handle,fixtureByteCount:bytes.byteLength,
  fixtureSha256:digest,bytesHashedFromMemory:true,
  expectedFixtureDigestMatched:true,
  realPackageDigestVerified:false,realPackageRead:false,gameVerified:false,
  compatibilityVerified:false,installationVerified:false,operationsEnabled:false
 });
 issued.set(receipt,Object.freeze({index,handle,digest}));
 return receipt;
}

// This is a local object-identity check, not a certificate, signature, or
// filesystem capability. JSON copies and receipts from other issued indexes
// cannot be re-used, even with the same fixture digest and ordinal handle.
export function matchesSyntheticFixtureByteReceipt(
 index:SyntheticPackageIndex,handle:string,receipt:unknown
):boolean{
 if(!receipt||typeof receipt!=='object')return false;
 const bound=issued.get(receipt);
 return !!bound&&bound.index===index&&bound.handle===handle;
}
