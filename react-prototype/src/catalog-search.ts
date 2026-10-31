// Pure catalog-metadata search. Never reads archives, filesystem paths,
// game installations, network resources, or binary mod content.
import type {CatalogMod} from './catalog';

// Search is intentionally a presentation filter only; it is not mod
// classification, evidence, compatibility assessment or installation status.
export function normalizeCatalogSearch(value:string):string{
 return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('pt-BR').trim().replace(/\s+/gu,' ');
}

export function matchesCatalogSearch(
 mod:Pick<CatalogMod,'title'|'category'>,
 gameTitle:string,
 query:string
):boolean{
 const terms=normalizeCatalogSearch(query);
 if(!terms)return true;
 const haystack=normalizeCatalogSearch(
  [mod.title,mod.category,gameTitle].join(' ')
 );
 // Independent terms tolerate reordered words without losing game/category.
 return terms.split(' ').every(term=>haystack.includes(term));
}
