import type {RelationAnalysis} from './relation-analysis';

// Layout/view contract over the existing declared JSON analysis. No file or game reads.
export type TimelineRole='selected'|'direct'|'indirect';
export type TimelineStage={
 id:string;
 title:string;
 category:string;
 version:string;
 game:string;
 step:number;
 role:TimelineRole;
};
export type RelationTimeline={
 stages:TimelineStage[];
 hasCycle:boolean;
 hasMissingOrCrossGameDependency:boolean;
 noDeclaredDependencies:boolean;
 realInstallationVerified:false;
};
export function buildRelationTimeline(analysis:RelationAnalysis,selectedId:string):RelationTimeline{
 const target=analysis.sequence.find(mod=>mod.id===selectedId);
 const direct=new Set(target?.requires??[]);
 const hasCycle=analysis.issues.some(issue=>issue.code==='dependency-cycle');
 const hasMissingOrCrossGameDependency=analysis.issues.some(issue=>
  issue.code==='dependency-missing'||issue.code==='different-game'
 );
 return {
  stages:analysis.sequence.map((mod,index)=>({
   id:mod.id,title:mod.title,category:mod.category,version:mod.version,
   game:mod.game,step:index+1,
   role:mod.id===selectedId?'selected':direct.has(mod.id)?'direct':'indirect'
  })),
  hasCycle,hasMissingOrCrossGameDependency,
  noDeclaredDependencies:!!target&&(target.requires?.length??0)===0,
  realInstallationVerified:false
 };
}
