// A catalog-only signal. These are NOT compatibility or installation findings.
import type {CatalogMod} from './catalog';
import {analyzeModRelations} from './relation-analysis';

export type DeclaredStatusKind='blocking'|'attention'|'no-issues';
export type DeclaredStatus={
 kind:DeclaredStatusKind;
 label:string;
 blockers:number;
 notices:number;
 issueCount:number;
 // Permanent guardrail: absence of declared issues NEVER proves compatibility.
 compatibilityVerified:false;
 installationVerified:false;
};
export function summarizeDeclaredStatus(catalog:readonly CatalogMod[],modId:string):DeclaredStatus{
 const result=analyzeModRelations(catalog,modId);
 const blockers=result.issues.filter(x=>x.severity==='blocking').length;
 const notices=result.issues.filter(x=>x.severity==='notice').length;
 const kind:DeclaredStatusKind=blockers?'blocking':notices?'attention':'no-issues';
 const label=kind==='blocking'?'Bloqueios declarados':
   kind==='attention'?'Avisos declarados':'Sem alertas declarados';
 return {kind,label,blockers,notices,issueCount:result.issues.length,
  compatibilityVerified:false,installationVerified:false};
}
