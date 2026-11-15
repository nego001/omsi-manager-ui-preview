import type {CatalogMod} from './catalog';

// Two validated metadata catalogs, never an installed-mod inventory.
// IDs identify declarations within one catalog only. They are not proof
// of identity, authorship, compatibility or equivalence of mod packages.
export type DeclaredCatalogField=
 'title'|'game'|'category'|'version'|'description'|'size'|
 'requires'|'conflictsWith'|'gameVersionRange'|'requiresMinVersions';
export type DeclaredCatalogChange={
 id:string;oldTitle:string;newTitle:string;fields:readonly DeclaredCatalogField[];
};
export type DeclaredCatalogDiff={
 unchanged:number;
 changed:readonly DeclaredCatalogChange[];
 removed:readonly {id:string;title:string}[];
 added:readonly {id:string;title:string}[];
};
export const declaredCatalogFieldLabels:Record<DeclaredCatalogField,string>={
 title:'nome',game:'jogo',category:'categoria',version:'versão',
 description:'descrição',size:'tamanho declarado',
 requires:'dependências declaradas',conflictsWith:'conflitos declarados',
 gameVersionRange:'faixa de versões do jogo',
 requiresMinVersions:'versões mínimas das dependências'
};
const fields:readonly DeclaredCatalogField[]=[
 'title','game','category','version','description','size','requires',
 'conflictsWith','gameVersionRange','requiresMinVersions'
];
function normalized(mod:CatalogMod,field:DeclaredCatalogField):string{
 const value=mod[field];
 if(field==='requires'||field==='conflictsWith')
  return JSON.stringify([...((value as string[] | undefined) ?? [])].sort());
 if(field==='requiresMinVersions')
  return JSON.stringify([...(mod.requiresMinVersions??[])]
   .map(v=>({id:v.id,minVersion:v.minVersion}))
   .sort((a,b)=>a.id.localeCompare(b.id)));
 if(field==='gameVersionRange')
  return JSON.stringify({min:mod.gameVersionRange?.min??null,max:mod.gameVersionRange?.max??null});
 return JSON.stringify(value??null);
}
export function compareDeclaredCatalogs(current:readonly CatalogMod[],
 proposed:readonly CatalogMod[]):DeclaredCatalogDiff{
 if(!Array.isArray(current)||!Array.isArray(proposed)||
  current.length<1||current.length>200||proposed.length<1||proposed.length>200)
  throw Error('DECLARED_CATALOG_COMPARISON_INVALID');
 function index(source:readonly CatalogMod[]){
  const map=new Map<string,CatalogMod>();
  for(const mod of source){
   if(!mod||typeof mod.id!=='string'||!mod.id||
    map.has(mod.id))throw Error('DECLARED_CATALOG_COMPARISON_INVALID');
   map.set(mod.id,mod);
  }
  return map;
 }
 const from=index(current),to=index(proposed);
 const changed:DeclaredCatalogChange[]=[];
 const removed:{id:string;title:string}[]=[];
 const added:{id:string;title:string}[]=[];
 let unchanged=0;
 for(const oldMod of current){
  const nextMod=to.get(oldMod.id);
  if(!nextMod){removed.push({id:oldMod.id,title:oldMod.title});continue;}
  const differences=fields.filter(field=>normalized(oldMod,field)!==normalized(nextMod,field));
  if(differences.length===0)unchanged++;
  else changed.push({
   id:oldMod.id,oldTitle:oldMod.title,newTitle:nextMod.title,fields:differences
  });
 }
 for(const mod of proposed){
  if(!from.has(mod.id))added.push({id:mod.id,title:mod.title});
 }
 return {unchanged,changed,removed,added};
}
