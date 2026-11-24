export const dependencyStatuses:readonly ['exact-observed','case-only-observed','ambiguous-case','invalid-reference','not-observed-in-directory','not-regular-path','link-refused','budget-limited','unresolved-argument'];
export const dependencyFlags:readonly ['dependencyContentsRead','fullGrammarVerified','compatibilityVerified','atomicContainmentVerified','nativeIdentityVerified','realModValidated','operationsEnabled'];
export const encodings:readonly ['utf-8','windows-1250','windows-1251','windows-1252'];
export type DependencyObservation=Readonly<{
 schema:'omsi-m104-dependency-observation-v1';scope:'bounded-selected-directory-candidate';
 role:'vehicle-definition'|'vehicle-model';encoding:typeof encodings[number];referenceKind:'model'|'mesh';
 referenceOccurrences:number;unexaminedKnownMarkers:number;entriesScanned:number;entryBudget:4096;
 counts:Readonly<Record<typeof dependencyStatuses[number],number>>;budgetLimited:boolean;
}&Record<typeof dependencyFlags[number],false>>;
export function validateDependencyObservation(raw:unknown):DependencyObservation|null;
