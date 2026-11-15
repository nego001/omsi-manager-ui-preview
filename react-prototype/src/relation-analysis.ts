import type {CatalogMod} from './catalog';
import {compareNumericVersions,validNumericVersion} from './version-requirements';

export type RelationIssue={
 code:'dependency-missing'|'different-game'|'dependency-cycle'|'conflict-in-plan'|'declared-conflict'|'unknown-conflict'|'dependency-version-too-low'|'dependency-version-unknown'|'game-version-unknown'|'game-version-invalid'|'game-version-outside-range';
 severity:'blocking'|'notice';
 message:string;
};
export type RelationAnalysis={
 sequence:CatalogMod[];
 issues:RelationIssue[];
 logicalBlockers:boolean;
 realInstallationVerified:false;
};
export function analyzeModRelations(catalog:readonly CatalogMod[],selectedId:string,assumedGameVersion=''):RelationAnalysis{
 const byId=new Map(catalog.map(mod=>[mod.id,mod]));
 const target=byId.get(selectedId);
 if(!target)throw new Error('Mod não encontrado no catálogo.');
 const targetGame=target.game;
 const sequence:CatalogMod[]=[];
 const issues:RelationIssue[]=[];
 const knownIssues=new Set<string>();
 const state=new Map<string,'visiting'|'visited'>();
 const stack:string[]=[];
 const push=(code:RelationIssue['code'],severity:RelationIssue['severity'],message:string,key:string)=>{
  const signature=code+':'+key;
  if(!knownIssues.has(signature)){
   knownIssues.add(signature);
   issues.push({code,severity,message});
  }
 };
 function visit(mod:CatalogMod):void{
  const status=state.get(mod.id);
  if(status==='visited')return;
  if(status==='visiting'){
   const cycle=stack.slice(stack.indexOf(mod.id)).concat(mod.id);
   push('dependency-cycle','blocking','Dependência circular: '+cycle.join(' → ')+'.',cycle.join(':'));
   return;
  }
  state.set(mod.id,'visiting');
  stack.push(mod.id);
  for(const id of mod.requires??[]){
   const required=byId.get(id);
   if(!required){
    push('dependency-missing','blocking',mod.title+' exige um ID ausente: '+id+'.',mod.id+':'+id);
   } else if(required.game!==targetGame){
    push('different-game','blocking',mod.title+' exige '+required.title+', que pertence a outro jogo.',mod.id+':'+id);
   } else visit(required);
  }
  stack.pop();
  state.set(mod.id,'visited');
  sequence.push(mod);
 }
 visit(target);
 const selectedIds=new Set(sequence.map(mod=>mod.id));
 const suppliedVersion=assumedGameVersion.trim();
 for(const mod of sequence){
  const range=mod.gameVersionRange;
  if(range&&(range.min||range.max)){
   if(!suppliedVersion){
    push('game-version-unknown','notice',mod.title+' declara uma faixa de versão do jogo, mas nenhuma versão hipotética foi informada.',mod.id);
   }else if(!validNumericVersion(suppliedVersion)){
    push('game-version-invalid','notice','Versão informada não é numérica no formato aceito (ex.: 1.52.0).','input');
   }else if((range.min&&compareNumericVersions(suppliedVersion,range.min)===-1)||(range.max&&compareNumericVersions(suppliedVersion,range.max)===1)){
    push('game-version-outside-range','blocking',mod.title+' declara faixa '+(range.min??'sem mínimo')+' a '+(range.max??'sem máximo')+'; versão hipotética '+suppliedVersion+' fica fora dela.',mod.id);
   }
  }
  for(const entry of mod.requiresMinVersions??[]){
   const required=byId.get(entry.id);
   if(!required||required.game!==targetGame)continue; // Already covered by relation errors.
   const cmp=compareNumericVersions(required.version,entry.minVersion);
   if(cmp===null){
    push('dependency-version-unknown','notice',mod.title+' exige '+required.title+' a partir de '+entry.minVersion+', mas a versão declarada ('+required.version+') não pode ser comparada numericamente.',mod.id+':'+entry.id);
   }else if(cmp===-1){
    push('dependency-version-too-low','blocking',mod.title+' exige '+required.title+' a partir de '+entry.minVersion+', mas o catálogo declara '+required.version+'.',mod.id+':'+entry.id);
   }
  }
 }
 for(const mod of sequence){
  for(const otherId of mod.conflictsWith??[]){
   const other=byId.get(otherId);
   if(!other){
    push('unknown-conflict','notice',mod.title+' declara um conflito com ID ausente: '+otherId+'.',mod.id+':'+otherId);
   } else if(selectedIds.has(otherId)){
    push('conflict-in-plan','blocking',mod.title+' declara conflito com '+other.title+', incluído na mesma sequência.',mod.id+':'+otherId);
   } else if(other.game===targetGame){
    push('declared-conflict','notice',mod.title+' declara conflito com '+other.title+'. Não verificamos se está instalado ou ativo.',mod.id+':'+otherId);
   } else {
    push('unknown-conflict','notice',mod.title+' declara conflito com um registro de outro jogo: '+other.title+'.',mod.id+':'+otherId);
   }
  }
 }
 return {
  sequence,
  issues,
  logicalBlockers:issues.some(issue=>issue.severity==='blocking'),
  realInstallationVerified:false
 };
}
