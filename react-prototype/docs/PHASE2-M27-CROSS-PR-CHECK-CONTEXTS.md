# OMSI Manager — M27 | Comparação real dos checks entre PRs de documentação e código

**Base:** PR #31 / M26. **Escopo:** GitHub Actions em modo somente leitura.  
**Situação:** proposta Draft, sem merge, instalação de mods ou alteração de proteção.

## Provas independentes

O M26 abriu um pull request que altera **somente** o arquivo
`docs/ci-m26-docs-only-trigger-probe.md` ([PR #30](https://github.com/nego001/omsi-manager-ui-preview/pull/30)).
O workflow `React Prototype Validation` realmente executou no
[run #43785621826](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43785621826).
Quando o run terminou, os 13 jobs esperados apareceram, com **12 success**
e **uma failure** do Ubuntu 24.04 X11 estrito. O Ubuntu 22.04 passou.

A [PR #31](https://github.com/nego001/omsi-manager-ui-preview/pull/31)
contém scripts/testes/documentação e uma alteração no workflow.
Ela originou o [run #43786218414](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43786218414).
**Fechamento confirmado em 16/11/2026 (UTC):** o run de código
#43786218414 terminou com **13 de 14 jobs aprovados**. A única
falha foi o Ubuntu 24.04 X11 estrito; Ubuntu 22.04 passou.
Dessa forma, ambos os runs de referência estão agora concluídos
e seus **13 checks compartilhados apareceram com o mesmo nome e
aplicativo de origem `github-actions`**, preservando IDs numéricos
diferentes para cada execução.

O M26 acrescentou um único job informativo:
`GitHub docs-only CI check-run evidence (read-only, not approval)`.
Esse job **não existia** na versão usada pela PR #30 e não é
um sinal de regressão por si só.

## Contrato M27

O arquivo `react-prototype/scripts/controlled_cross_pr_check_contexts.py`
consulta somente metadados públicos da API GitHub, com token de leitura:

- PR #30 e PR #31, número, Draft, base, head SHA e arquivos alterados;
- execução de `pull_request` correspondente, sua identidade e estado;
- lista de jobs reais e lista de check runs para cada commit;
- igualdade de **ID numérico dentro da mesma execução**, nome, app de
  origem `github-actions` e link do job para o run correto.

O **ID numérico do check run muda a cada execução**. Para comparar
contextos candidatos, M27 usa o par **(nome do check, aplicativo de
origem)** e identifica a interseção. Os nomes compartilhados são
comparados separadamente do novo job do M26. Não se aceita
uma identidade fictícia, um aplicativo desconhecido ou associação
com outro run como evidência válida.

Se a PR #31 ainda estiver em andamento, o resultado é
`codeRunStillInProgress`. Checks que ainda não foram criados por
dependências (como a matriz X11 antes do término de `build`)
**não são tratados como regressão comprovada**. Após as duas
execuções concluírem e os checks esperados serem encontrados,
a classificação pode ser `completedSharedNamesAndAppObserved`.
Isso compara presença e origem dos check runs, **não** demonstra
que todos passaram. Uma falha real é preservada no relatório.

Os testes adversariais cobrem PR/base/HEAD forjados, arquivo extra
na PR de documentação, retirada de scripts da PR de código,
check duplicado, ID ou URL de outra execução, aplicativo externo,
número de registros impossível, dados incompletos, falso sucesso
com o run ainda em andamento e privacidade.

## Limites mantidos

- Nenhum status check exigido ou ruleset de branch foi configurado.
- O workflow continua **fora da `main`**, que permanece intocada.
- A auditoria não consulta CODEOWNERS para decidir merge nem
  aprova revisões. O job verde só significa consulta válida.
- `requiredCheckContextsSelected=[]`, `mergeAuthorized=false`,
  `ubuntu24StrictSandboxWaived=false`,
  `installationAuthorized=false`.
- A diferença legítima do novo job M26 não dispensa o comparador de
  regressão, os testes Windows/Arch ou o Ubuntu 24.04 estrito.
- Nenhum mod real, jogo instalado ou arquivo privado é acessado.
  Sem extração, privilégios adicionais, auto-merge ou release.

**Futuro:** confirmar a consistência em novas execuções e validar
manualmente o comportamento de checks obrigatórios somente quando a
CI existir e funcionar de forma estável na branch principal.
