# Fase 2 / M3 | Revisão de independência das evidências sintéticas

**PR empilhada sobre M2.** Sem acesso a pacotes reais, disco, rede, IPC, processos ou operações de escrita. Apenas metadados de fixtures em memória, com índice e relatório emitidos pelos módulos sintéticos existentes.

## Problema identificado

O coordenador sintético exige relatos dos especialistas `structure` e `definitions`, mas duas declarações podem mencionar **o mesmo handle do índice fictício**. Embora venham de módulos distintos, não há duas entradas de origem independentes. Chamar isso de duas provas independentes seria exagerar a confiança da identificação.

## Nova revisão final

`reviewSyntheticIdentification(index, outcome)` exige **proveniência exata**: `index` deve ser o objeto emitido pelo gate sintético, e `outcome` o objeto real emitido pelo coordenador para aquele mesmo índice. Copiar JSON, reconstruir objetos ou reutilizar um outcome de outra revisão não funciona, mesmo com digest textual idêntico.

Se o coordenador já sinaliza `blocked`, `incomplete`, `ambiguous` ou `unknown`, o revisor **não promove** o estado. Quando o coordenador sinaliza `candidate`, o revisor exige ao menos uma entrada em `structure`, outra em `definitions`, **handles distintos sem sobreposição**, e pelo menos duas entradas no conjunto. Se ambos apontam ao mesmo handle, o estado fica `withheld`, com motivo `reused-source-entry`, sem candidato.

O resultado publica somente `state`, `reason`, contagens de entradas e cobertura de módulos, além de um candidato de jogo **exclusivamente fictício** quando permitido. Não publica caminhos completos, nomes privados, dados brutos ou digest. Não há pontuação numérica de confiança.

### Limites

Este controle evita uma classe de **autocorroboração** entre módulos, mas duas entradas distintas do fixture **não provam duas evidências reais**. Qualquer cenário com `candidate` permanece fonte `synthetic-fixture`, com digest/jogo/compatibilidade/instalação **não verificados** e operações sempre desabilitadas. Implementar leitura real exige gate seguro, permissão, identidade do pacote calculada sobre bytes reais, parsers auditados e isolamento.

**Aceitação:** testes sintéticos de mesmo handle, handles independentes, contradição OMSI/ETS2, módulos faltantes, outcome forjado/de outra revisão, sanitização e ausência de evidências. Não integrar ao instalador nem marcar mod real como compatível. PRs #1/#5/#6 e esta permanecem Draft; issue #4 Ubuntu 24.04 X11 strict sandbox continua bloqueando release.
