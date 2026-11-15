# Fase 2 / M1 | Pistas estruturais sintéticas para identificação de mods

**Ramo:** `feat/synthetic-identification-hints-v1`, separado da Biblioteca v1. **Escopo: somente fixtures de memória.** Não abrir arquivos, ZIP/SCS, pastas ou jogos; não executar código externo; não publicar conclusão real de compatibilidade ou instalação.

## Estado que herdamos

- A Biblioteca/Detalhes v1 foi encerrada como **marco funcional de interface**, com 1.053/1.053 testes Playwright aprovados em duas CIs no commit `9d8bbbc` (15/11/2026).
- O aplicativo **não está homologado**: Ubuntu 24.04 X11 com sandbox Electron estrito reprovou nas duas CIs, issue #4. A PR #1 permanece Draft, sem merge/release.
- Já existiam `distributed-reader-contract.ts`, `synthetic-package-index.ts` e `synthetic-index-workers.ts`. Este incremento **reutiliza esses contratos**, não inventa outro leitor.

## O primeiro especialista com regras estruturais

`deriveSyntheticStructureHints(index)` recebe **somente** o índice sintético emitido pelo gate, com raízes, sufixos e handles opacos (não há caminho completo no índice público).

| Sinal no índice fictício | Pista permitida | Limitação |
| --- | --- | --- |
| `vehicles/*.bus` | `omsi-vehicles-bus` | Apenas indício estrutural OMSI |
| `sceneryobjects/*.sco` | `omsi-sceneryobjects-sco` | Apenas indício estrutural OMSI |
| `splines/*.sli` | `omsi-splines-sli` | Apenas indício estrutural OMSI |
| `.scs` ou `def/*.sii` | Contagem de indícios de formato compartilhado | Não diferencia ETS2/ATS e **não emite candidato** |

As pistas produzem uma **declaração de estrutura** com tickets de revisão associados ao próprio índice. Uma regra gera no máximo uma observação, independentemente de quantos arquivos de exemplo existam. Os nomes completos não saem do índice.

**Por que não chamar isso de detector pronto?** O contrato coordenador exige relatórios independentes de definições e módulos adicionais para chegar ao estado `candidate`, e mesmo um `candidate` seria fictício. O motor novo nunca lê o conteúdo de um `.bus`, `.sii` ou pacote; não confirma jogo, versão, autoria, integridade, mídia, segurança ou compatibilidade.

## Aceitação do marco

Testes sintéticos verificam pistas OMSI, ausência de classificação a partir de extensão `.scs` e `.sii`, isolamento dos tickets, proteção contra índice forjado, ordem determinística, não exposição de nomes e nenhuma operação habilitada.

**Próxima fase técnica:** projetar adaptadores reais de leitura *somente depois* de gate de segurança, teste de limite de recursos, inspeção por permissão explícita, sandbox independente, evidência autenticada e corpus específico por jogo. Tudo isso permanece **fora de escopo** deste marco; nenhuma liberação do aplicativo é autorizada.
