'use strict';
// Lab-only report. Recompute from a bounded fixture, never from a supplied
// verdict or display state. No file access, network, IPC or runtime integration.
const {diagnoseSyntheticDependencies}=require('./m82-synthetic-dependency-diagnostics.cjs');
const MAX_REPORT_BYTES=16384;
const SCHEMA='omsi-manager-synthetic-dependency-report-v1';
function createSyntheticDiagnosticReport(fixture){
 const diagnostic=diagnoseSyntheticDependencies(fixture);
 return {
  schema:SCHEMA,scope:'synthetic-virtual-inventory-only',
  state:diagnostic.state,inventoryComplete:diagnostic.inventoryComplete,
  countUnit:'reference-occurrences',totalReferences:diagnostic.totalReferences,
  counts:{high:diagnostic.counts.high,review:diagnostic.counts.review,info:diagnostic.counts.info},
  findings:diagnostic.items.map(({code,priority,title,description,count})=>({code,priority,title,description,count})),
  limitations:[...diagnostic.limitations],
  realFilesInspected:false,compatibilityVerified:false,operationsEnabled:false
 };
}
function bounded(text){
 if(Buffer.byteLength(text,'utf8')>MAX_REPORT_BYTES)throw Error('M83_REPORT_TOO_LARGE');
 return text;
}
function serializeSyntheticDiagnosticReport(fixture,format='json'){
 if(format!=='json'&&format!=='text')throw Error('M83_FORMAT_REFUSED');
 const report=createSyntheticDiagnosticReport(fixture);
 if(format==='json')return bounded(JSON.stringify(report,null,2)+'\n');
 const stateLabels={
  'no-reference-evidence':'Sem evidência de referências',
  'fixture-findings':'Ocorrências no inventário fictício',
  'review-required':'Revisão necessária',
  'observed-exact-only':'Somente correspondências nominais observadas'
 };
 const lines=[
  'OMSI Manager — Relatório de dependências fictícias',
  'Esquema: '+SCHEMA,
  'Estado: '+stateLabels[report.state],
  'Inventário sintético: '+(report.inventoryComplete?'declarado completo':'incompleto'),
  'Referências (ocorrências, não arquivos únicos): '+report.totalReferences,
  'Prioridade alta: '+report.counts.high+' | Revisão: '+report.counts.review+' | Informação: '+report.counts.info,
  '', 'Resultados'
 ];
 if(!report.findings.length)lines.push('Nenhuma referência avaliada. Isso não comprova ausência de problemas.');
 for(const item of report.findings){
  const label={high:'Alta',review:'Revisão',info:'Informação'}[item.priority];
  lines.push('['+label+'] '+item.title+' — '+item.count,item.description,'');
 }
 lines.push('Limitações',...report.limitations,
  'Compatibilidade real não verificada. Operações bloqueadas.');
 return bounded(lines.join('\n')+'\n');
}
module.exports={createSyntheticDiagnosticReport,serializeSyntheticDiagnosticReport,MAX_REPORT_BYTES};
