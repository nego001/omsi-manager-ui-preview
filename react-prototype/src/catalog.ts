// Estritamente dados de catálogo: sem paths, URLs, scripts, IPC ou operações em arquivos do jogo.
export type GameId='omsi'|'ets2'|'ats';
export type ModCategory='Ônibus'|'Mapas'|'Caminhões'|'Sons'|'Gráficos';
export type CatalogMod={
 id:string; title:string; game:GameId; category:ModCategory;
 version:string; description:string; size:string; safe:true;
};
const GAME_IDS:ReadonlySet<string>=new Set(['omsi','ets2','ats']);
const CATEGORY_IDS:ReadonlySet<string>=new Set(['Ônibus','Mapas','Caminhões','Sons','Gráficos']);
export const MAX_CATALOG_BYTES=1_000_000;
export const MAX_CATALOG_MODS=200;
function nonEmptyText(v:unknown,label:string,max:number){
 if(typeof v!=='string'||v.trim().length<1||v.trim().length>max||/[\u0000-\u001f\u007f]/.test(v))
  throw new Error(`Campo "${label}" inválido (1 a ${max} caracteres, sem controles).`);
 return v.trim();
}
export function parseCatalogManifest(raw:string):CatalogMod[]{
 // This parser accepts only metadata. It never interprets content as commands or filesystem paths.
 if(new TextEncoder().encode(raw).length>MAX_CATALOG_BYTES)
  throw new Error('Catálogo excede o limite de 1 MB.');
 let input:unknown;
 try{input=JSON.parse(raw)}catch{throw new Error('Arquivo JSON inválido.');}
 if(!input||typeof input!=='object'||Array.isArray(input))
  throw new Error('Catálogo deve ser um objeto JSON.');
 const document=input as Record<string,unknown>;
 if(document.schemaVersion!==1)throw new Error('Versão do catálogo incompatível (esperado schemaVersion: 1).');
 if(!Array.isArray(document.mods)||document.mods.length===0||document.mods.length>MAX_CATALOG_MODS)
  throw new Error('Catálogo precisa conter entre 1 e 200 mods.');
 const seen=new Set<string>();
 return document.mods.map((value:unknown,index:number):CatalogMod=>{
  if(!value||typeof value!=='object'||Array.isArray(value))
   throw new Error(`Mod ${index+1}: registro inválido.`);
  const m=value as Record<string,unknown>;
  const id=nonEmptyText(m.id,`mods[${index}].id`,64);
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(id))throw new Error(`Mod ${index+1}: id deve ser minúsculo e usar apenas letras, números, _ e -.`);
  if(seen.has(id))throw new Error(`ID duplicado: ${id}`);
  seen.add(id);
  if(!GAME_IDS.has(String(m.game)))throw new Error(`Mod ${id}: jogo incompatível.`);
  if(!CATEGORY_IDS.has(String(m.category)))throw new Error(`Mod ${id}: categoria incompatível.`);
  // Explicitly reject fields that could suggest paths, URLs, commands, or installer operations.
  const allowed=new Set(['id','title','game','category','version','description','size']);
  for(const key of Object.keys(m))if(!allowed.has(key))throw new Error(`Mod ${id}: campo não permitido: ${key.slice(0,60)}`);
  return {
   id,
   game:m.game as GameId,
   category:m.category as ModCategory,
   title:nonEmptyText(m.title,`mods[${index}].title`,100),
   version:nonEmptyText(m.version,`mods[${index}].version`,32),
   description:nonEmptyText(m.description,`mods[${index}].description`,700),
   size:nonEmptyText(m.size,`mods[${index}].size`,24),
   safe:true
  };
 });
}
