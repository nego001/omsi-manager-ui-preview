import {test,expect} from '@playwright/test';
import {resolve} from 'node:path';
import {parseDeclaredSessionReview,MAX_SESSION_REVIEW_BYTES} from '../src/session-report-review';
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
test('Histórico consulta exportação local sem criar favoritos nem atividades e preserva resultado após rejeição',async({page})=>{
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
 await expect(section).toContainText('Arquivo consultado: 2 resumo(s) declarado(s)');
 await nav.getByRole('button',{name:'Minha biblioteca'}).click();
 await expect(page.getByRole('button',{name:'Retirar dos favoritos'})).toHaveCount(0);
 await nav.getByRole('button',{name:'Histórico'}).click();
 await section.getByRole('button',{name:'Descartar consulta'}).click();
 await expect(section).not.toContainText('Arquivo consultado');
 await input.setInputFiles(upload(serializeDeclaredSessionReport(base)));
 await expect(section).toContainText('Arquivo consultado: 1 resumo(s) declarado(s)');
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 // Restore exists only after a real (metadata-only) catalog import.
 await expect(page.getByRole('button',{name:'Restaurar demonstração'})).toHaveCount(0);
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(resolve('examples/catalog.example.json'));
 await expect(page.getByText('Importado: catalog.example.json')).toBeVisible();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(section).not.toContainText('Arquivo consultado');
 // The valid import cleared the previous review. Open a new one to test restore.
 await input.setInputFiles(upload(serializeDeclaredSessionReport(base)));
 await expect(section).toContainText('Arquivo consultado: 1 resumo(s) declarado(s)');
 await nav.getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByRole('button',{name:'Restaurar demonstração'}).click();
 await expect(page.getByText('Origem: Demonstração')).toBeVisible();
 await nav.getByRole('button',{name:'Histórico'}).click();
 await expect(section).not.toContainText('Arquivo consultado');
 const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth));
 expect(overflow).toBeLessThanOrEqual(3);
});
