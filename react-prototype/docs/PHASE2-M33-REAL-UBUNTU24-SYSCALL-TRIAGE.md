# OMSI Manager | M33 — Diagnóstico real de syscalls e SIGTRAP no Ubuntu 24.04

**Branch:** `feat/ubuntu24-real-syscall-sigtrap-triage-v1`  
**Base:** PR #37 / M32. **Draft, sem merge, release ou instalação.**

## Motivo

O M32 terminou com uma suíte de dados artificiais de custódia
aprovada. A falha relevante de homologação, porém, continua no
Ubuntu 24.04: o controle `xmessage` mapeia uma janela X11, a
tentativa de criar user namespace retorna `permission-denied`,
e tanto o launcher Auto quanto o Electron empacotado direto têm
`SIGTRAP` antes de validar uma janela. Ubuntu 22.04 passa.

A comparação entre os dois sistemas **não demonstra causalidade
AppArmor**. O M33 acrescenta uma verificação nova e efetivamente
executada no runner Linux: observar de maneira limitada as respostas
de chamadas de sistema de **um Electron real empacotado pela própria
CI**. É um diagnóstico, não um piloto administrativo.

## Execução real de CI prevista

O job independente `ubuntu24_syscall_triage`:

1. Espera o build, usa um runner **Ubuntu 24.04 descartável** e baixa
   o mesmo pacote Linux unsigned produzido pela CI.
2. Recalcula/verifica SHA-256, aplica o guard de arquivo controlado e
   extrai somente o pacote da **própria prévia CI**. Não lê qualquer
   mod, jogo instalado ou arquivo do usuário.
3. Executa 14 testes adversariais do parser sobre **linhas strace
   artificiais**, além do job de testes rápidos em Ubuntu 22.04.
4. Instala somente as ferramentas de observação `strace` e `xvfb`
   nesse runner descartável. **Não escreve nem carrega uma política de
   AppArmor, não modifica sysctl e não altera capacidades.**
5. Usa um Xvfb separado e uma HOME temporária sem credenciais;
   executa diretamente `OMSI-Manager-Preview` com a opção padrão
   `--ozone-platform=x11`, **sem argumentos de desativação de sandbox**.
6. O strace observa unicamente as famílias de chamadas
   `clone`, `clone3`, `unshare`, `setns`, `prctl` e
   `seccomp`, além dos sinais SIGTRAP/SIGSYS. A execução tem limite
   curto, tamanho e número de arquivos temporários restritos.
7. Reduz os arquivos temporários a **contagens e categorias**
   `EPERM`, `EACCES`, `ENOSYS`, `EINVAL`, `EAGAIN` e os
   marcadores de `SIGTRAP`. O conteúdo bruto não é impresso,
   anexado como artefato nem retornado pelo classificador.
8. Apaga os arquivos temporários ao final, inclusive em caso de
   falha da classificação. Falha de tracing ou ausência de chamadas
   utilizáveis **não recebe classificação de sucesso**.

### Precaução técnica fundamental

`strace` usa ptrace para acompanhar um processo e isso pode
**alterar a temporização ou o comportamento dos sinais**, inclusive
o contexto de SIGTRAP. A presença de `EPERM` em uma chamada
`clone3` ou `unshare` pode ajudar a entender a sequência
de inicialização, mas **não prova que essa negação provocou o SIGTRAP**
nem distingue automaticamente AppArmor de outros filtros de segurança.

Por isso o relatório sempre marca:

- `traceObserverCanAlterProcessBehavior=true`
- `directNonTracedCrashReplicatedByThisTrace=false`
- `kernelAuditCausalProof=false`
- `apparmorCausesSigtrapProven=false`
- `rendererSandboxVerified=false`
- `nativeX11WindowVerified=false`
- `thisDiagnosticIsMandatoryStrictX11Gate=false`
- `strictUbuntu24GateWaived=false`
- `hostPolicyChanged=false`
- `sandboxBypassApplied=false`
- `mergeAuthorized=false`
- `installationAuthorized=false`

O job de diagnóstico **não substitui nem depende de sucesso** do
gate nativo já existente. O job
`Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)`
continua obrigatório e separado. Uma execução verde do diagnóstico
não transforma sua falha em homologação.

## Contrato, segurança e saída

O módulo `auto-x11-sigtrap-syscalls.mjs` rejeita execução root,
sem `CI`/`GITHUB_ACTIONS`, fora de Linux/Ubuntu 24.04,
sem Xvfb, entrada inesperada, arquivos de trace excessivos ou
dados sem formato. Não aceita qualquer caminho de pacote fornecido
por usuário: o binário é localizado por um caminho fixo da própria
extração CI e validado com `realpathSync`.

A saída usa o prefixo `M33_SYSCALL_CATEGORIES` e um objeto contendo
somente contagens de chamadas e categorias de erro, sem PID,
nomes de usuários, nomes de perfis, caminhos, stdout/stderr bruto
ou trechos de trace. Não existem arquivos de trace enviados ao
GitHub Actions.

## O que ainda falta fora do M33

Mesmo um diagnóstico de kernel mais detalhado não autoriza
intervenção no AppArmor. A
[issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
continua exigindo aprovação administrativa para qualquer piloto A/B/A
numa VM Ubuntu 24.04 descartável, binário de origem e bytes
verificados, política específica limitada, rollback e prova real
de isolamento dos renderizadores, além do **gate estrito nativo verde**.

Nenhuma PR foi mesclada, nenhum mod real lido, nenhum arquivo do
OMSI instalado ou extraído e nenhuma autorização de release emitida.
