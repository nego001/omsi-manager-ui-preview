import {test,expect} from '@playwright/test';
import {buildSyntheticPackageIndex,type SyntheticPackageIndex} from '../src/synthetic-package-index';
import {explainSyntheticDeclaredChanges} from '../src/synthetic-change-explanations';
import {createSyntheticDiagnosticDemo,explainSyntheticDemoRevisions} from '../src/synthetic-diagnostic-demo';
const digest='a'.repeat(64);
function make(paths:readonly string[],hash=digest):SyntheticPackageIndex{
 const result=buildSyntheticPackageIndex(hash,paths.map(path=>({
  path,kind:'file',encodedBytes:100,expandedBytes:150,declaredFormat:'well-formed'
 })));
 expect(result.status).toBe('ready');return result.index!;
}
const base=['Vehicles/demo.bus','def/settings.sii','meta/manifest.json','audio/engine.wav'];
test('nova textura DDS afeta quatro especialistas por escopo, mas não comprova causa',()=>{
 const old=make(base),next=make([...base,'paint/skin.dds']);
 const r=explainSyntheticDeclaredChanges(old,next);
 expect(r.context).toBe('declared-change');
 expect(r.counts).toEqual({added:1,removed:0,modified:0});
 expect(r.groups).toHaveLength(1);
 expect(r.groups[0].suffix).toBe('dds');
 expect(r.groups[0].specialists).toEqual(['structure','definitions','resources','media']);
 expect(r.affectedSpecialists).toEqual(['structure','definitions','resources','media']);
 expect(r.mustRecheckSpecialists).toHaveLength(7);
 expect(r.causationVerified).toBe(false);
 expect(r.operationsEnabled).toBe(false);
});
test('novo áudio OGG não implica que som anterior causou defeito',()=>{
 const old=make(base),next=make([...base,'audio/ambient.ogg']);
 const x=explainSyntheticDeclaredChanges(old,next);
 expect(x.groups).toHaveLength(1);
 expect(x.groups[0].suffix).toBe('ogg');
 expect(x.groups[0].specialists).toEqual(['structure','definitions','audio']);
 expect(x.note).toContain('Não comprova causalidade');
 expect(x.actualContentVerified).toBe(false);
});
test('JSON informa manifestos e relações sem implicar autenticação',()=>{
 const old=make(base),next=make([...base,'mod/addon.json']);
 const x=explainSyntheticDeclaredChanges(old,next);
 expect(x.groups[0].specialists).toEqual(['structure','manifest','relations']);
 expect(x.digestVerified).toBe(false);
});
test('SII envolve estrutura, manifestos, definições, áudio e relações',()=>{
 const old=make(base),next=make([...base,'def/variant.sii']);
 const x=explainSyntheticDeclaredChanges(old,next);
 expect(x.groups[0].specialists).toEqual(['structure','manifest','definitions','audio','relations']);
 expect(x.mustRecheckSpecialists).toHaveLength(7);
});
test('arquivo desconhecido provoca revisão ampla, sem falsa identificação',()=>{
 const old=make(base),next=make([...base,'addons/mystery.zzz']);
 const x=explainSyntheticDeclaredChanges(old,next);
 expect(x.groups[0].suffix).toBe('unknown');
 expect(x.groups[0].specialists).toHaveLength(7);
 expect(x.causationVerified).toBe(false);
});
test('renomeação de textura se mostra como retirada e inclusão, nunca como nome privado',()=>{
 const old=make([...base,'paint/old.dds']),next=make([...base,'paint/new.dds']);
 const x=explainSyntheticDeclaredChanges(old,next);
 expect(x.counts).toEqual({added:1,removed:1,modified:0});
 expect(x.groups.map(g=>g.action)).toEqual(['removed','added']);
 expect(JSON.stringify(x)).not.toContain('paint/');
 expect(JSON.stringify(x)).not.toContain('old');
 expect(JSON.stringify(x)).not.toContain('new.dds');
});
test('mudança só de tamanho declarado gera tipo modificado sem inspecionar bytes',()=>{
 const old=make(base);
 const result=buildSyntheticPackageIndex(digest,base.map((path,i)=>({
  path,kind:'file',encodedBytes:i===0?101:100,expandedBytes:150,declaredFormat:'well-formed'
 })));
 expect(result.status).toBe('ready');
 const x=explainSyntheticDeclaredChanges(old,result.index!);
 expect(x.counts).toEqual({added:0,removed:0,modified:1});
 expect(x.groups[0].suffix).toBe('bus');
 expect(x.actualContentVerified).toBe(false);
});
test('mudança somente no digest declarado exige nova análise sem inventar arquivos alterados',()=>{
 const x=explainSyntheticDeclaredChanges(make(base),make(base,'b'.repeat(64)));
 expect(x.context).toBe('digest-only');
 expect(x.groups).toHaveLength(0);
 expect(x.affectedSpecialists).toHaveLength(7);
 expect(x.mustRecheckSpecialists).toHaveLength(7);
 expect(x.counts).toEqual({added:0,removed:0,modified:0});
});
test('índices idênticos mas emitidos separadamente ainda exigem nova análise',()=>{
 const a=make(base),b=make(base),x=explainSyntheticDeclaredChanges(a,b);
 expect(x.context).toBe('no-declared-difference');
 expect(x.affectedSpecialists).toHaveLength(0);
 expect(x.mustRecheckSpecialists).toHaveLength(7);
 expect(x.note).toContain('não significa igualdade dos bytes');
 expect(x.previousEvidenceReusable).toBe(false);
});
test('índice falsificado ou copiado por JSON é recusado pela comparação privada',()=>{
 const a=make(base),b=make([...base,'paint/skin.dds']);
 const fake=JSON.parse(JSON.stringify(a)) as SyntheticPackageIndex;
 expect(()=>explainSyntheticDeclaredChanges(fake,b)).toThrow('Índice sintético não emitido pelo gate');
 expect(()=>explainSyntheticDeclaredChanges(a,{...b})).toThrow('Índice sintético não emitido pelo gate');
 expect(()=>explainSyntheticDeclaredChanges(a,a)).toThrow('dois índices');
});
test('grupos de mesmo sufixo são contados e não publicados individualmente por caminho',()=>{
 const old=make(base),next=make([...base,'paint/s1.dds','paint/s2.dds','paint/s3.dds']);
 const x=explainSyntheticDeclaredChanges(old,next);
 expect(x.counts.added).toBe(3);
 expect(x.groups).toHaveLength(1);
 expect(x.groups[0].declarations).toBe(3);
 expect(x.groups[0].specialists).toHaveLength(4);
});
test('resultado não expõe tickets, nomes, caminhos privados ou digest literal',()=>{
 const a=make([...base,'secret/PRIVATE_INVOICE_A.dds']);
 const b=make([...base,'secret/PRIVATE_INVOICE_B.dds']);
 const text=JSON.stringify(explainSyntheticDeclaredChanges(a,b));
 for(const secret of ['PRIVATE_INVOICE','secret/','synthetic-entry','revisionTicket',digest,'/'])
  expect(text).not.toContain(secret);
});
test('objetos, grupos, contagens e módulos são imutáveis',()=>{
 const x=explainSyntheticDeclaredChanges(make(base),make([...base,'paint/new.dds']));
 expect(Object.isFrozen(x)).toBe(true);
 expect(Object.isFrozen(x.groups)).toBe(true);
 expect(Object.isFrozen(x.groups[0])).toBe(true);
 expect(Object.isFrozen(x.groups[0].specialists)).toBe(true);
 expect(Object.isFrozen(x.counts)).toBe(true);
 expect(Object.isFrozen(x.mustRecheckSpecialists)).toBe(true);
});
test('fixtures de interface vinculam estágio, revisão e mudanças sem apresentar índices',()=>{
 const steps=createSyntheticDiagnosticDemo();
 const paint=explainSyntheticDemoRevisions(steps[1],1,2);
 const sound=explainSyntheticDemoRevisions(steps[3],2,3);
 const both=explainSyntheticDemoRevisions(steps[3],1,3);
 expect(paint.groups.map(g=>g.suffix)).toEqual(['dds']);
 expect(sound.groups.map(g=>g.suffix)).toEqual(['ogg']);
 expect(both.groups.map(g=>g.suffix)).toEqual(['dds','ogg']);
 expect(both.counts.added).toBe(2);
 expect(steps[3].timeline.revisions).toHaveLength(3);
});
test('etapa inicial não permite inventar par de revisões',()=>{
 const steps=createSyntheticDiagnosticDemo();
 expect(()=>explainSyntheticDemoRevisions(steps[0],1,2)).toThrow('Seleção inválida');
 expect(()=>explainSyntheticDemoRevisions(steps[3],3,2)).toThrow('Seleção inválida');
 expect(()=>explainSyntheticDemoRevisions(steps[3],1,999)).toThrow('Seleção inválida');
 expect(()=>explainSyntheticDemoRevisions(steps[3],1.5,2)).toThrow('Seleção inválida');
});
test('cópia ou objeto falso de etapa não recupera índices privados',()=>{
 const stages=createSyntheticDiagnosticDemo(),fake=JSON.parse(JSON.stringify(stages[3]));
 expect(()=>explainSyntheticDemoRevisions(fake,1,3)).toThrow('Etapa fictícia não emitida');
 expect(()=>explainSyntheticDemoRevisions({...stages[3]},1,3)).toThrow('Etapa fictícia não emitida');
});
