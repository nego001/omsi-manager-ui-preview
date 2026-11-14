import type {RelationIssue} from './relation-analysis';

// Presentation only: the relation analyzer is the single source of issues.
// Guidance cannot change a diagnosis or authorize operations on real files.
export type RelationGuidance={
 group:'Dependências'|'Conflitos'|'Versões';
 heading:string;
 meaning:string;
 nextStep:string;
};
const GUIDANCE:Record<RelationIssue['code'],RelationGuidance>={
 'dependency-missing':{
  group:'Dependências',heading:'Uma dependência não está no catálogo',
  meaning:'O registro aponta para outro mod que não aparece nos metadados carregados. Não sabemos se esse mod existe no computador.',
  nextStep:'Confira o identificador do mod exigido e peça os metadados corretos ao criador antes de planejar qualquer instalação.'
 },
 'different-game':{
  group:'Dependências',heading:'Dependência declarada para outro simulador',
  meaning:'Os registros de catálogo associam a dependência a outro jogo. Pode ser um cadastro incorreto ou uma variante que exige revisão.',
  nextStep:'Confirme a variante e o jogo de destino com o autor. Não reutilize automaticamente um pacote ETS2 em ATS, ou vice-versa.'
 },
 'dependency-cycle':{
  group:'Dependências',heading:'Dependências circulares no catálogo',
  meaning:'A sequência declarada depende dela mesma direta ou indiretamente, então não há ordem de preparação inequívoca.',
  nextStep:'Revise as relações entre IDs no JSON e esclareça com o criador qual componente deve ser a base.'
 },
 'dependency-version-too-low':{
  group:'Versões',heading:'Versão declarada da dependência abaixo do mínimo',
  meaning:'O catálogo informa uma versão da dependência inferior à exigida. A versão instalada no jogo não foi consultada.',
  nextStep:'Confira a versão exigida e a versão declarada na fonte original. Uma atualização real só poderá ser proposta após leitura segura do pacote.'
 },
 'dependency-version-unknown':{
  group:'Versões',heading:'Versão declarada não comparável',
  meaning:'A versão informada não pode ser comparada pela regra numérica do catálogo, sem significar que o arquivo esteja quebrado.',
  nextStep:'Verifique os campos de versão com o autor e evite inferir compatibilidade a partir de texto não normalizado.'
 },
 'game-version-unknown':{
  group:'Versões',heading:'Faixa do jogo declarada, versão não informada',
  meaning:'O catálogo exige uma faixa, mas ainda não há uma versão hipotética informada para simular a comparação.',
  nextStep:'Informe opcionalmente uma versão hipotética do jogo no campo acima. Isso não detecta a versão instalada.'
 },
 'game-version-invalid':{
  group:'Versões',heading:'Formato da versão hipotética não reconhecido',
  meaning:'O texto digitado não segue a convenção numérica suportada pelo simulador de versões.',
  nextStep:'Use apenas segmentos numéricos, como 1.52.0. A comparação continua teórica.'
 },
 'game-version-outside-range':{
  group:'Versões',heading:'Versão hipotética fora da faixa declarada',
  meaning:'A versão digitada não está dentro dos limites informados no JSON. Nenhum arquivo do jogo foi examinado.',
  nextStep:'Confirme os limites declarados pelo criador e a versão-alvo antes de considerar uma atualização; não edite apenas o manifesto.'
 },
 'conflict-in-plan':{
  group:'Conflitos',heading:'Conflito entre registros da mesma sequência',
  meaning:'Dois componentes incluídos na sequência teórica declaram não funcionar juntos. Não sabemos se estão instalados.',
  nextStep:'Revise alternativas e variantes descritas pelo criador. Não copie ambos automaticamente.'
 },
 'declared-conflict':{
  group:'Conflitos',heading:'Conflito potencial com outro mod do catálogo',
  meaning:'Foi declarado um conflito com um registro externo à sequência. A presença ou ativação desse mod no jogo é desconhecida.',
  nextStep:'Confira as informações do autor e o inventário real somente quando existir um leitor autorizado para esse destino.'
 },
 'unknown-conflict':{
  group:'Conflitos',heading:'Referência de conflito precisa de revisão',
  meaning:'O cadastro cita um ID ausente ou um registro de outro jogo. Não há evidência de conflito efetivo no computador.',
  nextStep:'Corrija ou confirme a referência no catálogo com a fonte responsável, mantendo os jogos separados.'
 }
};
export function explainRelationIssue(issue:RelationIssue):RelationGuidance{
 return GUIDANCE[issue.code];
}
export function summarizeRelationIssues(issues:readonly RelationIssue[]){
 const blocking=issues.filter(issue=>issue.severity==='blocking').length;
 const attention=issues.filter(issue=>issue.severity==='notice').length;
 return {blocking,attention,declaredCount:issues.length,realCompatibilityVerified:false as const};
}
