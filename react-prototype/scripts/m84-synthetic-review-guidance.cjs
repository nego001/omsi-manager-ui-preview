'use strict';
// Advisory-only synthetic fixture workflow. No path, command, URL,
// executable action, real repair or permission is generated.
const {createSyntheticDiagnosticReport}=require('./m83-synthetic-diagnostic-report.cjs');
const guidance=Object.freeze({
 'invalid-reference':Object.freeze(['review-reference-syntax','Conferir a sintaxe da referência','Comparar a extensão e o formato com a documentação do mod; caminhos não permitidos exigem revisão manual.']),
 'ambiguous-case':Object.freeze(['review-name-collision','Conferir nomes ambíguos','Comparar os nomes conflitantes com a distribuição original e confirmar qual recurso foi declarado. Não escolher automaticamente.']),
 'not-file-path':Object.freeze(['review-entry-type','Conferir o tipo da entrada','Verificar na documentação se a referência deveria apontar para um arquivo ou outra estrutura.']),
 'absent-from-fixture':Object.freeze(['review-original-package','Conferir a distribuição original','Consultar a lista de arquivos e dependências do pacote original. A ausência fictícia não comprova ausência no jogo real.']),
 'case-only':Object.freeze(['review-case-spelling','Conferir maiúsculas e minúsculas','Comparar a grafia declarada com a grafia distribuída, considerando as regras do ambiente. Não renomear automaticamente.']),
 'source-unconfirmed':Object.freeze(['review-source','Confirmar a origem','Conferir primeiro a origem da referência, antes de tirar conclusões sobre seu destino.']),
 'not-observed':Object.freeze(['review-inventory-coverage','Conferir a cobertura do inventário','Obter evidência suficiente em uma futura inspeção autorizada; não classificar como ausente.']),
 'unsupported-reference':Object.freeze(['review-format-documentation','Consultar a documentação do formato','A regra não está implementada. Não tentar adivinhar o caminho nem indicar instalação.'])
});
function createSyntheticReviewGuidance(fixture){
 const report=createSyntheticDiagnosticReport(fixture);
 const items=[];
 for(const finding of report.findings){
  if(finding.code==='exact')continue;
  if(!Object.hasOwn(guidance,finding.code))throw Error('M84_UNKNOWN_FINDING');
  const [id,title,description]=guidance[finding.code];
  items.push({id,findingCode:finding.code,priority:finding.priority,
   referenceOccurrences:finding.count,title,description,manualReviewOnly:true});
 }
 const prerequisites=[];
 if(!report.inventoryComplete)prerequisites.push('inventory-incomplete');
 if(report.totalReferences===0)prerequisites.push('no-reference-evidence');
 if(report.findings.some(f=>f.code==='source-unconfirmed'))prerequisites.push('source-unconfirmed');
 if(report.findings.some(f=>f.code==='unsupported-reference'))prerequisites.push('unsupported-format');
 return {schema:'omsi-manager-synthetic-review-guidance-v1',scope:'synthetic-virtual-inventory-only',
  state:report.state,inventoryComplete:report.inventoryComplete,
  totalReferences:report.totalReferences,reviewOccurrences:report.counts.high+report.counts.review,
  prerequisites,items,
  note:'Orientações de conferência apenas para cenários fictícios. Nenhuma correção foi aplicada ou autorizada.',
  realFilesInspected:false,compatibilityVerified:false,repairAllowed:false,operationsEnabled:false};
}
module.exports={createSyntheticReviewGuidance};
