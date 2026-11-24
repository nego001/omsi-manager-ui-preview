'use strict';
// Test-only diagnostic layer. Calls the resolver itself rather than accepting
// an externally supplied verdict. No filesystem, UI, IPC or operation access.
const {resolveSyntheticReferences}=require('./m81d-virtual-reference-resolution.cjs');
const rules=Object.freeze([
 ['invalid-reference','high','Referência inválida','O caminho ou formato não pertence ao subconjunto permitido. Não tente resolver automaticamente.'],
 ['ambiguous-case','high','Nomes ambíguos','Há mais de um nome equivalente no inventário fictício. Não escolha automaticamente.'],
 ['not-file-path','high','Tipo de entrada divergente','A referência aponta para uma estrutura que não corresponde a um arquivo no teste.'],
 ['absent-from-fixture','high','Ausente no inventário fictício','A referência não aparece no inventário sintético declarado completo. Isso não comprova ausência no jogo real.'],
 ['case-only','review','Diferença de maiúsculas e minúsculas','Foi observada uma grafia diferente; a resolução real depende do ambiente.'],
 ['source-unconfirmed','review','Origem não confirmada','A origem da referência não foi encontrada com identidade nominal exata no teste.'],
 ['not-observed','review','Referência não observada','O inventário fictício é incompleto. Não há evidência suficiente para declarar ausência.'],
 ['unsupported-reference','review','Regra ainda não suportada','O tipo de referência não foi avaliado; não é uma falha comprovada do mod.'],
 ['exact','info','Nome observado','O nome corresponde ao inventário fictício; conteúdo e compatibilidade não foram verificados.']
].map(row=>Object.freeze(row)));
function diagnoseSyntheticDependencies(fixture){
 const resolved=resolveSyntheticReferences(fixture);
 const known=new Set(rules.map(row=>row[0]));
 if(resolved.results.some(s=>!known.has(s)))throw Error('M82_UNKNOWN_RESOLUTION');
 const items=rules.filter(([code])=>resolved.counts[code]>0)
  .map(([code,priority,title,description])=>({code,priority,title,description,count:resolved.counts[code]}));
 const counts={high:0,review:0,info:0};
 for(const item of items)counts[item.priority]+=item.count;
 let state;
 if(!resolved.results.length)state='no-reference-evidence';
 else if(counts.high)state='fixture-findings';
 else if(!resolved.complete||counts.review)state='review-required';
 else state='observed-exact-only';
 return {source:'synthetic-dependency-diagnostics',state,inventoryComplete:resolved.complete,
  totalReferences:resolved.results.length,counts,items,
  limitations:['Somente dados fictícios.','Inventário e regras limitados; a ausência de avisos não demonstra compatibilidade.','Nenhum conteúdo de mod real analisado.'],
  realFilesInspected:false,compatibilityVerified:false,operationsEnabled:false};
}
module.exports={diagnoseSyntheticDependencies};
