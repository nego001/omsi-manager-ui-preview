# OMSI Manager | M38 — SIGTRAP sem ptrace, no mesmo runner Ubuntu 24.04

**Branch:** `feat/ubuntu24-untraced-sigtrap-control-v1`  
**Base:** PR #42/M37. **Draft; sem merge, release nem instalação de mod.**

## Evidência que motivou o M38

A [CI M37 #44098567184](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44098567184)
encerrou com **18 de 19 jobs aprovados**, falhando unicamente em
`Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)`.
O diagnóstico real do mesmo pacote Linux, com SHA-256 verificado, revelou:

- Limite do kernel `cap_last_cap=40`.
- Doze consultas `PR_CAPBSET_READ`.
- Quatro nomes de capacidades reconhecidos e dentro do limite, sem `EINVAL`.
- **Oito índices explícitos superiores a 40**, todos retornando
  `EINVAL`, após interpretar a anotação estrita `CAP_???`.
- Nenhuma consulta `PR_CAPBSET_READ` com `EINVAL` ficou sem
  índice identificado nessa execução.
- O trace incluiu um marcador de `SIGTRAP`, mas isso aconteceu
  **sob strace**, que utiliza ptrace e pode alterar o processo.

Índices acima do limite explicam de maneira **compatível** os erros
`EINVAL`. Não se pode concluir que essas consultas causaram
o `SIGTRAP`. O probe separado sem strace ainda mostrou que a
criação de user namespace foi negada; não há prova causal AppArmor.

## A nova comparação M38

O módulo `auto-x11-untraced-exit-control.mjs` executa uma segunda
tentativa do **mesmo Electron empacotado pela própria CI, sem strace**,
dentro do job descartável Ubuntu 24.04 já configurado.

O binário permanece o mesmo arquivo cuja origem, caminho canônico,
permissões e SHA-256 do arquivo de distribuição foram verificados
pelas etapas anteriores. O M38 não aceita um executável fornecido
interativamente pelo usuário.

- A execução ocorre no mesmo job e servidor Xvfb do diagnóstico M33–M37,
  mas como um **novo processo** com diretórios HOME/XDG temporários
  próprios. Ambiente, parâmetros de inicialização e versão do pacote
  são mantidos compatíveis, **sem `--no-sandbox`**.
- Não há `strace`, `ptrace`, modificação AppArmor, sysctl,
  elevação de privilégios ou extensão de acesso a arquivos do jogo.
- A execução é limitada a 8,5 segundos, com grupo de processos próprio
  e limpeza ao término. stdout e stderr são descartados; nenhum
  argumento, PID, nome de usuário ou arquivo de perfil é exportado.
- O Node observa o `exitSignal` e o `exitCode` da execução **não
  instrumentada**, preservando a distinção entre um sinal SIGTRAP
  de verdade e um processo que terminou apenas com código 133.
- O relatório final compara essa observação com a contagem
  `sigtrapSignalRecords` do M33 no mesmo job, sem inferir que os
  dois processos tenham condições de temporização idênticas.
- Não mede posse/mapeamento de uma janela. Isso continua sendo
  responsabilidade do teste nativo X11 estrito já existente.

As possíveis classificações são:

- `untracedSIGTRAPConfirmedAsExitSignal`;
- `untracedExitCode133NotSignalProof`;
- `untracedTimedOutNoSignalConclusion`;
- `untracedExitNotSIGTRAPComparisonNeeded`.

Mesmo o primeiro resultado **não implica que a causa do SIGTRAP
é AppArmor, a consulta de capacidade, seccomp ou qualquer outro
mecanismo particular**. A coleta observacional não altera políticas
nem executa o piloto administrativo causal.

## Testes e evidência real

Há **16 testes adversariais sintéticos** no arquivo
`auto-x11-untraced-exit-control.test.mjs`, executados no job
rápido de regressão e no diagnóstico real. Incluem sinais distintos,
código 133 sem sinal, timeout, metadados falsos, formatos inválidos,
privacidade, impossibilidade de executar offline/fora da CI e
invariantes de segurança. O job real emite apenas
`M38_UNTRACED_EXIT_CONTROL`, depois de emitir os relatórios M33–M37.

O teste obrigatório nativo Ubuntu 24.04 **não foi alterado**,
nem removido, nem marcado opcional.

## Compromissos que seguem verdadeiros

O relatório M38 marca sempre:

- `causalityBetweenCapIndexAndSIGTRAPProven=false`
- `apparmorCausesSIGTRAPProven=false`
- `rendererSandboxIndependentlyVerified=false`
- `nativeWindowMappedVerifiedByThisControl=false`
- `strictUbuntu24NativeGatePassed=false`
- `strictNativeGateWaived=false`
- `apparmorPolicyChanged=false`
- `sysctlChanged=false`
- `sandboxBypassApplied=false`
- `mergeAuthorized=false`
- `releaseAuthorized=false`
- `installationAuthorized=false`

Nenhum mod real, arquivo do OMSI ou ambiente do usuário foi acessado,
e a `main` continua intacta. A
[issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
segue aberta e bloqueante. A homologação efetiva depende de
aprovação de administrador para um experimento causal em VM
descartável, demonstração de rollback e prova do isolamento dos
renderizadores, além de CI X11 estrita verde.
