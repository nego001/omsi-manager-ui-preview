import type {FolderInspection,InspectionGameId} from './inspection-types';
export type LocalDiagnosticRow={game:InspectionGameId;state:'unknown'|'unavailable'|'unrecognized'|'partial'|'observed';names:number;links:number;missingGroups:number;limited:boolean;namesOmitted:boolean;inventoryCollected:boolean};
export function summarizeLocalDiagnostics(inspections:Partial<Record<InspectionGameId,FolderInspection>>):{rows:LocalDiagnosticRow[];observedGames:number;attentionGames:number;contentVerified:false;compatibilityVerified:false;operationsEnabled:false};
