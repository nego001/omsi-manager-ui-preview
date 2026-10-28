// Explain fixed, CI-matched ZIP fixture counts. No parser, disk, network,
// IPC, install permission, real-game evidence, confidence score or verdict.
// The complete schema remains intentionally count-only.
export type FixtureExampleCounts=Readonly<{
 fixtureCount:number;declared:number;withinOwn:number;
 otherCandidate:number;ambiguous:number;unresolved:number;
 unsafe:number;unsupported:number;
}>;
type Category='unsafe'|'ambiguous'|'unresolved'|'unsupported'|'otherCandidate'|'withinOwn';
export type FixtureTriageItem=Readonly<{
 category:Category;count:number;
 level:'fixture-blocker'|'needs-review'|'informational';
 title:string;explanation:string;nextCheck:string;
}>;
export type FixtureTriage=Readonly<{
 state:'demonstration-unverified';source:'python-ci-fixtures';
 summary:string;items:readonly FixtureTriageItem[];
 inspectedRealFiles:false;compatibilityVerified:false;
 dependenciesVerified:false;canInstall:false;
}>;
const rules:ReadonlyArray<Readonly<{
 category:Category;level:FixtureTriageItem['level'];
 title:string;explanation:string;nextCheck:string;
}>>=[
 {category:'unsafe',level:'fixture-blocker',
  title:'Caminho recusado pelo contrato fictício',
  explanation:'A referência possui um caminho que o laboratório não aceita. Não é prova de malware.',
  nextCheck:'Um leitor real isolado precisará verificar o caminho sem segui-lo.'},
 {category:'ambiguous',level:'needs-review',
  title:'Mais de um pacote declara o mesmo destino',
  explanation:'O laboratório não escolhe qual arquivo prevalecerá nem deduz ordem de carregamento.',
  nextCheck:'Verificar regras do simulador e prioridade real de arquivos, sem sobrescrever nada.'},
 {category:'unresolved',level:'needs-review',
  title:'Referência não encontrada nos pacotes fornecidos',
  explanation:'O arquivo não foi encontrado nos ZIPs fictícios comparados. Pode haver dependência fora da amostra.',
  nextCheck:'Conferir futuramente os recursos exigidos e pacotes complementares em leitura segura.'},
 {category:'unsupported',level:'needs-review',
  title:'Referência não reconhecida pelo dialeto de teste',
  explanation:'O tipo declarado está fora do conjunto restrito de referências do laboratório.',
  nextCheck:'Ampliar a gramática somente com exemplos e testes de formato confiáveis.'},
 {category:'otherCandidate',level:'informational',
  title:'Possível fornecedor em outro ZIP fictício',
  explanation:'Há apenas correspondência de caminho com um único outro pacote de teste.',
  nextCheck:'Conferir formato, versão e funcionamento real antes de confirmar dependência.'},
 {category:'withinOwn',level:'informational',
  title:'Referência localizada no próprio ZIP fictício',
  explanation:'A presença nominal não verifica se o arquivo possui conteúdo utilizável.',
  nextCheck:'Validar internamente o formato e suas relações em um leitor seguro futuro.'}
];
const keys=['withinOwn','otherCandidate','ambiguous','unresolved','unsafe','unsupported'] as const;
export function buildFixtureTriage(input:FixtureExampleCounts):FixtureTriage{
 if(!input||typeof input!=='object'||
    !Number.isSafeInteger(input.fixtureCount)||input.fixtureCount<2||input.fixtureCount>4||
    !Number.isSafeInteger(input.declared)||input.declared<0||input.declared>512||
    keys.some(key=>!Number.isSafeInteger(input[key])||input[key]<0||input[key]>512)||
    keys.reduce((count,key)=>count+input[key],0)!==input.declared)
  throw Error('FIXTURE_TRIAGE_INVALID');
 const items=rules.filter(rule=>input[rule.category]>0).map(rule=>
  Object.freeze({
   category:rule.category,count:input[rule.category],level:rule.level,
   title:rule.title,explanation:rule.explanation,nextCheck:rule.nextCheck
  })
 );
 const leading=items[0];
 const summary=leading?
  (leading.level==='fixture-blocker'?
   'A demonstração contém referências recusadas pelo controle sintético.':
   leading.level==='needs-review'?
   'A demonstração exige revisão; não existe resolução automática confiável.':
   'A demonstração mostra correspondências nominais, não verificações reais.'):
  'Nenhuma referência declarada no exemplo. Isso não confirma segurança ou compatibilidade.';
 return Object.freeze({
  state:'demonstration-unverified' as const,
  source:'python-ci-fixtures' as const,
  summary,items:Object.freeze(items),
  inspectedRealFiles:false as const,compatibilityVerified:false as const,
  dependenciesVerified:false as const,canInstall:false as const
 });
}
