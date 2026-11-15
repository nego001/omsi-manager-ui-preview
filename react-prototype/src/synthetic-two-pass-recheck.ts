// M5: compare TWO fixture-only in-memory SHA-256 checks on the same issued index.
// No disk, archive, IPC, process, OS capability, network, or real mod inspection.
// Passing two fixture checks does NOT prove an actual package stayed unchanged.
import {projectSyntheticIndex,type SyntheticPackageIndex} from './synthetic-package-index';
import {
 checkSyntheticFixtureBytes,matchesSyntheticFixtureByteReceipt,
 type SyntheticFixtureByteReceipt
} from './synthetic-fixture-byte-digest';

export type SyntheticRecheckStatus='blocked'|'unchanged-fixture'|'changed-fixture';
export type SyntheticRecheckReason=
 'none'|'invalid-index'|'invalid-handle'|'reused-receipt'|
 'unissued-receipt'|'reused-buffer'|'first-pass-rejected'|'second-pass-rejected';
export type SyntheticTwoPassRecheck=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';stage:'two-pass-memory-only';
 status:SyntheticRecheckStatus;reason:SyntheticRecheckReason;
 sameFixtureBytes:boolean|null;firstByteCount:number;secondByteCount:number;
 twoDistinctReceipts:boolean;
 previousEvidenceReusable:false;realPackageDigestVerified:false;
 realPackageRead:false;gameVerified:false;compatibilityVerified:false;
 installationVerified:false;operationsEnabled:false;
}>;

function report(
 status:SyntheticRecheckStatus,reason:SyntheticRecheckReason,
 sameFixtureBytes:boolean|null=null,
 firstByteCount=0,secondByteCount=0,twoDistinctReceipts=false
):SyntheticTwoPassRecheck{
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  stage:'two-pass-memory-only' as const,status,reason,
  sameFixtureBytes,firstByteCount,secondByteCount,twoDistinctReceipts,
  previousEvidenceReusable:false as const,realPackageDigestVerified:false as const,
  realPackageRead:false as const,gameVerified:false as const,
  compatibilityVerified:false as const,installationVerified:false as const,
  operationsEnabled:false as const
 });
}
function eligible(index:SyntheticPackageIndex,handle:unknown):SyntheticRecheckReason|null{
 let view:ReturnType<typeof projectSyntheticIndex>;
 try{view=projectSyntheticIndex(index,'definitions');}
 catch{return 'invalid-index';}
 if(typeof handle!=='string'||!view.entries.some(e=>e.kind==='file'&&e.handle===handle))
  return 'invalid-handle';
 return null;
}

// Receipts MUST be issued by M4 for precisely this same index instance/handle.
// They can never establish real independence of a source: only of two hash calls.
export function compareSyntheticFixtureReceipts(
 index:SyntheticPackageIndex,handle:unknown,
 first:unknown,second:unknown
):SyntheticTwoPassRecheck{
 const invalid=eligible(index,handle);
 if(invalid)return report('blocked',invalid);
 if(first===second)return report('blocked','reused-receipt');
 if(!matchesSyntheticFixtureByteReceipt(index,handle as string,first)||
    !matchesSyntheticFixtureByteReceipt(index,handle as string,second))
  return report('blocked','unissued-receipt');
 const a=first as SyntheticFixtureByteReceipt,b=second as SyntheticFixtureByteReceipt;
 if(a.status!=='matched'||b.status!=='matched'||!a.fixtureSha256||!b.fixtureSha256)
  return report('blocked','unissued-receipt');
 const equal=a.fixtureSha256===b.fixtureSha256&&a.fixtureByteCount===b.fixtureByteCount;
 return report(equal?'unchanged-fixture':'changed-fixture','none',
  equal,a.fixtureByteCount,b.fixtureByteCount,true);
}

// Runs two real SHA-256 operations over separate, caller-provided buffers.
// They are NOT independent reads of an actual file. Aliasing the same buffer
// is refused to make an accidental one-buffer replay harder in the laboratory.
export async function recheckSyntheticFixtureBytes(
 index:SyntheticPackageIndex,handle:unknown,
 firstBytes:unknown,firstExpectedSha:unknown,
 secondBytes:unknown,secondExpectedSha:unknown
):Promise<SyntheticTwoPassRecheck>{
 const invalid=eligible(index,handle);
 if(invalid)return report('blocked',invalid);
 if(firstBytes instanceof Uint8Array&&secondBytes instanceof Uint8Array&&
    firstBytes.buffer===secondBytes.buffer)return report('blocked','reused-buffer');
 const first=await checkSyntheticFixtureBytes(index,handle,firstBytes,firstExpectedSha);
 if(first.status!=='matched')return report('blocked','first-pass-rejected');
 const second=await checkSyntheticFixtureBytes(index,handle,secondBytes,secondExpectedSha);
 if(second.status!=='matched')return report('blocked','second-pass-rejected');
 return compareSyntheticFixtureReceipts(index,handle,first,second);
}
