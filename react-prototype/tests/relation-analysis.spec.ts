import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parseCatalogManifest,type CatalogMod} from '../src/catalog';
import {analyzeModRelations} from '../src/relation-analysis';

const demo=readFileSync(resolve('examples/catalog.dependencies.example.json'),'utf8');
const one=(id:string,game:'omsi'|'ets2'|'ats'='omsi',requires:string[]=[],conflictsWith:string[]=[])=>({
 id,title:'Mod '+id,game,category:'Ônibus',version:'1.0',description:'Exemplo',size:'1 MB',requires,conflictsWith
});
const catalog=(mods:ReturnType<typeof one>[])=>parseCatalogManifest(JSON.stringify({schemaVersion:1,mods}));
const uploaded=(content:string)=>({name:'relations.json',mimeType:'application/json',buffer:Buffer.from(content)});

test('sequência teórica é topológica, sem validar instalações reais',()=>{
 const items=parseCatalogManifest(demo);
 const result=analyzeModRelations(items,'omsi-audio');
 expect(result.sequence.map(m=>m.id)).toEqual(['omsi-core','omsi-bus-1721','omsi-audio']);
 expect(result.logicalBlockers).toBe(false);
 expect(result.realInstallationVerified).toBe(false);
 expect(result.issues).toEqual([]);
 const alternative=analyzeModRelations(items,'omsi-alternative');
 expect(alternative.logicalBlockers).toBe(false);
 expect(alternative.issues.map(i=>i.code)).toContain('declared-conflict');
});
test('dependência ausente e dependência de outro jogo causam bloqueio lógico',()=>{
 const missing=analyzeModRelations(catalog([one('a','omsi',['not-listed'])]),'a');
 expect(missing.issues.map(i=>i.code)).toContain('dependency-missing');
 expect(missing.logicalBlockers).toBe(true);
 const cross=analyzeModRelations(catalog([one('bus','omsi',['truck']),one('truck','ets2')]),'bus');
 expect(cross.logicalBlockers).toBe(true);
 expect(cross.issues.map(i=>i.code)).toContain('different-game');
});
test('ciclos indiretos e autorreferência são detectados sem travar o aplicativo',()=>{
 const cycle=analyzeModRelations(catalog([one('a','omsi',['b']),one('b','omsi',['c']),one('c','omsi',['a'])]),'a');
 expect(cycle.logicalBlockers).toBe(true);
 expect(cycle.issues.map(i=>i.code)).toContain('dependency-cycle');
 expect(cycle.sequence.length).toBe(3);
 const self=analyzeModRelations(catalog([one('self','omsi',['self'])]),'self');
 expect(self.logicalBlockers).toBe(true);
 expect(self.issues[0].code).toBe('dependency-cycle');
});
test('conflito entre mods incluídos na sequência é bloqueador; externos são apenas alerta',()=>{
 const included=catalog([one('base'),one('top','omsi',['base'],['base'])]);
 const conflict=analyzeModRelations(included,'top');
 expect(conflict.logicalBlockers).toBe(true);
 expect(conflict.issues.map(i=>i.code)).toContain('conflict-in-plan');
 const declared=catalog([one('base'),one('top','omsi',[],['base'])]);
 const hint=analyzeModRelations(declared,'top');
 expect(hint.logicalBlockers).toBe(false);
 expect(hint.issues.map(i=>i.code)).toContain('declared-conflict');
});
test('lista de relacionamentos inválida ou comando extra é rejeitado',()=>{
 for(const requires of [['duplicate','duplicate'],['UPPERCASE'],Array.from({length:21},(_,i)=>'x'+i),'wrong',null]){
  const candidate={...one('a'),requires};
  expect(()=>parseCatalogManifest(JSON.stringify({schemaVersion:1,mods:[candidate]}))).toThrow();
 }
 expect(()=>parseCatalogManifest(JSON.stringify({schemaVersion:1,mods:[{...one('a'),command:'rm -rf /'}]}))).toThrow('campo não permitido');
});
test('detalhes mostram a sequência e aviso de compatibilidade não verificada',async({page})=>{
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(uploaded(demo));
 await page.getByRole('button',{name:'Sons do OF-1721 (exemplo)',exact:true}).click();
 const panel=page.getByRole('region',{name:'Simulação de dependências'});
 await expect(panel.getByText('Nenhum bloqueio lógico encontrado no JSON')).toBeVisible();
 await expect(panel.locator('ol li')).toHaveCount(3);
 await expect(panel.locator('ol li').nth(0)).toContainText('Pacote base OMSI');
 await expect(panel.locator('ol li').nth(1)).toContainText('Ônibus OF-1721 (exemplo)');
 await expect(panel.locator('ol li').nth(2)).toContainText('Sons do OF-1721 (exemplo)');
 await expect(panel.getByText(/A versão informada é hipotética. Compatibilidade real, versão instalada, integridade dos mods e instalação NÃO verificadas/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Remover (bloqueado)'})).toBeDisabled();
});
test('detalhes exibem bloqueios lógicos do grafo sem habilitar instalação',async({page})=>{
 const bad=JSON.stringify({schemaVersion:1,mods:[one('missing','omsi',['other'])]});
 await page.goto('/');
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Catálogo de mods'}).click();
 await page.getByLabel('Arquivo JSON do catálogo').setInputFiles(uploaded(bad));
 await page.getByRole('button',{name:'Mod missing',exact:true}).click();
 const panel=page.getByRole('region',{name:'Simulação de dependências'});
 await expect(panel.getByText('Inconsistências lógicas encontradas')).toBeVisible();
 await expect(panel.getByText(/ID ausente: other/)).toBeVisible();
 await expect(page.getByRole('button',{name:'Instalar (bloqueado)'})).toBeDisabled();
});
