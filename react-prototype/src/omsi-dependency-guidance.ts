import {projectDependencyObservation,type DependencyStatus} from './omsi-dependency-report';
// Fixed, non-executable guidance. Counts are occurrences, not unique files.
const advice:Record<DependencyStatus,{priority:'review'|'attention'|'information',title:string,detail:string}>={
 'exact-observed':{priority:'information',title:'Nome observado',detail:'A grafia corresponde à entrada observada. Conteúdo, integridade e compatibilidade não verificados.'},
 'case-only-observed':{priority:'attention',title:'Conferir maiúsculas e minúsculas',detail:'Compare a grafia da referência com o nome original. Sistemas de arquivos sensíveis à caixa podem distinguir os nomes.'},
 'ambiguous-case':{priority:'review',title:'Conferir nomes ambíguos',detail:'Mais de uma entrada corresponde sem distinguir maiúsculas de minúsculas. Identifique manualmente a referência pretendida.'},
 'invalid-reference':{priority:'review',title:'Revisar referência não admitida',detail:'A referência está fora do subconjunto aceito pelo leitor. Isso não confirma que seja inválida no OMSI. Confira a documentação do conteúdo.'},
 'not-observed-in-directory':{priority:'review',title:'Conferir origem da dependência',detail:'A entrada não foi localizada na busca concluída daquele diretório. Confira a pasta e as dependências declaradas pelo autor; não presume ausência no jogo inteiro.'},
 'not-regular-path':{priority:'review',title:'Conferir tipo de entrada',detail:'O caminho não atende ao contrato de arquivo regular único. Não substitua, exclua ou converta entradas automaticamente.'},
 'link-refused':{priority:'review',title:'Link não examinado',detail:'O leitor não segue esse link. A existência ou validade do destino não foi determinada.'},
 'budget-limited':{priority:'attention',title:'Busca parcial',detail:'O limite de entradas foi atingido. As referências não examinadas permanecem desconhecidas, não ausentes.'},
 'unresolved-argument':{priority:'attention',title:'Argumento inconclusivo',detail:'A próxima linha não foi interpretada segundo o subconjunto de marcadores. Consulte a configuração original sem assumir ausência.'}
};
const rank={review:0,attention:1,information:2} as const;
export function dependencyReviewGuidance(raw:unknown){
 const report=projectDependencyObservation(raw);
 if(!report)return null;
 const items=report.rows.filter(row=>row.count>0).map(row=>Object.freeze({status:row.status,count:row.count,...advice[row.status]}))
  .sort((a,b)=>rank[a.priority]-rank[b.priority]);
 const coverage=report.budgetLimited||report.unexaminedKnownMarkers>0?'partial-observation':
  report.referenceOccurrences===0?'no-reference-evidence':'limited-scope-observation';
 const conclusion=report.referenceOccurrences===0?'Sem evidência suficiente para concluir.':
  coverage==='partial-observation'?'Parte do diagnóstico permanece inconclusiva.':
  items.some(i=>i.priority!=='information')?'Existem observações que exigem revisão manual.':'Somente nomes exatos observados; não é validação de compatibilidade.';
 return Object.freeze({conclusion,coverage,items:Object.freeze(items),
  unexaminedKnownMarkers:report.unexaminedKnownMarkers,referenceOccurrences:report.referenceOccurrences,
  notice:'As contagens representam ocorrências, não arquivos únicos. Nenhuma correção foi executada.',
  actualGameInspection:false,compatibilityVerified:false,automaticRepairAllowed:false,operationsEnabled:false});
}
