# OMSI Manager | M41 — Janela X11 atribuída ao Electron direto

**Branch:** `feat/ubuntu22-24-owned-x11-window-witness-v1`  
**Base:** PR #45/M40. **Draft; sem merge, release ou mod real.**

## Resultado real anterior: M40

A [CI M40 #44144359770](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44144359770)
terminou com **21 de 22 jobs aprovados**. O único job reprovado
foi a verificação **obrigatória** de janela real do Ubuntu 24.04
sob sandbox estrito.

Os dois diagnósticos diretos do **mesmo pacote Linux da CI**,
cada um no seu runner, sem `strace` ou desativação de sandbox,
terminaram assim:

| Runner | Saída direta | Comprova janela pelo M40? |
|---|---|---|
| Ubuntu 22.04 | `SIGKILL` pelo limite de 7,5 segundos, `timedOut=true` | **Não** |
| Ubuntu 24.04 | `SIGTRAP`, sem timeout | **Não** |

O comparador informou `oneOrBothRunnerObservationsTimedOut`.
Uma aplicação que permaneceu aberta por sete segundos **pode estar
exibindo uma janela ou não**. Timeout não deve virar aprovação.

O teste nativo separado da CI já **passa** no 22.04 e **falha**
no 24.04, mas não é a mesma observação do executável direto.

## Objetivo do M41

Medir, **no mesmo processo direto do M40**, se foi realmente
observada uma janela X11 pertencente ao executável testado,
visível e com dimensões utilizáveis.

O módulo
`react-prototype/scripts/auto-x11-cross-runner-owned-window.mjs`
reutiliza os contratos X11 rigorosos já existentes:

1. Lê `/proc/<pid-do-filho>/cmdline` do **processo criado pela própria CI**;
   exige precisamente `OMSI-Manager-Preview --ozone-platform=x11`.
   Nenhum outro processo ou mod é consultado.
2. Obtém a árvore de janelas do servidor Xvfb temporário via
   `xwininfo -root -tree` e exige exatamente uma janela
   de título `OMSI Manager...`.
3. Consulta via `xprop` a propriedade `_NET_WM_PID` e exige
   igualdade exata com o PID do processo iniciado.
4. Consulta `xwininfo -id` e exige `IsViewable`, com
   dimensões mínimas de 800 × 500 pixels.
5. Confere que o processo ainda estava em execução ao encerrar
   a amostra. Uma janela vista depois do término não é aceita.
6. Expõe **apenas quatro indicadores booleanos**, categorias de
   saída e avisos de limitação — sem PID, caminho, título de
   janela, linha bruta ou conteúdo do executável.

**Limite de confiança:** `_NET_WM_PID` é metadado de X11
informado por cliente, não uma identidade autenticada
criptograficamente. A amostra é útil para o ambiente de CI,
mas não certifica isoladamente a segurança de renderizadores
nem substitui o gate nativo estrito.

## Integração de CI

Não há outra matriz GitHub Actions. Os jobs explícitos e já
aceitos `m40_direct_ubuntu22` e `m40_direct_ubuntu24`
passam a executar o **mesmo processo M40**, com a janela
observada paralelamente, e instalar somente `x11-utils`
além do Xvfb existente.

Cada job emite dois JSON sanitizados da **mesma execução**:

- `m40-direct-<runner>.json`: código/sinal/timeout;
- `m41-window-<runner>.json`: identidade/processo,
  título, PID proprietário e janela mapeada.

O job comparador já existente baixa os quatro JSON e exige:

- dois registros M40 válidos, com runner e ordem precisos;
- exatamente dois testemunhos M41, cada um com campos fixos;
- código/sinal/timeout M41 compatíveis com o M40 correspondente;
- categoria M41 recalculada, sem falsas provas de sandbox;
- nenhuma alegação de liberação, política alterada ou mod real.

A ausência de qualquer relatório falha **fechado**.

## Resultados possíveis

- `ubuntu22OwnedMappedDirectWindowWhileUbuntu24SIGTRAPNoMappedWindow`:
  o 22.04 teve janela atribuída ao processo e mapeada, enquanto o
  24.04 terminou em SIGTRAP sem essa janela.
- `ubuntu22DirectWindowUnverifiedWhileUbuntu24SIGTRAP`:
  a janela direta no 22.04 não pôde ser comprovada, embora o
  24.04 tenha apresentado SIGTRAP.
- `bothRunnersOwnedMappedWindowsObserved`:
  ambos apresentaram uma janela durante o teste direto,
  **sem certificar sandbox**.
- `crossRunnerDirectWindowEvidenceIncomplete`: outros casos,
  sem conclusão de correspondência.

## Testes e bloqueios

Há **22 testes sintéticos adversariais M41**, que incluem
falsos títulos, propriedades `_NET_WM_PID` incompatíveis,
janela não mapeada, geometria insuficiente, argumentos perigosos
na linha de comando, sinais falsificados, timeout, documentos
ausentes, discrepâncias M40/M41 e vazamento de dados.

O teste obrigatório `native_auto_x11` 22.04/24.04 permanece
**inalterado**, falhando no 24.04 até evidência real de aprovação.

Os seguintes campos continuam falsos:

- `independentRendererSandboxVerified=false`
- `fullNativeX11AutoGateCertifiedByThisWitness=false`
- `strictUbuntu24NativeGatePassed=false`
- `strictNativeGateWaived=false`
- `apparmorCausalityProven=false`
- `hostPolicyChanged=false`
- `sandboxBypassApplied=false`
- `realModRead=false`
- `mergeAuthorized=false`
- `releaseAuthorized=false`
- `installationAuthorized=false`

Não há mudança no AppArmor, sysctl, privileges, jogo do usuário,
arquivos reais do OMSI ou `main`. A
[issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
continua bloqueante, exigindo análise administrativa e prova
independente de confinamento antes de qualquer merge/instalação.
