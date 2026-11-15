// Explanatory links between DECLARED changes and likely synthetic specialist scopes.
// No names, paths, digest, bytes, verified causation or file access ever leave this projection.
import {SYNTHETIC_MODULE_IDS,type SyntheticModuleId} from './distributed-reader-contract';
import {
 compareSyntheticIndexDeclarations,
 type SyntheticPackageIndex,type SyntheticSuffix,type SyntheticIndexDelta
} from './synthetic-package-index';
import {affectedSyntheticModulesForDeclaration} from './synthetic-index-revalidation';
type Specialist=Exclude<SyntheticModuleId,'container'>;
type DeclaredAction='added'|'removed'|'modified';
export type SyntheticDeclaredChangeGroup=Readonly<{
 action:DeclaredAction;suffix:SyntheticSuffix;kind:'file'|'directory';
 declarations:number;specialists:readonly Specialist[];
 description:string;
 relation:'declared-scope-hint';causationVerified:false;actualContentVerified:false;operationsEnabled:false;
}>;
export type SyntheticChangeExplanation=Readonly<{
 source:'synthetic-fixture';schemaVersion:1;
 groups:readonly SyntheticDeclaredChangeGroup[];
 counts:Readonly<{added:number;removed:number;modified:number}>;
 sameDeclaredDigest:boolean;declaredStructureChanged:boolean;
 affectedSpecialists:readonly Specialist[];
 mustRecheckSpecialists:readonly Specialist[];
 context:'declared-change'|'digest-only'|'no-declared-difference';
 note:string;
 pathsExposed:false;digestVerified:false;causationVerified:false;
 actualContentVerified:false;previousEvidenceReusable:false;operationsEnabled:false;
}>;
const specialistIds=SYNTHETIC_MODULE_IDS.filter((id):id is Specialist=>id!=='container');
const suffixNames:Readonly<Record<SyntheticSuffix,string>>={
 scs:'pacote SCS',zip:'arquivo ZIP',bus:'configuração de veículo BUS',
 cfg:'configuração CFG',sco:'objeto de cenário SCO',sli:'trajeto de spline SLI',
 sii:'definição SII',dds:'textura DDS',png:'imagem PNG',jpg:'imagem JPG',
 wav:'som WAV',ogg:'som OGG',bank:'banco de áudio BANK',
 json:'manifesto JSON',unknown:'formato não classificado'
};
const actionNames:Readonly<Record<DeclaredAction,string>>={
 added:'incluída',removed:'retirada',modified:'modificada'
};
function summarize(delta:SyntheticIndexDelta):SyntheticChangeExplanation{
 const grouped=new Map<string,{
  action:DeclaredAction;suffix:SyntheticSuffix;kind:'file'|'directory';declarations:number
 }>();
 for(const item of delta.changes){
  // Root and private canonical filename are NOT exposed to the explanatory UI.
  const key=item.change+'|'+item.suffix+'|'+item.kind;
  const current=grouped.get(key);
  if(current)current.declarations+=1;
  else grouped.set(key,{action:item.change,suffix:item.suffix,kind:item.kind,declarations:1});
 }
 // Stable presentation independent of fixture path ordering: removed, modified, added;
 // within each category, sort by format and directory/file hint.
 const actionOrder:Readonly<Record<DeclaredAction,number>>={removed:0,modified:1,added:2};
 const ordered=[...grouped.values()].sort((a,b)=>actionOrder[a.action]-actionOrder[b.action]||
  a.suffix.localeCompare(b.suffix)||a.kind.localeCompare(b.kind));
 const groups=Object.freeze(ordered.map(item=>{
  const potentiallyAffected=new Set(affectedSyntheticModulesForDeclaration(item.suffix,item.kind));
  const specialists=Object.freeze(specialistIds.filter(id=>potentiallyAffected.has(id)));
  const label=item.kind==='directory'?'declaração de pasta':'declaração de '+suffixNames[item.suffix];
  return Object.freeze({
   ...item,specialists,
   description:label+' '+actionNames[item.action]+' no índice fictício. Indica somente áreas que podem precisar de conferência, não uma causa comprovada.',
   relation:'declared-scope-hint' as const,causationVerified:false as const,
   actualContentVerified:false as const,operationsEnabled:false as const
  });
 }));
 const touched=new Set(groups.flatMap(group=>group.specialists));
 const affectedSpecialists=Object.freeze(specialistIds.filter(id=>
  !delta.sameDeclaredDigest||touched.has(id)
 ));
 const context=groups.length?'declared-change' as const:
  !delta.sameDeclaredDigest?'digest-only' as const:'no-declared-difference' as const;
 const note=context==='declared-change'?
  'Relação indicativa entre tipos declarados de arquivo e módulos de análise. Não comprova causalidade, integridade ou defeito.':
  context==='digest-only'?
  'Somente o identificador fornecido pelo fixture mudou. Sem diferença estrutural declarada; todos os especialistas exigem nova análise.':
  'Nenhuma diferença declarada foi encontrada. Isso não significa igualdade dos bytes nem permite reutilizar evidências.';
 return Object.freeze({
  source:'synthetic-fixture' as const,schemaVersion:1 as const,
  groups,counts:Object.freeze({added:delta.added,removed:delta.removed,modified:delta.modified}),
  sameDeclaredDigest:delta.sameDeclaredDigest,
  declaredStructureChanged:delta.declaredStructureChanged,affectedSpecialists,
  mustRecheckSpecialists:Object.freeze([...specialistIds]),context,note,
  pathsExposed:false as const,digestVerified:false as const,causationVerified:false as const,
  actualContentVerified:false as const,previousEvidenceReusable:false as const,
  operationsEnabled:false as const
 });
}
export function explainSyntheticDeclaredChanges(
 previous:SyntheticPackageIndex,next:SyntheticPackageIndex
):SyntheticChangeExplanation{
 if(previous===next)throw Error('Explicação requer dois índices sintéticos distintos.');
 const delta=compareSyntheticIndexDeclarations(previous,next);
 if(delta.status!=='compared')throw Error('Índice sintético não emitido pelo gate.');
 return summarize(delta);
}
