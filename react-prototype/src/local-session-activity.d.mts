import type {InspectionGameId} from './inspection-types';
export type LocalActivityAction='inspection-observed'|'inspection-unavailable'|'inspection-cancelled'|'reference-saved'|'reference-discarded';
export type LocalActivity=Readonly<{game:InspectionGameId;action:LocalActivityAction}>;
export const MAX_LOCAL_ACTIVITY:number;
export function appendLocalActivity(previous:LocalActivity[],game:InspectionGameId,action:LocalActivityAction):LocalActivity[];
