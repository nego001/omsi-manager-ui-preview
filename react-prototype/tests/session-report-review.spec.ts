import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {readFileSync} from 'node:fs';
import {parseDeclaredSessionReview,compareReviewedDeclaredReports,serializeReviewedDeclaredComparison,MAX_SESSION_REVIEW_BYTES} from '../src/session-report-review';
import {parseDeclaredComparisonReview,MAX_COMPARISON_REVIEW_BYTES} from '../src/session-comparison-review';
import {serializeDeclaredSessionComparison} from '../src/session-report-compare';
import {serializeDeclaredSessionReport,serializeDeclaredSessionArchive} from '../src/session-report-export';

const base={id:1,selectedIds:['omsi-bus'],selectedTitles:['Ônibus Urbano Clássico'],
 selectedCount:1,games:['omsi'] as const,blockers:0,notices:1};
function upload(content:string){
 return {name:'resumo-exportado.json',mimeType:'application/json',buffer:Buffer.from(content,'utf8')};
}
test('consulta local reabre somente arquivos próprios e não confunde metadados com instalação',()=>{
 const single=serializeDeclaredSessionReport(base);
 const parsed=parseDeclaredSessionReview(single);
 expect(parsed).toMatchObject({kind:'report',scope:'catalog-metadata-only',
  installationVerified:false,compatibilityVerified:false,
  reports:[{reportId:1,selectedCount:1,selectedMods:[{id:'omsi-bus',title:'Ônibus Urbano Clássico'}],
   installationVerified:false,compatibilityVerified:false}]});
 const archive=serializeDeclaredSessionArchive([{...base,id:3},{...base,id:1}]);
 expect(parseDeclaredSessionReview(archive).reports.map(r=>r.reportId)).toEqual([3,1]);
 expect(base.selectedIds).toEqual(['omsi-bus']);
});
test('consulta local rejeita campos extras, resultados adulterados e limites',()=>{
 const single=JSON.parse(serializeDeclaredSessionReport(base));
 const archive=JSON.parse(serializeDeclaredSessionArchive([base]));
 const invalid=[
  {...single,installationVerified:true},
  {...single,compatibilityVerified:true},
  {...single,filePath:'/private/game'},
  {...single,selectedMods:[{...single.selectedMods[0],command:'install'}]},
  {...single,selectedCount:4},
  {...single,scope:'actual-installs'},
  {...single,source:'installed-state'},
  {...single,disclaimer:'Instalação verificada'},
  {...single,selectedMods:[single.selectedMods[0],single.selectedMods[0]],selectedCount:2},
  {...archive,reports:[{...single,installationVerified:true}]},
  {...archive,reportCount:2},
  {...archive,reports:[single,single],reportCount:2},
  {...archive,installationVerified:true},
  {...archive,script:'alert(1)'}
 ];
 for(const input of invalid)
  expect(()=>parseDeclaredSessionReview(JSON.stringify(input)))
   .toThrow('SESSION_REVIEW_INVALID');
 expect(()=>parseDeclaredSessionReview('[')).toThrow('SESSION_REVIEW_INVALID_JSON');
 expect(()=>parseDeclaredSessionReview('{"schema":"unknown"}'))
  .toThrow('SESSION_REVIEW_UNSUPPORTED_SCHEMA');
 expect(()=>parseDeclaredSessionReview('x'.repeat(MAX_SESSION_REVIEW_BYTES+1)))
  .toThrow('SESSION_REVIEW_TOO_LARGE');
});
test('Histórico consulta exportação local sem criar favoritos nem atividades e descarta prévia após rejeição',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Histórico'}).click();
 const section=page.getByRole('region',{name:'Consulta de arquivos exportados'});
 const input=section.getByLabel('Arquivo JSON de resumos exportados');
 await input.setInputFiles(upload(serializeDeclaredSessionArchive([{...base,id:2},base])));
 await expect(section).toContainText('Arquivo consultado: 2 resumo(s) declarado(s)');
 await expect(section).toContainText('Ônibus Urbano Clássico');
 await expect(section).toContainText('Origem externa não autenticada');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
 await input.setInputFiles(upload(JSON.stringify({
  ...JSON.parse(serializeDeclaredSessionReport(base)),installationVerified:true
 })));
 await expect(section.getByRole('alert')).toContainText('Arquivo incompatível ou adulterado');
 await expect(section).not.toContainText('Arquivo consultado');
 await expect(section.getByRole('button',{name:'Descartar consulta'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(section.getByRole('button',{name:'Descartar consulta'})).toHaveCount(0);
 await input.setInputFiles(upload(serializeDeclaredSessionReport(base)));
 await expect(section).toContainText('Arquivo consultado: 1 resumo(s) declarado(s)');
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 // Restore exists only after a real (metadata-only) catalog import.
 await expect(page.getByRole('button',{name:'Restaurar demonstração'})).toHaveCount(0);
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(resolve('examples/catalog.example.json'));
 await expect(page.getByRole('region',{name:'Confirmar substituição do catálogo'})).toBeVisible();
 await page.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(page.getByText('Importado: catalog.example.json')).toBeVisible();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(section).not.toContainText('Arquivo consultado');
 // The valid import cleared the previous review. Open a new one to test restore.
 await input.setInputFiles(upload(serializeDeclaredSessionReport(base)));
 await expect(section).toContainText('Arquivo consultado: 1 resumo(s) declarado(s)');
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 await expect(page.getByRole('region',{name:'Confirmar substituição do catálogo'})).toBeVisible();
 await page.getByRole('button',{name:'Confirmar e descartar dados locais'}).click();
 await expect(page.getByText('Origem: Demonstração')).toBeVisible();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(section).not.toContainText('Arquivo consultado');
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

const next={...base,id:2,
 selectedIds:['omsi-bus','ets2-engine'],selectedTitles:['Ônibus Urbano Clássico','Pacote de som ETS2'],
 selectedCount:2,games:['omsi','ets2'] as const,blockers:2,notices:0};

test('comparação de JSON externo usa apenas IDs declarados sem modificar os resumos',()=>{
 const parsed=parseDeclaredSessionReview(serializeDeclaredSessionArchive([base,next]));
 const left=JSON.stringify(parsed);
 const diff=compareReviewedDeclaredReports(parsed.reports[0],parsed.reports[1]);
 expect(diff).toMatchObject({
  beforeId:1,afterId:2,added:[{id:'ets2-engine',title:'Pacote de som ETS2'}],
  removed:[],unchangedCount:1,
  blockersBefore:0,blockersAfter:2,noticesBefore:1,noticesAfter:0,
  scope:'catalog-metadata-only',installationVerified:false,compatibilityVerified:false
 });
 const reversed=compareReviewedDeclaredReports(parsed.reports[1],parsed.reports[0]);
 expect(reversed.added).toEqual([]);
 expect(reversed.removed).toEqual([{id:'ets2-engine',title:'Pacote de som ETS2'}]);
 expect(()=>compareReviewedDeclaredReports(parsed.reports[0],parsed.reports[0]))
  .toThrow('SESSION_COMPARISON_SAME_REPORT');
 expect(JSON.stringify(parsed)).toBe(left);
});

test('Histórico compara coleção JSON na largura de 390 px, sem criar atividades ou favoritos',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Histórico'}).click();
 const section=page.getByRole('region',{name:'Consulta de arquivos exportados'});
 const input=section.getByLabel('Arquivo JSON de resumos exportados');
 await input.setInputFiles(upload(serializeDeclaredSessionArchive([base,next])));
 const comparison=section.getByRole('region',{name:'Comparação de resumos do arquivo consultado'});
 await expect(comparison).toBeVisible();
 await expect(comparison.getByRole('group',{name:'Diferenças do arquivo consultado'})).toContainText('Entraram na seleção: 1');
 await expect(comparison).toContainText('Pacote de som ETS2');
 await expect(comparison).toContainText('Bloqueios declarados: 0 → 2');
 await expect(comparison.getByLabel('Resumo base do arquivo consultado')).toHaveValue('1');
 await expect(comparison.getByLabel('Resumo comparado do arquivo consultado')).toHaveValue('2');
 await comparison.getByRole('button',{name:'Inverter comparação do arquivo'}).click();
 await expect(comparison.getByLabel('Resumo base do arquivo consultado')).toHaveValue('2');
 await expect(comparison.getByLabel('Resumo comparado do arquivo consultado')).toHaveValue('1');
 await expect(comparison.getByRole('group',{name:'Diferenças do arquivo consultado'})).toContainText('Saíram da seleção: 1');
 await input.setInputFiles(upload(JSON.stringify({
  ...JSON.parse(serializeDeclaredSessionReport(base)),installationVerified:true
 })));
 await expect(section.getByRole('alert')).toContainText('Arquivo incompatível ou adulterado');
 await expect(comparison).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(comparison).toHaveCount(0);
 await input.setInputFiles(upload(serializeDeclaredSessionReport(base)));
 await expect(comparison).toHaveCount(0);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('exportação de comparação externa preserva origem não autenticada e somente metadados',()=>{
 const reports=parseDeclaredSessionReview(serializeDeclaredSessionArchive([base,next])).reports;
 const original=JSON.stringify(reports);
 const result=JSON.parse(serializeReviewedDeclaredComparison(reports[0],reports[1]));
 expect(result).toMatchObject({
  schema:'omsi-manager-external-declared-comparison-v1',
  source:'external-json-unverified',scope:'catalog-metadata-only',
  beforeReportId:1,afterReportId:2,
  addedSelectedMods:[{id:'ets2-engine',title:'Pacote de som ETS2'}],
  removedSelectedMods:[],unchangedSelectedCount:1,
  declaredBlockers:{before:0,after:2,delta:2},
  declaredWarnings:{before:1,after:0,delta:-1},
  sourceAuthenticated:false,chronologicalOrderVerified:false,
  installationVerified:false,compatibilityVerified:false
 });
 expect(Object.keys(result)).not.toContain('modPath');
 expect(Object.keys(result)).not.toContain('installationState');
 expect(()=>parseDeclaredSessionReview(JSON.stringify(result)))
  .toThrow('SESSION_REVIEW_UNSUPPORTED_SCHEMA');
 expect(()=>serializeReviewedDeclaredComparison(reports[0],reports[0]))
  .toThrow('SESSION_COMPARISON_SAME_REPORT');
 expect(JSON.stringify(reports)).toBe(original);
});

test('download da comparação externa é JSON com procedência distinta e não gera histórico',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Histórico'}).click();
 const section=page.getByRole('region',{name:'Consulta de arquivos exportados'});
 const input=section.getByLabel('Arquivo JSON de resumos exportados');
 await input.setInputFiles(upload(serializeDeclaredSessionArchive([base,next])));
 const comparison=section.getByRole('region',{name:'Comparação de resumos do arquivo consultado'});
 const [download]=await Promise.all([
  page.waitForEvent('download'),
  comparison.getByRole('button',{name:'Exportar comparação externa JSON'}).click()
 ]);
 expect(download.suggestedFilename()).toBe('OMSI-Manager-Comparacao-Externa-1-2.json');
 const json=JSON.parse(readFileSync(await download.path(),'utf8'));
 expect(json).toMatchObject({
  source:'external-json-unverified',beforeReportId:1,afterReportId:2,
  sourceAuthenticated:false,chronologicalOrderVerified:false,
  installationVerified:false,compatibilityVerified:false
 });
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Histórico'}).click();
 await comparison.getByRole('button',{name:'Inverter comparação do arquivo'}).click();
 const [reversed]=await Promise.all([
  page.waitForEvent('download'),
  comparison.getByRole('button',{name:'Exportar comparação externa JSON'}).click()
 ]);
 expect(reversed.suggestedFilename()).toBe('OMSI-Manager-Comparacao-Externa-2-1.json');
 const reverseJSON=JSON.parse(readFileSync(await reversed.path(),'utf8'));
 expect(reverseJSON.removedSelectedMods).toEqual([{id:'ets2-engine',title:'Pacote de som ETS2'}]);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});

test('reabre somente formatos de comparação conhecidos com proveniência não autenticada',()=>{
 const external=serializeReviewedDeclaredComparison(
  parseDeclaredSessionReview(serializeDeclaredSessionArchive([base,next])).reports[0],
  parseDeclaredSessionReview(serializeDeclaredSessionArchive([base,next])).reports[1]);
 const a=parseDeclaredComparisonReview(external);
 expect(a).toMatchObject({kind:'comparison',source:'external-json-unverified',
  beforeReportId:1,afterReportId:2,unchangedSelectedCount:1,
  addedSelectedMods:[{id:'ets2-engine',title:'Pacote de som ETS2'}],
  sourceAuthenticated:false,chronologicalOrderVerified:false,
  installationVerified:false,compatibilityVerified:false});
 const b=parseDeclaredComparisonReview(serializeDeclaredSessionComparison(base,next));
 expect(b).toMatchObject({kind:'comparison',source:'session-memory',
  beforeReportId:1,afterReportId:2,sourceAuthenticated:false,
  chronologicalOrderVerified:false,installationVerified:false});
 expect(()=>parseDeclaredComparisonReview(serializeDeclaredSessionReport(base)))
  .toThrow('COMPARISON_REVIEW_UNSUPPORTED_SCHEMA');
});

test('rejeita comparação JSON adulterada, contagens falsas, caminhos, IDs repetidos e limites',()=>{
 const reports=parseDeclaredSessionReview(serializeDeclaredSessionArchive([base,next])).reports;
 const valid=JSON.parse(serializeReviewedDeclaredComparison(reports[0],reports[1]));
 const invalid=[
  {...valid,installationVerified:true},
  {...valid,compatibilityVerified:true},
  {...valid,sourceAuthenticated:true},
  {...valid,chronologicalOrderVerified:true},
  {...valid,source:'session-memory'},
  {...valid,filePath:'/private/game'},
  {...valid,script:'install now'},
  {...valid,disclaimer:'Instalação verificada'},
  {...valid,unchangedSelectedCount:-1},
  {...valid,unchangedSelectedCount:501},
  {...valid,afterReportId:1},
  {...valid,addedSelectedMods:[{...valid.addedSelectedMods[0],command:'install'}]},
  {...valid,addedSelectedMods:[valid.addedSelectedMods[0],valid.addedSelectedMods[0]]},
  {...valid,removedSelectedMods:[valid.addedSelectedMods[0]]},
  {...valid,declaredBlockers:{...valid.declaredBlockers,delta:999}},
  {...valid,declaredWarnings:{...valid.declaredWarnings,after:-1}}
 ];
 for(const item of invalid)
  expect(()=>parseDeclaredComparisonReview(JSON.stringify(item)))
   .toThrow('COMPARISON_REVIEW_INVALID');
 expect(()=>parseDeclaredComparisonReview('['))
  .toThrow('COMPARISON_REVIEW_INVALID_JSON');
 expect(()=>parseDeclaredComparisonReview('x'.repeat(MAX_COMPARISON_REVIEW_BYTES+1)))
  .toThrow('COMPARISON_REVIEW_TOO_LARGE');
});

test('Histórico consulta comparação JSON sem importar atividades e limpa prévia após erro em 390 px',async({page})=>{
 await page.setViewportSize({width:390,height:820});
 await page.goto('/');
 const nav=page.getByRole('navigation',{name:'Navegação principal'});
 await nav.getByRole('button',{name:'Histórico'}).click();
 const section=page.getByRole('region',{name:'Consulta de arquivos exportados'});
 const input=section.getByLabel('Arquivo JSON de resumos exportados');
 const archive=parseDeclaredSessionReview(serializeDeclaredSessionArchive([base,next]));
 await input.setInputFiles(upload(serializeReviewedDeclaredComparison(archive.reports[0],archive.reports[1])));
 const comparison=section.getByRole('region',{name:'Consulta de comparação JSON exportada'});
 await expect(comparison).toContainText('Comparação JSON consultada: resumo 1 → resumo 2');
 await expect(comparison).toContainText('Origem comparação externa não autenticada');
 await expect(comparison.getByRole('group',{name:'Diferenças da comparação JSON'})).toContainText('Entraram na seleção: 1');
 await expect(comparison).toContainText('Pacote de som ETS2');
 await input.setInputFiles(upload(JSON.stringify({
  ...JSON.parse(serializeDeclaredSessionComparison(base,next)),installationVerified:true
 })));
 await expect(section.getByRole('alert')).toContainText('Arquivo incompatível ou adulterado');
 await expect(comparison).toHaveCount(0);
 await input.setInputFiles(upload(serializeDeclaredSessionComparison(base,next)));
 await expect(comparison).toContainText('Origem exportação de sessão não autenticada');
 await expect(page.getByRole('heading',{name:'Sem atividades registradas'})).toBeVisible();
 await expect(page.getByRole('region',{name:'Análises declarativas desta sessão'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Histórico'}).click();
 await comparison.getByRole('button',{name:'Descartar comparação consultada'}).click();
 await expect(comparison).toHaveCount(0);
 await input.setInputFiles(upload(serializeDeclaredSessionReport(base)));
 await expect(section).toContainText('Arquivo consultado: 1 resumo(s) declarado(s)');
 await expect(comparison).toHaveCount(0);
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
