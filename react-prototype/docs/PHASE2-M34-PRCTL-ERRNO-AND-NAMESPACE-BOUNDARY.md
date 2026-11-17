# OMSI Manager | M34 — Contexto dos erros PRCTL e negações de namespace

**Branch:** `feat/ubuntu24-prctl-errno-context-v1`  
**Base:** PR #38/M33. **Draft; sem merge, instalação ou alteração do host.**

## Resultado REAL do M33

A CI [#43872924292](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43872924292)
concluiu **18/19 jobs aprovados**, falhando exclusivamente em
`Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)`.
O job separado de rastreamento em Ubuntu 24.04 terminou SUCCESS,
observando o mesmo pacote Linux da CI, com checksum verificado
antes da execução.

Relatório público `M33_SYSCALL_CATEGORIES`:

| Categoria observada pelo strace | Quantidade |
|---|---:|
| Chamadas monitoradas | 24 |
| `clone` | 2 |
| `clone3` | 1 |
| `unshare` / `setns` | 0 / 0 |
| `prctl` | 21 |
| `seccomp` | 0 |
| `prctl` retornando `EINVAL` | 8 |
| Chamadas com `EPERM` observadas | 0 |
| Marcadores `SIGTRAP` | 1 |
| Arquivos temporários do trace | 4 |

O teste de host **sem strace**, dentro do job X11 estrito,
continua observando `unshare --user --map-root-user` com
categoria `permission-denied`, AppArmor e restrição de userns
habilitados. Isso **não entra em contradição** com a ausência de
`EPERM` nas chamadas selecionadas de um único processo sob ptrace:
são **processos e contextos diferentes**, e uma chamada namespace
pode nem ter sido feita durante esse trace.

## O objetivo do M34

Antes de sugerir uma intervenção de AppArmor, precisamos evitar a
conclusão errada de que **oito `EINVAL` em `prctl` são oito negativas
do kernel para criar user namespaces**.

`react-prototype/scripts/auto-x11-prctl-context.mjs` analisa os
**mesmos dados temporários e limitados** do M33 e:

1. Confirma o formato e os limites do trace usando o próprio validador M33.
2. Classifica os `prctl` observados em operações fixas:
   `PR_SET_NO_NEW_PRIVS`, `PR_GET_NO_NEW_PRIVS`,
   `PR_SET_SECCOMP`, `PR_GET_SECCOMP`,
   `PR_CAPBSET_READ` e `otherPrctl`.
3. Separa o total de `EINVAL` para cada operação, sem publicar
   argumentos de chamada, nomes de processo ou conteúdo bruto.
4. Conta tentativas com flag **literal `CLONE_NEWUSER`** em
   `clone`, `clone3` ou `unshare`. Só classifica como negativa
   explícita nesse trace se a chamada retornar `EPERM` ou
   `EACCES`.
5. Não infere `CLONE_NEWUSER` de flags numéricas sem decodificação
   explícita. Também não confunde `EPERM` de operações de namespace
   diferentes com uma negativa de criação de user namespace.
6. Compara o total de `prctl` e seus `EINVAL` com a saída M33.
   Discrepância ou formato desconhecido não vira sucesso.

Em CI, o job rápido Ubuntu 22.04 verifica **15 testes adversariais
sintéticos** desse classificador. O diagnóstico real Ubuntu 24.04
também os executa e produz um segundo relatório `M34_PRCTL_CONTEXT`
a partir do **mesmo trace já coletado**, sem outra execução do
Electron.

Adicionalmente, o job diagnóstico consulta o probe read-only
`auto-x11-host-capabilities.mjs`, **antes do strace**. Esse probe
apenas lê categorias de política do host e executa a checagem não
privilegiada de criação de user namespace. Não modifica política,
não usa root e não captura stderr bruto.

## Limitações explícitas

Mesmo uma futura observação simultânea de `EPERM` e `SIGTRAP`
**não prova causalidade**. Além disso, `prctl(...)=EINVAL` pode
significar operação/parâmetros inválidos ou tentativa de detectar
capacidades; não deve ser rotulado automaticamente como uma negativa
AppArmor.

As seguintes conclusões permanecem sempre falsas:

- `prctlEINVALIsApparmorDenialProof`
- `prctlEINVALCausesSIGTRAPProven`
- `apparmorCausesSIGTRAPProven`
- `rendererConfinementVerified`
- `strictUbuntu24NativeGatePassed`
- `strictNativeGateWaived`
- `hostPolicyChanged`
- `sandboxBypassApplied`
- `mergeAuthorized`
- `releaseAuthorized`
- `installationAuthorized`

O reporte categoriza apenas informações observáveis. Nenhum hash,
linha bruta de strace, PID, caminho privado ou nome de perfil AppArmor
é impresso ou incluído como artifact. O diretório de trace continua
temporário e é apagado ao finalizar.

## Gate obrigatório permanece

O job `native_auto_x11` **não sofreu alteração** e continua executando
os dois runners Ubuntu 22.04/24.04 com sandbox estrito, sem
`--no-sandbox`, alterações em AppArmor ou `continue-on-error`.
Uma observação informativa verde **não suprime a falha do 24.04**.

A [issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
continua aberta. Uma validação causal de AppArmor ainda precisaria de
administrador autorizado, VM descartável, perfil específico, controle
A/B/A e restauração auditada, prova de confinamento de renderizadores
e um CI estrito realmente aprovado. Nenhuma dessas ações é executada
pelo M34.
