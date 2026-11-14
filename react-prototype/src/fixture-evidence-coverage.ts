// In-memory evidence COVERAGE for explicitly fabricated, CI-reviewed ZIP examples.
// No filesystem, hashes, game reader, permissions, installation or execution.
import {buildFixtureTriage,type FixtureExampleCounts} from './fixture-diagnostic-guidance';
export type FixtureCoverageInput=FixtureExampleCounts&Readonly<{
 inspectedSources:number;notInspectedSources:number;
}>;
export type FixtureReviewStep=Readonly<{
 id:'gate'|'text-limit'|'unsafe'|'ambiguous'|'missing'|'candidate'|
    'unsupported'|'real-reader';
 status:'ci-fixture-checked'|'needs-evidence'|'fixture-blocked';
 text:string;reason:string;
}>;
export type FixtureCoverage=Readonly<{
 source:'python-ci-created-zip-bytes';scope:'synthetic-only';
 inspectedSources:number;notInspectedSources:number;
 nominalMatches:number;candidateReferences:number;
 unresolvedReferences:number;ambiguousReferences:number;
 refusedPathHints:number;unsupportedHints:number;
 unknownReferencesPossible:boolean;
 actions:readonly FixtureReviewStep[];
 realFilesInspected:false;gameCompatibilityVerified:false;
 dependencyVerificationComplete:false;installAllowed:false;
}>;
const limits=128*4;
export function buildFixtureCoverage(input:FixtureCoverageInput):FixtureCoverage{
 buildFixtureTriage(input);
 if(!Number.isSafeInteger(input.inspectedSources)||
    !Number.isSafeInteger(input.notInspectedSources)||
    input.inspectedSources<0||input.notInspectedSources<0||
    input.inspectedSources+input.notInspectedSources>limits||
    input.inspectedSources+input.notInspectedSources>input.fixtureCount*128||
    input.inspectedSources+input.notInspectedSources===0&&input.declared!==0)
  throw Error('FIXTURE_COVERAGE_INVALID');
 const steps:FixtureReviewStep[]=[
  {id:'gate',status:'ci-fixture-checked',
   text:'Cabeçalhos ZIP, limites e CRC dos exemplos',
   reason:'Checagem realizada nos bytes fictícios gerados pela CI, não em arquivos reais.'}
 ];
 if(input.notInspectedSources>0)steps.push({
  id:'text-limit',status:'needs-evidence',
  text:'Fontes textuais fora do alcance do leitor restritivo',
  reason:'Não contar referências não inspecionadas como ausentes ou inexistentes.'
 });
 if(input.unsafe>0)steps.push({
  id:'unsafe',status:'fixture-blocked',
  text:'Reavaliar referências com caminhos recusados',
  reason:'O contrato fictício rejeitou o caminho. Isso não é diagnóstico de malware.'
 });
 if(input.ambiguous>0)steps.push({
  id:'ambiguous',status:'needs-evidence',
  text:'Distinguir candidatos duplicados sem escolher automaticamente',
  reason:'Faltam evidências das regras de carregamento e compatibilidade do jogo.'
 });
 if(input.unresolved>0)steps.push({
  id:'missing',status:'needs-evidence',
  text:'Procurar dependências complementares numa futura inspeção autorizada',
  reason:'Ausência na amostra não demonstra ausência na instalação real.'
 });
 if(input.otherCandidate>0)steps.push({
  id:'candidate',status:'needs-evidence',
  text:'Conferir conteúdo e versão do possível pacote fornecedor',
  reason:'Um nome coincidente não comprova que o arquivo possa ser usado.'
 });
 if(input.unsupported>0)steps.push({
  id:'unsupported',status:'needs-evidence',
  text:'Validar o formato antes de ampliar o parser',
  reason:'Marcadores desconhecidos ficam não verificados.'
 });
 steps.push({
  id:'real-reader',status:'needs-evidence',
  text:'Leitura real isolada e verificação de compatibilidade',
  reason:'Ainda não existe autorização para inspecionar mods reais ou instalá-los.'
 });
 return Object.freeze({
  source:'python-ci-created-zip-bytes' as const,
  scope:'synthetic-only' as const,
  inspectedSources:input.inspectedSources,notInspectedSources:input.notInspectedSources,
  nominalMatches:input.withinOwn,candidateReferences:input.otherCandidate,
  unresolvedReferences:input.unresolved,ambiguousReferences:input.ambiguous,
  refusedPathHints:input.unsafe,unsupportedHints:input.unsupported,
  unknownReferencesPossible:input.notInspectedSources>0,
  actions:Object.freeze(steps.map(step=>Object.freeze(step))),
  realFilesInspected:false as const,gameCompatibilityVerified:false as const,
  dependencyVerificationComplete:false as const,installAllowed:false as const
 });
}
