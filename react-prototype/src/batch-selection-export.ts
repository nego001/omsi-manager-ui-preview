import type {CatalogMod} from './catalog';

// Snapshot of a user's current metadata-only batch choice. Intentionally not
// a catalog manifest, an installation instruction, or a restorable session.
type SelectedCatalogMod=Pick<CatalogMod,'id'|'title'|'game'|'category'|'version'>;
const games=new Set(['omsi','ets2','ats']);
const categories=new Set(['Ônibus','Mapas','Caminhões','Sons','Gráficos']);
const identifier=/^[a-z0-9][a-z0-9_-]*$/;

export function serializeDeclaredBatchSelection(selected:readonly SelectedCatalogMod[]):string{
 if(!Array.isArray(selected)||selected.length===0||selected.length>200)
  throw Error('DECLARED_SELECTION_INVALID');
 const seen=new Set<string>();
 const items=selected.map(mod=>{
  if(!mod||typeof mod!=='object'||
   typeof mod.id!=='string'||mod.id.length>64||!identifier.test(mod.id)||
   seen.has(mod.id)||
   typeof mod.title!=='string'||!mod.title.trim()||mod.title.length>160||
   !games.has(mod.game)||!categories.has(mod.category)||
   typeof mod.version!=='string'||!mod.version.trim()||mod.version.length>64)
   throw Error('DECLARED_SELECTION_INVALID');
  seen.add(mod.id);
  return {id:mod.id,title:mod.title,game:mod.game,category:mod.category,version:mod.version};
 });
 const output={
  schema:'omsi-manager-declared-batch-selection-v1',
  source:'catalog-declarations',
  scope:'active-selection-metadata-only',
  selectedCount:items.length,
  selectedMods:items,
  installationVerified:false,
  compatibilityVerified:false,
  restorableByPreview:false,
  disclaimer:'Seleção declarativa para consulta. Não restaura a sessão nem comprova instalação ou compatibilidade.'
 };
 const json=JSON.stringify(output,null,2)+'\n';
 if(new TextEncoder().encode(json).byteLength>131072)
  throw Error('DECLARED_SELECTION_TOO_LARGE');
 return json;
}
