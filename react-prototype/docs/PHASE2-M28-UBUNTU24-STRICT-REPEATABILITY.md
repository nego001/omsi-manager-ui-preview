# OMSI Manager | M28 — Repetibilidade da falha estrita no Ubuntu 24.04

**Branch:** feat/ubuntu24-cross-run-strict-gate-v1  
**Base:** PR #32 / M27. **Draft; sem merge ou release.**

## Evidências reais revisadas

Conferimos os logs das execuções reais GNOME/KDE no Xvfb:

- A janela básica de controle `xmessage` mapeia nas duas imagens Ubuntu.
- No Ubuntu 22.04, `unshare --user --map-root-user true` é permitido, e o
  OMSI-Manager-Auto mapeia a janela X11 nas duas etiquetas.
- No Ubuntu 24.04, o probe de namespace é classificado
  `permission-denied`, o switch de restrição AppArmor está ativo e tanto
  o launcher Auto quanto o Electron direto recebem `SIGTRAP` antes de
  qualquer janela nativa validada.
- A classificação prévia continua
  `shared-electron-sandbox-startup-suspected`: **suspeita, não causa
  confirmada**. Um processo principal observado como `unconfined`
  não comprova o confinamento de renderizadores.
- A comparação sanitizada reporta o mesmo hash de pacote **entre as
  duas imagens de um mesmo run**; isso não comprova binários idênticos
  ao longo de commits diferentes nem assinatura do distribuidor.

Foi revisada a issue [#4](https://github.com/nego001/omsi-manager-ui-preview/issues/4):
o ensaio causal A/B/A em VM descartável com eventual política específica
e rollback continua dependendo de aprovação do administrador responsável
pelo ambiente. **Não executamos essa intervenção.**

## Três runs históricos, reais e concluídos

| Run (GitHub Actions) | Cenário | Jobs | Ubuntu 22.04 estrito | Ubuntu 24.04 estrito |
|---|---|---:|---|---|
| [#43784985561](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43784985561) | Código M25 | 13 | Success | Failure |
| [#43785621826](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43785621826) | Somente docs / PR #30 | 13 | Success | Failure |
| [#43786218414](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43786218414) | Código M26 / PR #31 | 14 | Success | Failure |

Nas três execuções, build, demais jobs e comparador de evidências
sanitizadas concluíram como success; a única falha foi o job estrito
Ubuntu 24.04. Essa repetição atravessa duas versões de código e um
experimento só de documentação; **não é prova de causa AppArmor**.

## Auditor M28

`controlled_ubuntu24_repeatability.py` consulta os dados oficiais
via GitHub REST em modo somente leitura. Ele fixa os três identificadores
de runs, PRs, branches e SHAs conhecidos, sem argumentos livres.
Exige:

- Run concluído com evento pull_request, workflow correto, PR e SHA exatos.
- Exatamente 13, 13 e 14 jobs, de nomes fechados para as respectivas
  revisões; IDs positivos e únicos, nenhum job pendente ou ignorado.
- Resultado do build, Ubuntu 22.04 e confronto de evidências = success.
- Falha do Ubuntu 24.04 registrada como failure, não corrigida nem dispensada.

A saída é um relatório de **nomes estáticos, contagens e booleanos**.
Caso o padrão histórico difira, classifica
`historicalGateOutcomesChangedNeedsReview` e deixa esse job vermelho.
Histórico incompleto, falsificado ou malformado é recusado com
`CONTROLLED_UBUNTU24_REPEATABILITY_REFUSED`, sem apresentar stderr
bruto, tokens, nomes de usuário ou caminhos.

O novo job `ubuntu24_historical_strict_gate_repeatability` roda em
Ubuntu 22.04, usando `contents: read` e `actions: read` apenas.
Testes de contrato com respostas fictícias verificam recusa de runs
não concluídos, flags falsas, alteração de branch/SHA, IDs duplicados,
jobs desconhecidos, contagens forjadas e limites de privacidade.

**Não executa binários, não interfere em AppArmor e não inspeciona
mods reais.** Um job de histórico verde significa apenas que a
falha anterior foi reproduzida nos registros; não aprova o Ubuntu 24.04
atual nem converte uma CI vermelha em verde.

## Impedimentos que permanecem

- `sameBinaryAcrossDifferentCommitsProven=false`
- `sameHostKernelBetweenRunsProven=false`
- `apparmorCausesSigtrapProven=false`
- `rendererSandboxCertified=false`
- `adminPilotApproved=false`
- `adminPolicyProfileCreated=false`
- `hostPolicyChanged=false`
- `sandboxBypassApplied=false`
- `currentRevisionStrictUbuntu24Passing=false`
- `ubuntu24StrictFailureWaived=false`
- `mergeAuthorized=false`
- `installationAuthorized=false`

O caminho para uma confirmação causal continua sendo um piloto aprovado
pelo administrador, em **VM Ubuntu 24.04 descartável**, com política
**específica do executável**, sem mudanças globais, SHA-256
independentemente verificado, prova do renderizador e rollback A/B/A.

Nenhum `--no-sandbox`, `--disable-setuid-sandbox`, sysctl global,
perfil amplo, execução como root ou `continue-on-error`. A issue #4
continua bloqueando homologação; todas as PRs seguem Draft, sem merge.
