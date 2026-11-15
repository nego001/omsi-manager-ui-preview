import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseCatalogManifest} from '../src/catalog';
import {analyzeModRelations} from '../src/relation-analysis';
import {compareNumericVersions,parseNumericVersion} from '../src/version-requirements';

const demo=readFileSync(resolve('examples/catalog.versions.example.json'),'utf8');
const upload=(s:string)=>({name:'versioned.json',mimeType:'application/json',buffer:Buffer.from(s)});
const core={id:'a',title:'Core',game:'ets2',category:'Sons',version:'1.1',description:'demo',size:'2 MB'};
const target={id:'b',title:'Requires Core',game:'ets2',category:'Sons',version:'1.1',description:'demo',size:'4 MB'};
const manifest=(mods:unknown[])=>JSON.stringify({schemaVersion:1,mods});

test('comparação numérica evita ordenação lexical incorreta',()=>{
 expect(compareNumericVersions('1.10','1.9')).toBe(1);
 expect(compareNumericVersions('1.9','1.10')).toBe(-1);
 expect(compareNumericVersions('1.52','1.52.0')).toBe(0);
 expect(compareNumericVersions('0.9.8','0.9.8.1')).toBe(-1);
 expect(parseNumericVersion('1.2-beta')).toBeNull();
 expect(compareNumericVersions('1.2-beta','1.2')).toBeNull();
 expect(parseNumericVersion('1.2.3.4.5')).toBeNull();
});
test('faixa declarada do jogo só é comparada com versão hipotética',()=>{
 const cat=parseCatalogManifest(demo);
 const unknown=analyzeModRelations(cat,'ets2-paint');
 expect(unknown.issues.map(i=>i.code)).toContain('game-version-unknown');
 expect(unknown.logicalBlockers).toBe(false);
 const older=analyzeModRelations(cat,'ets2-paint','1.50');
 expect(older.issues.map(i=>i.code)).toContain('game-version-outside-range');
 expect(older.logicalBlockers).toBe(true);
 const current=analyzeModRelations(cat,'ets2-paint','1.51.0');
 expect(current.issues).toEqual([]);
 const invalid=analyzeModRelations(cat,'ets2-paint','v1.52');
 expect(invalid.issues.map(i=>i.code)).toContain('game-version-invalid');
 expect(invalid.logicalBlockers).toBe(false);
});
test('mínimo declarado de dependência insuficiente gera bloqueio lógico',()=>{
 const cat=parseCatalogManifest(demo);
 const analysis=analyzeModRelations(cat,'ets2-sound-engine','1.52');
 expect(analysis.logicalBlockers).toBe(true);
 expect(analysis.issues.map(i=>i.code)).toContain('dependency-version-too-low');
 expect(analysis.issues.map(i=>i.code)).not.toContain('game-version-outside-range');
 expect(analysis.realInstallationVerified).toBe(false);
});
test('versão não numérica do mod requerido não pode ser presumida',()=>{
 const cat=parseCatalogManifest(manifest([{...core,version:'beta-3'},{
  ...target,requires:['a'],requiresMinVersions:[{id:'a',minVersion:'2.0'}]
 }]));
 const result=analyzeModRelations(cat,'b');
 expect(result.logicalBlockers).toBe(false);
 expect(result.issues.map(i=>i.code)).toContain('dependency-version-unknown');
});
test('faixas invertidas, campos extras e requisitos inconsistentes são rejeitados',()=>{
 const invalid=[
  {...core,gameVersionRange:{min:'1.60',max:'1.52'}},
  {...core,gameVersionRange:{min:'v1.52'}},
  {...core,gameVersionRange:{min:'1.52',path:'C:/mods'}},
  {...core,gameVersionRange:{}},
  {...core,requiresMinVersions:[{id:'b',minVersion:'2.0'}]},
  {...core,requires:['b'],requiresMinVersions:[{id:'b',minVersion:'2.0',command:'run'}]},
  {...core,requires:['b'],requiresMinVersions:[{id:'b',minVersion:'2.0'},{id:'b',minVersion:'3.0'}]},
  {...core,requires:['b'],requiresMinVersions:[{id:'b',minVersion:'2.0-beta'}]}
 ];
 for(const mod of invalid)expect(()=>parseCatalogManifest(manifest([mod]))).toThrow();
});
test('UI reage à versão hipotética sem habilitar instalação',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(upload(demo));
 await page.getByRole('button',{name:'Pintura demonstrativa',exact:true}).click();
 const panel=page.getByRole('region',{name:'Simulação de dependências'});
 await expect(panel.getByText(/nenhuma versão hipotética foi informada/)).toBeVisible();
 await page.getByRole('textbox',{name:'Versão hipotética do jogo'}).fill('1.49');
 await expect(panel.getByText('Inconsistências lógicas encontradas')).toBeVisible();
 await expect(panel.getByText(/versão hipotética 1.49 fica fora dela/)).toBeVisible();
 await page.getByRole('textbox',{name:'Versão hipotética do jogo'}).fill('1.52');
 await expect(panel.getByText('Nenhum bloqueio lógico encontrado no JSON')).toBeVisible();
 await expect(panel.getByText('Nenhuma relação inconsistente declarada para este mod.')).toBeVisible();
 await expect(panel.getByText(/Compatibilidade real, versão instalada/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
