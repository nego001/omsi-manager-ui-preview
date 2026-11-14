import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {createSyntheticReadAdmissionSession} from '../src/synthetic-read-admission';
import {
 createSyntheticContainerReview,advanceSyntheticContainerReview,cancelSyntheticContainerReview,
 snapshotSyntheticContainerReview,type SyntheticContainerFormat,type SyntheticContainerReview
} from '../src/synthetic-container-screen';
const plan=createSyntheticValidationReadiness(createSyntheticDiagnosticDemo()[3].timeline);
const session=createSyntheticReadAdmissionSession(plan);
const file=(path:string,encodedBytes=20,expandedBytes=40)=>({
 path,kind:'file',compression:'deflate',encodedBytes,expandedBytes
});
const begin=(entries:unknown[],format:SyntheticContainerFormat='zip-declared')=>
 createSyntheticContainerReview(session,{format,entries});
function finish(handle:SyntheticContainerReview){
 let r=snapshotSyntheticContainerReview(handle);
 for(let i=0;i<130&&r.status==='pending';i++)r=advanceSyntheticContainerReview(handle);
 return r;
}
test('ZIP fictício com duas entradas percorre um checkpoint por chamada sem abrir bytes',()=>{
 const handle=begin([file('Vehicles/test.bus'),file('Textures/skin.dds')]);
 const initial=snapshotSyntheticContainerReview(handle);
 expect(initial.status).toBe('pending');expect(initial.processed).toBe(0);
 const first=advanceSyntheticContainerReview(handle);
 expect(first.processed).toBe(1);expect(first.status).toBe('pending');
 const second=advanceSyntheticContainerReview(handle);
 expect(second.status).toBe('declarations-reviewed');
 expect(second.processed).toBe(2);
 expect(second.archiveParsed).toBe(false);expect(second.bytesRead).toBe(0);
 expect(second.realConfinementVerified).toBe(false);expect(second.operationsEnabled).toBe(false);
});
test('SCS declarado em formato ZIP aceita metadados, mas não autentica formato real',()=>{
 const x=finish(begin([file('def/engine.sii')],'scs-zip-declared'));
 expect(x.format).toBe('scs-zip-declared');
 expect(x.status).toBe('declarations-reviewed');
 expect(x.syntheticMetadataOnly).toBe(true);expect(x.realConsentVerified).toBe(false);
});
test('SCS proprietário desconhecido é bloqueado antes de percorrer uma entrada',()=>{
 const x=finish(begin([file('def/engine.sii')],'scs-proprietary-declared'));
 expect(x.reason).toBe('unsupported-container');expect(x.status).toBe('blocked');
 expect(x.processed).toBe(0);
});
test('caminhos relativos perigosos, absolutos e separados por barras inválidas são bloqueados',()=>{
 for(const p of ['../evil.txt','dir/../evil.txt','dir/./evil.txt','/absolute.scs',
  'C:\\Windows\\evil.scs','dir//test.sii','dir/','./file.sii','dir/trailing./a.sii']){
  const x=finish(begin([file(p)]));
  expect(x.status,p).toBe('blocked');expect(x.reason,p).toBe('unsafe-path');
 }
});
test('reservados Windows, separadores e caracteres fora do contrato são bloqueados',()=>{
 for(const p of ['con','CON.txt','NUL.dat','com1.cfg','LPT9.txt','some:path.scs',
  'def/settings?.cfg','def/é.sii','def/ foo.sii']){
  expect(finish(begin([file(p)])).reason,p).toBe('unsafe-path');
 }
});
test('mesma entrada com caixa diferente bloqueia alias em Windows',()=>{
 const x=finish(begin([file('Vehicles/Example.bus'),file('vehicles/example.BUS')]));
 expect(x.reason).toBe('duplicate-entry');expect(x.processed).toBe(1);
});
test('arquivo pai de um filho é rejeitado em ambas as ordens',()=>{
 const a=finish(begin([file('def/parent'),file('def/parent/file.sii')]));
 const b=finish(begin([file('def/parent/file.sii'),file('def/parent')]));
 expect(a.reason).toBe('file-directory-collision');
 expect(b.reason).toBe('file-directory-collision');
});
test('diretórios parentais permitem filhos quando declarados corretamente',()=>{
 const dir={path:'Vehicles',kind:'directory',compression:'stored',encodedBytes:0,expandedBytes:0};
 const x=finish(begin([dir,file('Vehicles/test.bus')]));
 expect(x.status).toBe('declarations-reviewed');
});
test('symlinks e hardlinks declarados falham fechados, sem destino exposto',()=>{
 for(const kind of ['symlink','hardlink']){
  const x=finish(begin([{...file('def/link'),kind}]));
  expect(x.reason).toBe('unsafe-link');
  expect(JSON.stringify(x)).not.toContain('def/link');
 }
});
test('compressão desconhecida e arquivos sem bytes codificados não são presumidos seguros',()=>{
 expect(finish(begin([{...file('def/a.sii'),compression:'unknown'}])).reason).toBe('unsupported-compression');
 expect(finish(begin([file('def/b.sii',0,12)])).reason).toBe('resource-limit');
});
test('orçamento de expansão por entrada bloqueia bomba declarativa',()=>{
 const x=finish(begin([file('sound/large.ogg',1,101)]));
 expect(x.reason).toBe('resource-limit');
 expect(x.bytesRead).toBe(0);
});
test('orçamento total soma entradas distintas antes de aceitar checkpoint',()=>{
 const a=file('def/a.sii',1_100_000,1_100_000),b=file('def/b.sii',1_100_000,1_100_000);
 const x=finish(begin([a,b]));
 expect(x.reason).toBe('resource-limit');
 expect(x.processed).toBe(1);
});
test('número de entradas não pode ultrapassar limite sem percorrer metadados extras',()=>{
 const entries=Array.from({length:129},(_,i)=>file('def/a'+i+'.sii'));
 const x=finish(begin(entries));
 expect(x.status).toBe('blocked');expect(x.reason).toBe('resource-limit');
 expect(x.processed).toBe(0);
});
test('mais de doze componentes e comprimento excessivo são recusados',()=>{
 const long='def/'+'a'.repeat(158)+'.sii';
 const deep=Array.from({length:13},(_,i)=>'d'+i).join('/');
 for(const p of [long,deep]){
  expect(finish(begin([file(p)])).reason).toBe('unsafe-path');
 }
});
test('entrada inválida ou getter recusa sem executar getter',()=>{
 const evil=Object.defineProperty({...file('def/foo.sii')},'path',{enumerable:true,get(){throw Error('getter executed')}});
 const x=finish(begin([evil]));expect(x.reason).toBe('invalid-fixture');
 const noCompression={path:'a.sii',kind:'file',encodedBytes:1,expandedBytes:2};
 expect(finish(begin([noCompression])).reason).toBe('invalid-fixture');
});
test('mudança nos objetos originais depois de criar sessão não altera a simulação',()=>{
 const original=file('def/test.sii');
 const handle=begin([original]);
 const o=original as {path:string};o.path='../changed';
 const x=finish(handle);
 expect(x.status).toBe('declarations-reviewed');
 expect(x.reason).toBeNull();
});
test('cancelamento antes da primeira entrada deixa progresso zero e é terminal',()=>{
 const h=begin([file('def/a.sii')]);
 const x=cancelSyntheticContainerReview(h);
 expect(x.status).toBe('cancelled');expect(x.reason).toBe('cancelled');
 expect(x.processed).toBe(0);
 expect(advanceSyntheticContainerReview(h)).toEqual(x);
});
test('cancelamento entre duas entradas não processa o resto',()=>{
 const h=begin([file('def/a.sii'),file('def/b.sii')]);
 expect(advanceSyntheticContainerReview(h).processed).toBe(1);
 const x=cancelSyntheticContainerReview(h);
 expect(x.processed).toBe(1);
 expect(advanceSyntheticContainerReview(h).status).toBe('cancelled');
 expect(x.declaredEntries).toBe(2);
});
test('depois do bloqueio, avançar ou cancelar não apaga motivos',()=>{
 const h=begin([file('../evil.sii')]);
 const result=advanceSyntheticContainerReview(h);
 expect(result.reason).toBe('unsafe-path');
 expect(advanceSyntheticContainerReview(h)).toEqual(result);
 expect(cancelSyntheticContainerReview(h)).toEqual(result);
});
test('resultado concluído não se transforma em leitura real após mais avanços',()=>{
 const h=begin([file('def/a.sii')]),x=finish(h);
 expect(advanceSyntheticContainerReview(h)).toEqual(x);
 expect(cancelSyntheticContainerReview(h)).toEqual(x);
 expect(x.executableOperationsEnabled).toBe(false);
});
test('sessão clonada e forjada não produz triagem de contêiner',()=>{
 for(const fake of [{...session},JSON.parse(JSON.stringify(session)),{...session,accessGranted:true}]){
  expect(()=>createSyntheticContainerReview(fake,{format:'zip-declared',entries:[]})).toThrow('não emitida');
 }
});
test('manifest malformado, acessores e formatos inventados falham fechado',()=>{
 for(const input of [null,{},'ZIP',{format:'rar-declared',entries:[]},
  {format:'zip-declared'}, {format:'zip-declared',entries:[],realPath:'C:\\private'}]){
  expect(()=>createSyntheticContainerReview(session,input)).toThrow('inválido');
 }
 const bad=Object.defineProperty({format:'zip-declared',entries:[]},'entries',{
  enumerable:true,get(){throw Error('getter executed')}
 });
 expect(()=>createSyntheticContainerReview(session,bad)).toThrow('inválido');
});
test('resultado e handle não expõem nomes, paths, tokens ou digest de fixture',()=>{
 const h=begin([file('secret/PRIVATE_FILE.scs')]);
 const x=finish(h);
 const json=JSON.stringify(h)+JSON.stringify(x);
 for(const secret of ['PRIVATE_FILE','secret/','synthetic-entry','revisionTicket','token','eeeeeeee']){
  expect(json).not.toContain(secret);
 }
 expect(Object.isFrozen(h)).toBe(true);
 expect(Object.isFrozen(x)).toBe(true);
});
test('progresso nunca registra operações ou resultados de compatibilidade',()=>{
 const x=finish(begin([file('def/a.sii')]));
 expect(x.bytesRead).toBe(0);
 expect(x.archiveParsed).toBe(false);
 expect(x.pathsExposed).toBe(false);
 expect(x.operationsEnabled).toBe(false);
 expect(x.realConsentVerified).toBe(false);
 expect(x.realConfinementVerified).toBe(false);
});
