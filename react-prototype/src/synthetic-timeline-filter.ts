// Read-only filter over an already sanitized, immutable synthetic timeline.
// Filtering NEVER changes revision state, candidates, evidence, or operation permissions.
import type {SyntheticDiagnosticTimeline,TimelineRevision,TimelineEvent} from './synthetic-diagnostic-timeline';

export type SyntheticTimelineFilter='all'|'pending'|'blocked'|'changed';
export type FilteredTimelineRevision=TimelineRevision&Readonly<{matchingModules:number}>;
export type FilteredSyntheticTimeline=Readonly<Omit<SyntheticDiagnosticTimeline,'revisions'>&{
 filter:SyntheticTimelineFilter;
 visibleModules:number;totalModules:number;
 revisions:readonly FilteredTimelineRevision[];
}>;
const filters:ReadonlySet<string>=new Set(['all','pending','blocked','changed']);
function matches(event:TimelineEvent,filter:SyntheticTimelineFilter):boolean{
 if(event.kind!=='specialist')return false;
 if(filter==='all')return true;
 if(filter==='blocked')return event.status==='blocked';
 if(filter==='changed')return event.affectedByDeclaredChange;
 return event.status==='pending'||event.status==='missing'||event.status==='incomplete';
}
export function filterSyntheticDiagnosticTimeline(
 timeline:SyntheticDiagnosticTimeline,filter:SyntheticTimelineFilter
):FilteredSyntheticTimeline{
 if(!filters.has(filter))throw new Error('Filtro sintético inválido.');
 let visibleModules=0,totalModules=0;
 const revisions=Object.freeze(timeline.revisions.map(revision=>{
  const specialistEvents=revision.events.filter(e=>e.kind==='specialist');
  const shown=specialistEvents.filter(e=>matches(e,filter));
  totalModules+=specialistEvents.length;
  visibleModules+=shown.length;
  // Every revision heading stays visible. A filter must never erase historical context.
  const revisionEvent=revision.events.find(e=>e.kind==='revision');
  if(!revisionEvent)throw new Error('Revisão sintética sem explicação.');
  const events=Object.freeze([revisionEvent,...shown]);
  return Object.freeze({...revision,events,matchingModules:shown.length});
 }));
 return Object.freeze({
  ...timeline,filter,visibleModules,totalModules,revisions,
  previousEvidenceReusable:false as const,digestVerified:false as const,operationsEnabled:false as const
 });
}
