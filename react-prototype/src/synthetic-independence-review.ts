// M3: extra fail-closed review for SYNTHETIC identification consensus.
// Does not inspect files, grant permissions, or turn a fake candidate into a real one.
import type {GameId} from './catalog';
import {projectSyntheticIndex,type SyntheticPackageIndex} from './synthetic-package-index';
import {matchesSyntheticWorkerOutcome,type SyntheticWorkerOutcome} from './synthetic-index-workers';

export type SyntheticIndependenceState=
 'blocked'|'incomplete'|'ambiguous'|'unknown'|'withheld'|'candidate';
export type SyntheticIndependenceReason=
 'invalid-provenance'|'worker-blocked'|'missing-or-incomplete-module'|
 'conflicting-games'|'no-identifying-evidence'|'reused-source-entry'|'none';
export type SyntheticIndependenceReview=Readonly<{
 schemaVersion:1;source:'synthetic-fixture';stage:'independence-review';
 state:SyntheticIndependenceState;reason:SyntheticIndependenceReason;
 candidateGame:GameId|null;
 structureEntries:number;definitionEntries:number;independentEntries:number;
 specialistReports:number;fixtureDigestVerified:false;realPackageRead:false;
 gameVerified:false;compatibilityVerified:false;installationVerified:false;
 operationsEnabled:false;
}>;

function result(
 state:SyntheticIndependenceState,reason:SyntheticIndependenceReason,
 candidateGame:GameId|null=null,
 structureEntries=0,definitionEntries=0,independentEntries=0,specialistReports=0
):SyntheticIndependenceReview{
 return Object.freeze({
  schemaVersion:1 as const,source:'synthetic-fixture' as const,
  stage:'independence-review' as const,state,reason,candidateGame,
  structureEntries,definitionEntries,independentEntries,specialistReports,
  fixtureDigestVerified:false as const,realPackageRead:false as const,
  gameVerified:false as const,compatibilityVerified:false as const,
  installationVerified:false as const,operationsEnabled:false as const
 });
}

// Only an outcome issued by the existing coordinator for this SAME index is
// accepted. Cloned JSON and cross-index results are never trusted.
// One physical fixture entry cannot independently corroborate itself just by
// being cited by two specialists. We do not treat distinct modules as proof
// of distinct evidence sources when their opaque handles coincide.
export function reviewSyntheticIdentification(
 index:SyntheticPackageIndex,outcome:SyntheticWorkerOutcome
):SyntheticIndependenceReview{
 try{projectSyntheticIndex(index,'container');}
 catch{return result('blocked','invalid-provenance');}
 if(!matchesSyntheticWorkerOutcome(index,outcome))
  return result('blocked','invalid-provenance');
 const count=outcome.coverage.length;
 if(outcome.status==='blocked'||outcome.snapshot.state==='blocked')
  return result('blocked','worker-blocked',null,0,0,0,count);
 if(outcome.status==='incomplete'||outcome.snapshot.state==='incomplete')
  return result('incomplete','missing-or-incomplete-module',null,0,0,0,count);
 if(outcome.snapshot.state==='ambiguous')
  return result('ambiguous','conflicting-games',null,0,0,0,count);
 if(outcome.snapshot.state==='unknown')
  return result('unknown','no-identifying-evidence',null,0,0,0,count);

 // The coordinator's state is still based exclusively on user-declared data.
 // The extra independent-entry check prevents self-corroboration via one handle.
 const structure=outcome.reports.find(r=>r.moduleId==='structure')?.signals??[];
 const definitions=outcome.reports.find(r=>r.moduleId==='definitions')?.signals??[];
 const a=new Set(structure.map(item=>item.evidenceId));
 const b=new Set(definitions.map(item=>item.evidenceId));
 const union=new Set([...a,...b]);
 const overlap=[...a].some(handle=>b.has(handle));
 if(!a.size||!b.size||overlap||union.size<2)
  return result('withheld','reused-source-entry',null,a.size,b.size,union.size,count);

 // candidateGame is still merely a scenario-fixture suggestion. No operation.
 return result('candidate','none',outcome.snapshot.candidateGame,
  a.size,b.size,union.size,count);
}
