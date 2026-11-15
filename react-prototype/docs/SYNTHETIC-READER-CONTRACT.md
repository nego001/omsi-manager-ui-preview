# OMSI Manager | Contrato sintético do leitor cooperativo (v0)

**Estado:** contrato puro em memória, apenas para testes. **Não existe leitor de mods reais, varredura, extração, instalador, autorização de escrita ou identificação validada.** Esta fase não modifica o visual aprovado da Biblioteca/Detalhes.

## O que o código já exercita

Implementação isolada em `src/distributed-reader-contract.ts`; testes em `tests/distributed-reader-contract.spec.ts`.

1. `createSyntheticPlan()` estabelece a ordem obrigatória **gate de contêiner → especialistas**. Este plano é somente declarativo (`executionEnabled: false`): não agenda threads ou processos.
2. O coordenador `coordinateSyntheticEvidence()` recebe até oito relatórios **fictícios** com `contractVersion: 1`, IDs de módulos permitidos, digest hexadecimal **declarado pelo fixture** e sinais sanitizados. Não abre nem calcula hash de pacote algum.
3. Entrada de módulos ausente/incompleta impede conclusão. Bloqueio do gate, falha de contrato, relatório duplicado, digest divergente e sinal com caminho são tratados como **bloqueio**.
4. A identificação de um **jogo candidato** depende de pelo menos dois tipos independentes de indícios, `structure` e `definitions`, e de consenso dos demais sinais. Apenas manifesto e nome de arquivo não bastam.
5. Indícios contraditórios sobre ETS2/ATS/OMSI produzem `ambiguous` e não atribuem destino silenciosamente. Ausência de evidências é `unknown`.
6. `projectSyntheticSnapshot()` entrega a Biblioteca, Diagnóstico, Oficina e Instalador uma projeção do **mesmo snapshot**. Oficina (skins/som) e Instalador continuam sempre indisponíveis, independentemente do estado.
7. Os objetos finais são imutáveis (`Object.freeze`) e a ordem dos relatórios não altera o resultado. Sinais só podem referir jogo e código opaco de evidência; jamais caminho absoluto, trecho de arquivo ou conteúdo bruto.

## O que o snapshot **não** prova

- O `fixtureDigest` é um identificador **declarado** pelo teste, não um SHA-256 de arquivos verificado (`digestVerified: false`).
- `candidate` significa **somente** consenso entre dados fictícios. Não significa mod instalado, seguro, reconhecido de forma confiável, compatível nem pronto para a Oficina.
- `compatibilityVerified`, `installationVerified` e `operationsEnabled` são **sempre false**.
- O gate não executa isolamento real, varredura de container ou verificação de assinaturas. Ele apenas simula como o coordenador deve reagir a futuros resultados de segurança.
- Esta fase não cria IPC, usa Node.js no renderer, não acessa Steam, não lê mods, não toca pastas pessoais e não modifica o programa original.

## Corpus de teste sintético

Contratos cobrem plano gate-first, consenso e permutação determinística, manifesto contraditório ETS2/ATS, ausência ou insuficiência de indícios, módulos faltantes, módulo incompleto, gate bloqueado, digest divergente, relatório duplicado/desconhecido, caminho injetado e projeções de setores com todas as operações bloqueadas.

## Para chegar a uma leitura real, em fase separada

É necessário implementar e homologar contêiner seguro, índices de entrada imutáveis, validadores contra path traversal e links, limites globais de recursos, cancelamento, tempo máximo, sandbox real, SHA-256 calculado com segurança, proveniência autenticada, análise de formatos por jogo, observabilidade e revisão de permissões. Mesmo isso não libera instalação: backup, rollback, plano revalidado e aprovação humana continuam requisitos próprios.

**Regra de integração:** nunca ligar este contrato sintético ao instalador real nem exibir seus candidatos como compatíveis.
