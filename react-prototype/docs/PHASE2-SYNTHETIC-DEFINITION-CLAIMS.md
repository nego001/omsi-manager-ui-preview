# Fase 2 / M2 | Declarações sintéticas de definições por jogo

**Escopo:** laboratório puro de memória no ramo `feat/synthetic-definition-claims-v1`, PR empilhada sobre o M1. Nenhuma leitura real de mods, extração de ZIP/SCS, execução de código externo, IPC novo ou acesso ao disco/Steam.

## Por que esta etapa existe

O M1 fornece pistas a partir de **estrutura** de um índice fictício. O coordenador já exige evidências de **definições** vindas de outro especialista. O M2 implementa a admissão das declarações desse segundo módulo, sem fingir que lemos de fato o conteúdo de um arquivo.

`validateSyntheticDefinitionClaims(index, claims)` exige um índice emitido pelo gate e cada declaração do fixture contendo `handle`, `marker` e ticket opaco vinculado à revisão e ao módulo de definições. Metadados declarados de nome/extensão, por si sós, **não geram fatos automaticamente**.

| Marcador explícito do fixture | Entrada permitida do índice sintético | Jogo declarado apenas para teste |
| --- | --- | --- |
| `omsi-bus-definition` | raiz `vehicles` + sufixo `.bus` | OMSI 2 |
| `ets2-vehicle-definition` | raiz `def` + sufixo `.sii` | ETS2 |
| `ats-vehicle-definition` | raiz `def` + sufixo `.sii` | ATS |

**Atenção:** os marcadores são rótulos **escritos nos fixtures de teste**, não evidências lidas do conteúdo de um mod. O mesmo `.sii` poderia receber o rótulo ETS2 ou ATS em cenários fictícios separados. Identificar ETS2 ou ATS de verdade exigirá especialistas de formato e leitura segura de conteúdo, que ainda não existem.

## Regras de segurança do contrato

- Máximo de quatro declarações; apenas campos exatos; nenhuma string com caminho completo como evidência.
- Entrada precisa ser `file`, estar na visão do especialista `definitions` e corresponder ao par de raiz/sufixo do marcador; handles arbitrários, clonados ou fora da visão não contam.
- Cada observação exige um ticket de revisão do índice atual. Outro índice com digest e handle textual idênticos **não** valida um ticket antigo.
- Declarações duplicadas/contraditórias no mesmo handle provocam rejeição completa, sem evidências parciais.
- A ausência de fatos é `incomplete`, **nunca** inferência silenciosa de jogo.
- A ordem dos fixtures não afeta a publicação; nenhum nome de arquivo, caminho pessoal ou conteúdo bruto é retornado.
- O coordenador existente `runSyntheticIndexedWorkers` combina M1 e M2; se os demais módulos estiverem ausentes, a análise é incompleta; se estrutura OMSI e definição ETS2 divergirem, o estado é ambíguo.
- O estado `candidate` em todos os módulos fictícios concordantes continua **somente sintético**. `digestVerified`, `gameVerified`, `compatibilityVerified`, `installationVerified` e `operationsEnabled` não são certificados por esta etapa.

## Bloqueios e sequência futura

Não conectar este módulo à interface para declarar compatibilidade; não abrir arquivos reais; não instalar, converter ou modificar mods. PR #1 (Biblioteca) e PR #5 (M1) permanecem Draft; issue #4 Ubuntu 24.04 X11 strict sandbox continua bloqueando a homologação/release.

Próximo passo técnico: contrato de observações reais independente de sufixo, com verificação segura de contêiner, autenticação do digest e origem, parser específico por simulador e limites de recursos. A mudança de motor para leitura real exigirá novo gate e auditoria.
