import {test,expect} from '@playwright/test';
import type {FolderInspection} from '../src/inspection-types';
import {parseCatalogManifest} from '../src/catalog';
import {analyzeModRelations} from '../src/relation-analysis';
import {consolidateDiagnostic} from '../src/diagnostic-report';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const demo=readFileSync(resolve('examples/catalog.versions.example.json'),'utf8');
const mods=parseCatalogManifest(demo);
const upload=(source:string)=>({name:'catalog-report.json',mimeType:'application/json',buffer:Buffer.from(source)});
const inspected:FolderInspection={
 status:'ok',game:'ets2',folderName:'Euro Truck Simulator 2',recognized:true,mode:'read-only',
 selectionMode:'parent-folder',limited:false,
 assessment:{scope:'directory-structure-only',compatibilityVerified:false,installationVerified:false,summary:'Somente estrutura.'},
 groups:[{key:'mods',name:'Pasta de mods',found:true,count:3,limited:false,directories:1,files:2,packageCandidates:2,linksSkipped:0,others:0}],
 notices:[{code:'mods-not-verified',level:'info',message:'Pacotes não verificados.'}]
};
test('relatório sem inspeção conserva estado desconhecido e limitações explícitas',()=>{
 const a=analyzeModRelations(mods,'ets2-paint','1.52');
 const report=consolidateDiagnostic('ets2','ets2-paint','Catálogo de teste',a,undefined,'1.52');
 expect(report.title).toBe('Revisão manual obrigatória');
 expect(report.blockers).toBe(0);
 expect(report.directoryStatus).toBe('not-run');
 expect(report.inspectedEntries).toBeNull();
 expect(report.findings.map(x=>x.code)).toContain('directory-not-inspected');
 expect(report.actionsAllowed).toBe(false);
 expect(report.compatibilityVerified).toBe(false);
 expect(report.hypotheticalVersion).toBe('1.52');
});
test('falha de versão lógica nunca autoriza instalação',()=>{
 const a=analyzeModRelations(mods,'ets2-sound-engine','1.52');
 const report=consolidateDiagnostic('ets2','ets2-sound-engine','Teste',a,undefined,'1.52');
 expect(report.title).toBe('Inconsistências no catálogo');
 expect(report.blockers).toBeGreaterThan(0);
 expect(report.findings.some(x=>x.code==='dependency-version-too-low'&&x.severity==='blocking')).toBe(true);
 expect(report.actionsAllowed).toBe(false);
});
test('inspeção soma apenas entradas, não declara mods instalados',()=>{
 const a=analyzeModRelations(mods,'ets2-paint','1.52');
 const report=consolidateDiagnostic('ets2','ets2-paint','JSON',a,inspected,'1.52');
 expect(report.directoryStatus).toBe('inspected');
 expect(report.inspectedEntries).toBe(3);
 expect(report.findings.some(x=>x.code==='directory-count-only')).toBe(true);
 expect(JSON.stringify(report)).not.toContain('C:');
 expect(report.compatibilityVerified).toBe(false);
 expect(report.actionsAllowed).toBe(false);
});
test('inspeção incompleta ou falha vira aviso, não atestado de compatibilidade',()=>{
 const a=analyzeModRelations(mods,'ets2-paint');
 const partial:FolderInspection={...inspected,limited:true,
  groups:[{...inspected.status==='ok'?inspected.groups[0]:{key:'mods',name:'Mods',found:true,count:0,limited:false,directories:0,files:0,packageCandidates:0,linksSkipped:0,others:0},count:2000,limited:true}],
  notices:[{code:'partial-count',level:'attention',message:'Contagem parcial.'}]};
 const report=consolidateDiagnostic('ets2','ets2-paint','JSON',a,partial,'');
 expect(report.hasPartialCounts).toBe(true);
 expect(report.warnings).toBeGreaterThan(0);
 expect(report.compatibilityVerified).toBe(false);
 const errored=consolidateDiagnostic('ets2','ets2-paint','JSON',a,{status:'error',message:'C:/private/user'},'');
 expect(errored.directoryStatus).toBe('error');
 expect(errored.findings.map(x=>x.code)).toContain('directory-error');
 expect(JSON.stringify(errored)).not.toContain('C:/private/user');
});
test('a inspeção de outro jogo não é confundida com a do mod selecionado',()=>{
 const a=analyzeModRelations(mods,'ets2-paint');
 const report=consolidateDiagnostic('ets2','ets2-paint','JSON',a,{...inspected,game:'ats'},'');
 expect(report.directoryStatus).toBe('not-run');
 expect(report.findings.map(x=>x.code)).toContain('directory-unavailable');
});
test('relatório da interface resume dependências, versões e inspeção ausente',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(upload(demo));
 await page.getByRole('button',{name:'Som de motor (exemplo)',exact:true}).click();
 const report=page.getByRole('region',{name:'Relatório consolidado'});
 await expect(report).toBeVisible();
 await expect(report.getByText('Inconsistências no catálogo')).toBeVisible();
 await expect(report.getByText('Nenhuma inspeção manual de pasta foi realizada neste jogo nesta sessão.')).toBeVisible();
 await expect(report.getByText(/exige Biblioteca de áudio/)).toBeVisible();
 await expect(report.getByText(/Instalação e remoção permanecem bloqueadas/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await page.getByRole('textbox',{name:'Versão hipotética do jogo'}).fill('1.57');
 await expect(report.getByText(/versão hipotética 1.57 fica fora dela/)).toBeVisible();
});
test('catálogo sem bloqueio não apresenta mensagem de instalação autorizada',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
 const report=page.getByRole('region',{name:'Relatório consolidado'});
 await expect(report.getByText('Revisão manual obrigatória')).toBeVisible();
 await expect(report.getByText('Compatibilidade não verificada.',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
