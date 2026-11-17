# OMSI Manager | M35 — Limite de capacidades do kernel e PR_CAPBSET_READ

**Branch:** `feat/ubuntu24-capbset-kernel-boundary-v1`  
**Base:** PR #39/M34. **Draft, sem merge, sandbox intacto.**

## Evidências que justificam esta etapa

A [CI M34 #44011766197](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44011766197)
terminou com **18/19 jobs aprovados**. O único job reprovado
foi `Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)`.
O job separado de diagnóstico real **passou**, gerando com o mesmo
pacote CI os relatórios M33 e M34, após a correção do ciclo de
importação do JavaScript.

Na execução real, o diagnóstico M34 encontrou:

- 23 syscalls selecionadas sob strace; 20 `prctl`;
- 12 operações `PR_CAPBSET_READ`, sendo **8 com `EINVAL`**;
- 1 `PR_SET_NO_NEW_PRIVS`, com **0 falhas registradas**;
- 0 `PR_SET_SECCOMP` e 0 `PR_GET_SECCOMP`;
- 1 chamada com `CLONE_NEWUSER` explícito, **sem EPERM/EACCES**;
- 1 marcador de `SIGTRAP`, **sem causa comprovada**.

Em paralelo, o probe de host **fora do strace** confirmou a
restrição AppArmor para user namespaces ligada e a tentativa
`unshare --user` classificada como `permission-denied`.

Isso torna impreciso tratar os **oito `EINVAL`** como se fossem
oito chamadas negadas pelo AppArmor. `PR_CAPBSET_READ` consulta
uma capacidade do kernel; com um índice fora do conjunto
reconhecido, um retorno `EINVAL` é compatível com a API,
mas a causa específica no processo observado ainda precisa
ser verificada.

## Contrato M35

`react-prototype/scripts/auto-x11-capbset-boundary.mjs`
interpreta o **mesmo trace** obtido pelo M33/M34, sem executar
outro Electron ou modificar o host:

1. Lê somente o número público do kernel em
   `/proc/sys/kernel/cap_last_cap`, com tipo, formato e faixa
   conservadora validados (0–1024).
2. Para cada chamada completa `prctl(PR_CAPBSET_READ, ...)`,
   tenta obter o **índice numérico literal** da capacidade.
3. Compara o índice com o limite inclusivo do kernel e distribui
   contagens em índices dentro do limite, fora do limite ou
   **não decodificáveis**.
4. Conta separadamente o `EINVAL` em cada grupo e exige
   igualdade com os totais observados pelo próprio M34.
5. Para argumentos simbólicos, anotações de strace não
   decodificáveis ou campos ausentes, registra **desconhecido**.
   Não adivinha números a partir de nomes `CAP_*` nem usa
   campos privados do host.
6. Expõe somente contagens, estado e o limite público do kernel,
   nunca argumentos brutos, PIDs, caminhos, tokens ou traces.

O relatório pode classificar:

- `outOfRangeCapReadEINVALPatternObserved`: `EINVAL` observado
  apenas para índices numéricos acima do limite, padrão
  **compatível**, não comprovadamente causal;
- `inRangeCapReadEINVALRequiresInvestigation`: houve `EINVAL`
  em índices dentro do limite, exigindo investigação adicional;
- `symbolicCapabilityOperandsNeedIndependentDecode`: não é
  possível interpretar todos os índices do trace;
- `noCapReadEINVALObserved`: nenhuma ocorrência `EINVAL` no
  conjunto analisado.

Os **16 testes adversariais sintéticos** cobrem índices dentro/fora,
hexadecimal, limite inclusivo, dados desconhecidos, registros
truncados, incompatibilidade de contagens M34, excesso de tamanho,
formato de kernel inválido, sigilo e falsas liberações.

## Restrições que NÃO são modificadas

Mesmo uma correspondência perfeita entre `EINVAL` e índices
fora do limite **não prova que isso causou `SIGTRAP`**. A
observação também continua sob `ptrace`, que pode alterar o
comportamento temporal.

Todas as saídas mantêm:

- `invalidIndexRootCauseIndependentlyProven=false`
- `EINVALImpliesAppArmorDenial=false`
- `EINVALCausedSIGTRAP=false`
- `apparmorCausesSIGTRAPProven=false`
- `rendererSandboxCertified=false`
- `strictUbuntu24NativeGatePassed=false`
- `nativeGateWaived=false`
- `policyChanged=false`
- `realModRead=false`
- `mergeAuthorized=false`
- `releaseAuthorized=false`
- `installationAuthorized=false`

A coleta real é adicional ao job obrigatório Ubuntu 24.04 X11.
Nenhuma política AppArmor é escrita, nenhum `sysctl` modificado,
nenhum teste é marcado `continue-on-error`, e nenhum
`--no-sandbox` é usado.

O projeto e as PRs permanecem Draft, e a
[issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
continua bloqueando a homologação e instalação. A confirmação
causal do problema ainda depende de ensaio externo autorizado com
VM descartável, política específica de aplicativo, rollback e prova
real do confinamento dos renderizadores.
