import {test,expect} from '@playwright/test';
import {createSyntheticDiagnosticDemo} from '../src/synthetic-diagnostic-demo';
import {createSyntheticValidationReadiness,filterSyntheticValidationReadiness} from '../src/synthetic-validation-readiness';
import {
 SYNTHETIC_READ_BUDGETS,createSyntheticReadAdmissionSession,assessSyntheticReadClaim,
 type SyntheticReadClaim,type SyntheticReadAdmissionSession
} from '../src/synthetic-read-admission';
const timeline=createSyntheticDiagnosticDemo()[3].timeline;
const plan=createSyntheticValidationReadiness(timeline);
const session=createSyntheticReadAdmissionSession(plan);
const valid: SyntheticReadClaim={
 kind:'synthetic-read-proposal',revision:plan.revision,
 consent:'explicit-claim',selectedScope:'single-entry',requestedAction:'read-only',
 containment:'contained-claim',links:'reject-all-links',
 encodedBytes:1024,expandedBytes:2048,entries:1,depth:1,timeMs:50,cancelled:false
};
const evaluate=(changes:Partial<SyntheticReadClaim>={})=>assessSyntheticReadClaim(session,{...valid,...changes});
test('declarações aparentemente ideais continuam bloqueadas, sem emitir handle nativo',()=>{
 const r=evaluate();
 expect(r.status).toBe('blocked');
 expect(r.declarationConsistent).toBe(true);
 expect(r.reasonCodes).toEqual(['missing-native-consent','missing-native-confinement','no-reader-backend']);
 expect(r.realConsentVerified).toBe(false);
 expect(r.realPathVerified).toBe(false);
 expect(r.realContentRead).toBe(false);
 expect(r.permittedReadBytes).toBe(0);
 expect(r.operationsEnabled).toBe(false);
});
test('ausência de consentimento declarado bloqueia além das barreiras nativas',()=>{
 const r=evaluate({consent:'missing'});
 expect(r.reasonCodes).toContain('no-consent');
 expect(r.declarationConsistent).toBe(false);
});
test('revogação tem motivo próprio, nunca aceita mesmo que fosse autorizado antes',()=>{
 const r=evaluate({consent:'revoked'});
 expect(r.reasonCodes).toContain('revoked-consent');
 expect(r.status).toBe('blocked');
});
test('escopo amplo e diretório não são seleção única de arquivo',()=>{
 for(const selectedScope of ['directory-tree','unbounded'] as const){
  const r=evaluate({selectedScope});
  expect(r.reasonCodes).toContain('broad-scope');
  expect(r.permittedReadBytes).toBe(0);
 }
});
test('operações de escrita e execução nunca se confundem com leitura segura',()=>{
 for(const requestedAction of ['write','execute'] as const){
  expect(evaluate({requestedAction}).reasonCodes).toContain('write-or-execute');
 }
});
test('travessia de caminho é rejeitada sem receber o caminho real',()=>{
 expect(evaluate({containment:'traversal'}).reasonCodes).toContain('traversal-indicated');
 expect(evaluate({containment:'unverified'}).reasonCodes).toContain('unverified-containment');
});
test('symlink/junction e links não resolvidos falham fechado',()=>{
 for(const links of ['follow-links','unresolved'] as const){
  expect(evaluate({links}).reasonCodes).toContain('unsafe-links');
 }
});
test('qualquer orçamento individual excedido é rejeitado',()=>{
 const over=[
  {encodedBytes:SYNTHETIC_READ_BUDGETS.encodedBytes+1},
  {expandedBytes:SYNTHETIC_READ_BUDGETS.expandedBytes+1},
  {entries:SYNTHETIC_READ_BUDGETS.entries+1},
  {depth:SYNTHETIC_READ_BUDGETS.depth+1},
  {timeMs:SYNTHETIC_READ_BUDGETS.timeMs+1}
 ];
 for(const c of over){expect(evaluate(c).reasonCodes).toContain('resource-limit');}
});
test('razão de expansão excessiva bloqueia mesmo abaixo do limite absoluto',()=>{
 expect(evaluate({encodedBytes:1,expandedBytes:101}).reasonCodes).toContain('resource-limit');
 expect(evaluate({encodedBytes:1,expandedBytes:100}).reasonCodes).not.toContain('resource-limit');
});
test('limites inclusivos e inteiros seguros aceitam declaração, sem conceder acesso',()=>{
 const result=evaluate({
  encodedBytes:10_000,expandedBytes:1_000_000,
  entries:SYNTHETIC_READ_BUDGETS.entries,
  depth:SYNTHETIC_READ_BUDGETS.depth,timeMs:SYNTHETIC_READ_BUDGETS.timeMs
 });
 expect(result.declarationConsistent).toBe(true);
 expect(result.status).toBe('blocked');
});
test('cancelamento sempre interrompe o pedido fictício sem emitir permissão',()=>{
 const x=evaluate({cancelled:true});
 expect(x.reasonCodes).toContain('cancelled');
 expect(x.permittedReadBytes).toBe(0);
});
test('replay em outra revisão é explicitamente bloqueado',()=>{
 const x=evaluate({revision:valid.revision-1});
 expect(x.reasonCodes).toContain('stale-revision');
 expect(x.requestedRevision).toBe(valid.revision-1);
});
test('versão do contrato, campos extras e campos ausentes são inválidos',()=>{
 for(const bad of [
  {...valid,kind:'native-read-request'},
  {...valid,path:'C:\\Fake\\mod.scs'},
  Object.fromEntries(Object.entries(valid).filter(([k])=>k!=='consent'))
 ]){
  const x=assessSyntheticReadClaim(session,bad);
  expect(x.reasonCodes).toContain('invalid-contract');
  expect(x.requestedRevision).toBeNull();
 }
});
test('valores NaN, negativos, floats e infinitos não passam no orçamento',()=>{
 for(const value of [NaN,-1,1.5,Infinity,Number.MAX_SAFE_INTEGER+1]){
  expect(evaluate({encodedBytes:value}).reasonCodes).toContain('invalid-contract');
 }
});
test('tipos inesperados e enums falsificados são rejeitados por validação runtime',()=>{
 for(const altered of [
  {consent:'system-trusted'},{requestedAction:'read-write'},
  {selectedScope:'all-disks'},{links:'trusted-junction'},
  {cancelled:'false'},{revision:'3'}
 ]){
  expect(assessSyntheticReadClaim(session,{...valid,...altered}).reasonCodes).toContain('invalid-contract');
 }
});
test('objetos com protótipos não padrão ou propriedades getter não são aceitos',()=>{
 const nullProto=Object.assign(Object.create(null),valid);
 expect(assessSyntheticReadClaim(session,nullProto).reasonCodes).toContain('invalid-contract');
 const accessor=Object.create(Object.prototype);
 Object.assign(accessor,valid);
 Object.defineProperty(accessor,'consent',{enumerable:true,get(){throw Error('getter would be unsafe')}});
 expect(assessSyntheticReadClaim(session,accessor).reasonCodes).toContain('invalid-contract');
});
test('sessões falsas, clonadas e declaradas como aprovadas são recusadas',()=>{
 for(const fake of [
  {...session},
  JSON.parse(JSON.stringify(session)),
  {...session,nativeHandleIssued:true,accessGranted:true}
 ]){
  const x=assessSyntheticReadClaim(fake as SyntheticReadAdmissionSession,valid);
  expect(x.reasonCodes).toContain('foreign-session');
  expect(x.permittedReadBytes).toBe(0);
 }
});
test('readiness falsa ou filtrada não emite sessão de admissão',()=>{
 expect(()=>createSyntheticReadAdmissionSession({...plan})).toThrow('Plano sintético não emitido');
 const filtered=filterSyntheticValidationReadiness(plan,'origin');
 expect(()=>createSyntheticReadAdmissionSession(filtered as unknown as typeof plan)).toThrow('Plano sintético não emitido');
});
test('sessão legítima não contém nome de arquivo, token, permissão nem revogação enganosa',()=>{
 expect(Object.isFrozen(session)).toBe(true);
 expect(session.scope).toBe('synthetic-design-only');
 expect(session.nativeHandleIssued).toBe(false);
 expect(session.accessGranted).toBe(false);
 const s=JSON.stringify(session)+JSON.stringify(evaluate());
 for(const secret of ['C:\\','/home/','Vehicles/','paint.dds','ambient.ogg','synthetic-entry','token','eeeeeeee']){
  expect(s).not.toContain(secret);
 }
});
test('resultados e motivos são imutáveis e idempotentes',()=>{
 const a=evaluate(),b=evaluate();
 expect(Object.isFrozen(a)).toBe(true);
 expect(Object.isFrozen(a.reasonCodes)).toBe(true);
 expect(a).toEqual(b);
 expect(Object.isFrozen(SYNTHETIC_READ_BUDGETS)).toBe(true);
});
test('múltiplas violações aparecem juntas sem virar autorização positiva',()=>{
 const result=evaluate({
  consent:'revoked',selectedScope:'unbounded',requestedAction:'execute',
  containment:'traversal',links:'follow-links',entries:999,cancelled:true
 });
 for(const reason of ['revoked-consent','broad-scope','write-or-execute','traversal-indicated','unsafe-links','resource-limit','cancelled']){
  expect(result.reasonCodes).toContain(reason);
 }
 expect(result.operationsEnabled).toBe(false);
 expect(result.declarationConsistent).toBe(false);
});
