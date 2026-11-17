# OMSI Manager | M39 — Repetibilidade do SIGTRAP sem rastreador

**Branch:** `feat/ubuntu24-untraced-sigtrap-repeatability-v1`  
**Base:** PR #43 / M38. **Draft, sem merge, instalação ou release.**

## Evidência real do M38

A [CI M38 #44102187546](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44102187546)
concluiu **18/19 jobs aprovados**. O único reprovado foi o
`Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)`.

O diagnóstico no runner Ubuntu 24.04, usando o pacote construído pela
própria CI e com SHA-256 previamente conferido, produziu:

- `M38_UNTRACED_EXIT_CONTROL.status=untracedSIGTRAPConfirmedAsExitSignal`
- `untracedObservedSignal=SIGTRAP`
- `untracedObservedExitCode=null` e `untracedTimedOut=false`
- Um marcador SIGTRAP no processo separado monitorado por `strace`.
- Oito retornos `EINVAL` em `PR_CAPBSET_READ` com índices numéricos
  explicitamente superiores ao limite `cap_last_cap=40`.
- A criação de user namespace ainda tem `permission-denied` no probe
  separado do host, enquanto o processo sob strace não registrou
  negativa explícita de user namespace.

**Logo, SIGTRAP ocorre também sem ptrace.** Mas não há prova de qual
mecanismo causou o SIGTRAP, nem de relação causal com os `EINVAL`.

## Mudança M39

`react-prototype/scripts/auto-x11-untraced-repeatability.mjs`
executa **mais três tentativas SEM strace** usando a função
`runM38UntracedControl` já protegida, no mesmo job descartável do
Ubuntu 24.04, com o mesmo pacote e servidor Xvfb, mas três diretórios
HOME/XDG temporários adicionais.

O relatório `M39_UNTRACED_SIGTRAP_REPEATABILITY` combina a
observação M38 (primeira execução direta) com as três novas tentativas,
totalizando **quatro observações do sinal de saída**.

- Verifica a existência de exatamente três resultados novos e a
  integridade lógica de código de saída, sinal e timeout.
- Distingue `SIGTRAP` real recebido do kernel de código **133**
  sem indicação de sinal (código 133 não comprova SIGTRAP).
- Conta separadamente SIGTRAP, outros sinais, código 133, outros
  códigos de saída e timeout.
- Permite determinar repetibilidade observada; se houver um resultado
  divergente ou timeout, não anuncia quatro SIGTRAP consistentes.
- A execução evita `strace`, não coleta stdout/stderr, preserva o
  sandbox padrão, fica limitada em tempo e encerra grupos de processos
  iniciados. Os diretórios são descartados ao término.
- Não imprime os identificadores dos processos, caminhos temporários,
  hashes, argumentos, dados brutos ou nomes de usuários.

## Estados esperados

- `fourNonPtraceSIGTRAPSignalsObserved`: quatro saídas diretas
  sinalizaram SIGTRAP sem timeout.
- `repeatabilityIncompleteDueToTimeout`: alguma execução excedeu
  seu limite de tempo.
- `mixedUntracedExitOutcomesNeedReview`: houve ao menos um SIGTRAP,
  mas também outros tipos de saída.
- `numericExit133WithoutDirectSIGTRAPSignals`: houve saída 133 sem
  evento SIGTRAP observado e nenhuma saída SIGTRAP explícita.
- `noUntracedSIGTRAPSignalAcrossFourObservations`: nenhuma das
  quatro tentativas terminou com esse sinal.

A saída é composta por **categorias e contagens**, sem raw logs.

## Testes e limitações

São **17 testes adversariais sintéticos M39** no job rápido e no
diagnóstico real. Eles cobrem quatro SIGTRAP, resultados mistos,
timeout, sinais diferentes, código numérico 133, ausência de
evidência, metadados ilegítimos, saída com informações privadas e
recusa da função de execução fora da CI.

Mesmo quatro SIGTRAP não demonstram causalidade AppArmor, seccomp,
capability ou namespace. Todas as tentativas usam um **mesmo
runner, kernel e pacote**, portanto não são quatro máquinas ou
ambientes verdadeiramente independentes. A observação não verifica
janelas X11 e não comprova isolamento de renderizadores.

A matriz nativa X11 Ubuntu 22.04/24.04 permanece intacta, sem
waiver. Todos os resultados mantêm:

- `crossRunnerReproductionVerified=false`
- `rootCauseOfSIGTRAPProven=false`
- `apparmorCausesSIGTRAPProven=false`
- `kernelCapabilityReadExplainsSIGTRAPProven=false`
- `ChromiumRendererSandboxCertified=false`
- `nativeX11WindowVerifiedByThisTest=false`
- `strictUbuntu24NativeGatePassed=false`
- `strictNativeGateWaived=false`
- `hostPolicyChanged=false`
- `sandboxBypassApplied=false`
- `realModRead=false`
- `mergeAuthorized=false`
- `releaseAuthorized=false`
- `installationAuthorized=false`

Não há alteração de política AppArmor, sysctl, privilégios, instalação
de mods reais, `main` ou branch rules. A
[issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
permanece aberta e bloqueante.
