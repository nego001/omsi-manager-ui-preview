# OMSI Manager | M40 — Comparação direta Ubuntu 22.04 x 24.04 sem ptrace

**Branch:** `feat/ubuntu22-24-untraced-exit-parity-v1`  
**Base:** PR #44/M39. **Draft; não mesclar, instalar ou liberar.**

## Evidência real de partida

Na [CI do M39 #44142097527](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44142097527),
o job diagnóstico Ubuntu 24.04 registrou:

- `M39_UNTRACED_SIGTRAP_REPEATABILITY.status=fourNonPtraceSIGTRAPSignalsObserved`;
- quatro processos Electron distintos, com três HOME/XDG adicionais;
- `SIGTRAP=4`, `timeout=0`, outros sinais e códigos de saída = 0;
- mesmo runner, mesmo kernel, mesmo pacote da CI, mesmo Xvfb;
- nenhum `strace` nas quatro execuções diretas.

A repetição real mostra um padrão persistente **no mesmo ambiente**.
O teste obrigatório X11 estrito no Ubuntu 24.04 continua uma condição
bloqueante e independente; nenhuma execução diagnóstica o substitui.
Ainda não há prova causal da origem do SIGTRAP nem de isolamento
do renderer Chromium.

## Nova pergunta do M40

O mesmo pacote da CI, executado **sem ptrace**, apresenta que
categoria de encerramento em Ubuntu 22.04 e Ubuntu 24.04?

O M40 acrescenta **dois jobs diagnósticos explícitos**, sem criar outra matriz GitHub Actions além do job nativo original:

`m40_direct_ubuntu22` no `ubuntu-22.04` e `m40_direct_ubuntu24` no `ubuntu-24.04`.

Cada runner:

1. Faz checkout do mesmo commit sem salvar credenciais.
2. Baixa **o único artefato Linux unsigned criado pelo job build**.
3. Verifica `sha256sum -c`, aplica o guard de estrutura do archive,
   e extrai exclusivamente o executável da prévia CI em ambiente
   descartável. Não acessa ou extrai mods OMSI.
4. Valida os contratos adversariais do coletor.
5. Instala `xvfb` apenas no runner descartável; não altera
   AppArmor, sysctl ou o sandbox do Chromium.
6. Executa o pacote diretamente, como usuário não root, com
   `--ozone-platform=x11`, sem `strace` nem `--no-sandbox`,
   usando HOME/XDG temporários e tempo limitado.
7. Descartará stdout e stderr, encerrará o grupo do processo e
   registrará **apenas** o código, sinal e timeout em categorias
   sanitizadas no arquivo JSON da própria CI.
8. Publica exclusivamente esse JSON com retenção de sete dias.

O job `m40_cross_runner_compare` tenta baixar **os dois JSON
sanitizados** e exige exatamente um resultado de cada runner,
na ordem 22.04/24.04. Se qualquer resultado faltar, se houver
metadado extra, se o status não coincidir com o código/sinal ou se
um campo alegar autorização/sandbox, o comparador **recusa**.
Os estados incluem:

- `ubuntu24SIGTRAPAndUbuntu22DifferentDirectExit`;
- `bothLinuxRunnersDirectSIGTRAP`;
- `ubuntu22DirectSIGTRAPButUbuntu24Not`;
- `neitherDirectRunnerTerminatedWithSIGTRAP`;
- `oneOrBothRunnerObservationsTimedOut`.

**Importante:** timeout no Ubuntu 22.04 não comprova janela mapeada
nem sandbox saudável. Mesmo resultados diferentes entre runners
não provam AppArmor como causa: as imagens de sistema diferem
em múltiplos componentes e as observações são de processos diferentes.

## Escopo dos testes

Os **18 testes M40** incluem negação de dado forjado, incompatibilidade
de runner, resultado duplicado/ausente, sinal versus código 133,
timeout, ausência de artefato autenticado, falso sandbox saudável,
falsas permissões de release, dados de usuário e invocação fora da
CI. Executam no job rápido e em cada runner de diagnóstico.

O job nativo obrigatório `native_auto_x11` permanece **intocado**,
com Ubuntu 22.04 e 24.04 estritos, e sua falha não é mascarada.
Os dois jobs novos são somente observacionais e NÃO cria independentemente
prova de integridade dos bytes a partir de dois fornecedores; o
checksum é conferido por cada runner com base no mesmo archive CI.

Todos os relatórios mantêm:

- `rendererSandboxIndependentlyVerified=false`
- `actualX11WindowMappedMeasured=false`
- `signalReproducesCausalAppArmorDenial=false`
- `kernelCapabilityQueryCausesCrashProven=false`
- `nativeUbuntu24StrictGatePassed=false`
- `strictNativeGateWaived=false`
- `apparmorPolicyChanged=false`
- `sysctlChanged=false`
- `sandboxBypassApplied=false`
- `realOMSIModRead=false`
- `mergeAuthorized=false`
- `releaseAuthorized=false`
- `installationAuthorized=false`

A [issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
continua bloqueando a homologação, instalação e release até
validação administrativa apropriada e teste estrito nativo verde.
