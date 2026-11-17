# OMSI Manager | M37 — índices explícitos anotados como CAP_???

**Branch:** `feat/ubuntu24-annotated-capability-indices-v1`  
**Base:** PR #41 / M36. **Draft, sem merge, release ou instalação de mods.**

## Observação real M36

Na [CI #44092474885](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44092474885),
o diagnóstico do Electron real rodou em Ubuntu 24.04, com o pacote da própria
CI, checksum conferido, sandbox mantido e trace temporário apagado.
**18 dos 19 jobs passaram**. A única falha continua sendo o teste
obrigatório X11 estrito no Ubuntu 24.04.

O M36 publicou `M36_SYMBOLIC_CAPABILITIES` com:

| Dado | Observado |
|---|---:|
| `kernelLastCapabilityIndex` | 40 |
| `totalCapReadCalls` | 12 |
| `totalCapReadEINVAL` | 8 |
| Nomes CAP reconhecidos pelo M36 | 4 |
| Nomes simbólicos/argumentos não reconhecidos | 8 |
| `EINVAL` entre nomes conhecidos | 0 |
| `EINVAL` entre argumentos desconhecidos | 8 |

**Não está provado** que os oito argumentos sejam índices numéricos maiores
que 40 nem que provoquem SIGTRAP. A verificação independente de namespaces
continua retornando `permission-denied` fora do trace; no trace do
Electron instrumentado não se observou uma negação explícita de userns.

## O que o M37 acrescenta

O strace pode imprimir uma capacidade não reconhecida com o número bruto
e uma anotação, por exemplo:

```text
prctl(PR_CAPBSET_READ, 0x29 /* CAP_??? */) = -1 EINVAL
```

O módulo `auto-x11-annotated-capability-indices.mjs` interpreta
**somente** uma chamada completa `PR_CAPBSET_READ` com esse comentário
literal exato, acompanhada de número decimal ou hexadecimal explícito.
Isso não depende de descobrir qual capacidade recebeu um novo nome.

- Reusa o contrato M36, que revalida M35 e M34; as contagens têm que
  continuar batendo com as três etapas anteriores.
- Compara o índice efetivamente expresso na linha com
  `/proc/sys/kernel/cap_last_cap`, já lido de modo estritamente
  somente leitura no M35.
- Classifica índices anotados dentro/acima do limite, com `EINVAL`
  separado para cada grupo.
- Mantém como **desconhecidos** `CAP_???` sem índice, comentários
  adicionais, nomes inventados, números inválidos, valores inseguros
  e formatos não previstos. Não retém o valor individual.
- Mantém status inconclusivo se qualquer `EINVAL` permanecer sem
  índice explícito, em vez de anunciar uma solução parcial como
  comprovação geral.
- Aplica limites de tamanho/herança dos parsers anteriores e registra
  somente categorias, números totais e flags negativas de segurança.

O diagnóstico real do Ubuntu 24.04 agora emite
`M37_CAPABILITY_ANNOTATIONS` imediatamente após M36 com o **mesmo
trace temporário e o mesmo Electron**. Nenhum outro processo é iniciado,
nenhum perfil de segurança é alterado, e nada do trace bruto é enviado
como artefato.

## Interpretando os resultados

- `allUnrecognizedEINVALHaveExplicitAboveBoundIndex`: todos os
  `EINVAL` anteriormente desconhecidos têm um índice explícito
  **maior que o limite**; padrão compatível com uma consulta de
  capacidade inválida, ainda não causalidade sobre SIGTRAP.
- `annotatedInRangeCapabilityEINVALNeedsReview`: ao menos um índice
  explicitamente anotado está dentro do limite e devolve `EINVAL`.
- `someEINVALOperandsStillUnresolved`: sobraram `EINVAL` não
  decodificáveis; a conclusão ainda é parcial.
- `noAnnotatedCapabilityEINVALObserved`: nenhum `EINVAL`
  foi associado a esse formato literal.

**O status favorável significa apenas que a explicação por limite de
índice é compatível com o trace observado.** Não demonstra que o processo
falhou por isso, nem elimina outras restrições como AppArmor ou seccomp.

## Testes

São **16 testes adversariais sintéticos**, cobrindo oito EINVAL com
hexadecimal explícito, decimal, limite inclusivo, valores fora de faixa,
CAP desconhecido sem número, comentários malformados, índice com
anotação falsificada, processos com PID prefixado, linhas incompletas,
falsas liberações, privacidade e divergências de contagens M34–M36.

Integram tanto o job rápido de parser quanto o diagnóstico nativo
Ubuntu 24.04. A matriz X11 estrita permanece separada e obrigatória.

## Invariantes de segurança

Todos os resultados mantêm:
`invalidIndexExplainsSIGTRAPProven=false`,
`apparmorDeniedTheseCallsProven=false`,
`apparmorCausesSIGTRAPProven=false`,
`chromiumRendererSandboxCertified=false`,
`nativeStrictUbuntu24GatePassed=false`,
`nativeGateWaived=false`,
`hostPolicyChanged=false`,
`sandboxBypassApplied=false`,
`mergeAuthorized=false`,
`releaseAuthorized=false` e
`installationAuthorized=false`.

Nenhum arquivo real de OMSI, política AppArmor, sysctl, mod, extração
de pacote do jogo, privilégio root ou mudança da `main` faz parte
desta etapa. A [issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
permanece aberta e bloqueante.
