// Library-only ranking of user-supplied DECLARED sizes. This never performs
// filesystem inspection, install planning, disk accounting or downloads.
import type {CatalogMod} from './catalog';

type SizeMod=Pick<CatalogMod,'id'|'title'|'size'>;
const units:Record<string,number>={
 B:1,KB:1000,MB:1000**2,GB:1000**3,TB:1000**4,
 KIB:1024,MIB:1024**2,GIB:1024**3,TIB:1024**4
};
export function declaredSizeBytes(value:string):number|null{
 if(typeof value!=='string'||value.length>24)return null;
 const match=/^(0|[1-9]\d{0,8})(?:[,.](\d{1,3}))?\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)$/i.exec(value.trim());
 if(!match)return null;
 const quantity=Number(match[1]+(match[2]?'.'+match[2]:''));
 const bytes=quantity*units[match[3].toUpperCase()];
 return Number.isSafeInteger(bytes)&&bytes>=0?bytes:null;
}
export function compareModsByDeclaredSize(a:SizeMod,b:SizeMod,direction:'asc'|'desc'):number{
 const aBytes=declaredSizeBytes(a.size),bBytes=declaredSizeBytes(b.size);
 // Unparseable declarations are kept at the end, not guessed as zero bytes.
 if(aBytes===null&&bBytes!==null)return 1;
 if(aBytes!==null&&bBytes===null)return -1;
 if(aBytes!==null&&bBytes!==null&&aBytes!==bBytes)
  return direction==='asc'?aBytes-bBytes:bBytes-aBytes;
 return a.title.localeCompare(b.title,'pt-BR')||a.id.localeCompare(b.id);
}
