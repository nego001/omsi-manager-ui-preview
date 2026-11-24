import type {FolderInspection,InspectionGameId} from './inspection-types';
export type LocalObservationRow=Readonly<{key:string;group:string;kind:'directory'|'package';label:string}>;
export type LocalObservation=Readonly<{game:InspectionGameId;selectionMode:'parent-folder'|'direct-mod-folder';partial:boolean;rows:readonly LocalObservationRow[]}>;
export function captureLocalObservation(report:FolderInspection|undefined,game:InspectionGameId):LocalObservation|null;
export function compareLocalObservations(reference:LocalObservation|null,current:LocalObservation|null):Readonly<{shared:number;onlyReference:readonly LocalObservationRow[];onlyCurrent:readonly LocalObservationRow[];partial:boolean;sameLocationVerified:false;contentCompared:false;operationsEnabled:false}>|null;
