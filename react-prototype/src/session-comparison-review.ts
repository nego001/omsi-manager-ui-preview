// Read-only validation of previously exported *comparison* JSON.
// Never turns a comparison into an installation, activity or session report.
export const MAX_COMPARISON_REVIEW_BYTES=131072;
type Mod={id:string;title:string};
type Delta={before:number;after:number;delta:number};
export type ReviewedComparisonFile={
 kind:'comparison';
 source:'session-memory'|'external-json-unverified';
 beforeReportId:number;
 afterReportId:number;
 addedSelectedMods:Mod[];
 removedSelectedMods:Mod[];
 unchangedSelectedCount:number;
 declaredBlockers:Delta;
 declaredWarnings:Delta;
 sourceAuthenticated:false;
 chronologicalOrderVerified:false;
 installationVerified:false;
 compatibilityVerified:false;
};
const SESSION_SCHEMA='omsi-manager-declared-comparison-v1';
const EXTERNAL_SCHEMA='omsi-manager-external-declared-comparison-v1';
const SESSION_DISCLAIMER='Diferenças entre seleções de metadados declarados. Não atesta instalação, atualização, integridade ou compatibilidade real.';
const EXTERNAL_DISCLAIMER='Comparação de metadados JSON externos não autenticados. Não atesta ordem cronológica, instalação, atualização ou compatibilidade.';
function fail():never{throw Error('COMPARISON_REVIEW_INVALID');}
function record(value:unknown):Record<string,unknown>{
 if(value===null||typeof value!=='object'||Array.isArray(value))return fail();
 return value as Record<string,unknown>;
}
function exactKeys(item:Record<string,unknown>,keys:readonly string[]):void{
 if(Object.keys(item).length!==keys.length||keys.some(k=>!Object.hasOwn(item,k)))fail();
}
function safeInt(v:unknown,min=0):number{
 if(typeof v!=='number'||!Number.isSafeInteger(v)||v<min)fail();
 return v;
}
function mods(value:unknown):Mod[]{
 if(!Array.isArray(value)||value.length>500)fail();
 const seen=new Set<string>();
 return value.map(entry=>{
  const mod=record(entry);
  exactKeys(mod,['id','title']);
  const id=mod.id,title=mod.title;
  if(typeof id!=='string'||!id.trim()||id.length>240||
   typeof title!=='string'||!title.trim()||title.length>300||seen.has(id))fail();
  seen.add(id);
  return {id,title};
 });
}
function delta(value:unknown):Delta{
 const v=record(value);
 exactKeys(v,['before','after','delta']);
 const before=safeInt(v.before),after=safeInt(v.after);
 if(!Number.isSafeInteger(after-before)||v.delta!==after-before)fail();
 return {before,after,delta:after-before};
}
export function parseDeclaredComparisonReview(raw:string):ReviewedComparisonFile{
 if(typeof raw!=='string'||new TextEncoder().encode(raw).byteLength>MAX_COMPARISON_REVIEW_BYTES)
  throw Error('COMPARISON_REVIEW_TOO_LARGE');
 let parsed:unknown;
 try{parsed=JSON.parse(raw);}catch{throw Error('COMPARISON_REVIEW_INVALID_JSON');}
 const v=record(parsed);
 const session=v.schema===SESSION_SCHEMA,external=v.schema===EXTERNAL_SCHEMA;
 if(!session&&!external)throw Error('COMPARISON_REVIEW_UNSUPPORTED_SCHEMA');
 const shared=['schema','source','scope','beforeReportId','afterReportId',
  'addedSelectedMods','removedSelectedMods','unchangedSelectedCount',
  'declaredBlockers','declaredWarnings','installationVerified','compatibilityVerified','disclaimer'];
 exactKeys(v,external?[...shared,'sourceAuthenticated','chronologicalOrderVerified']:shared);
 if(v.source!==(external?'external-json-unverified':'session-memory')||
  v.scope!=='catalog-metadata-only'||v.installationVerified!==false||
  v.compatibilityVerified!==false||
  v.disclaimer!==(external?EXTERNAL_DISCLAIMER:SESSION_DISCLAIMER))fail();
 if(external&&(v.sourceAuthenticated!==false||v.chronologicalOrderVerified!==false))fail();
 const beforeReportId=safeInt(v.beforeReportId,1),afterReportId=safeInt(v.afterReportId,1);
 if(beforeReportId===afterReportId)fail();
 const addedSelectedMods=mods(v.addedSelectedMods),removedSelectedMods=mods(v.removedSelectedMods);
 const unchangedSelectedCount=safeInt(v.unchangedSelectedCount);
 if(unchangedSelectedCount+addedSelectedMods.length>500||
  unchangedSelectedCount+removedSelectedMods.length>500)fail();
 const addedIds=new Set(addedSelectedMods.map(m=>m.id));
 if(removedSelectedMods.some(m=>addedIds.has(m.id)))fail();
 return {
  kind:'comparison',source:external?'external-json-unverified':'session-memory',
  beforeReportId,afterReportId,addedSelectedMods,removedSelectedMods,
  unchangedSelectedCount,declaredBlockers:delta(v.declaredBlockers),
  declaredWarnings:delta(v.declaredWarnings),
  sourceAuthenticated:false,chronologicalOrderVerified:false,
  installationVerified:false,compatibilityVerified:false
 };
}
