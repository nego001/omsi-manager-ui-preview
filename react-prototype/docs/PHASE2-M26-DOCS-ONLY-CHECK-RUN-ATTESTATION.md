# OMSI Manager | M26 — Evidência real de CI com PR exclusivamente de documentação

**Branch de implementação:** `feat/github-docs-only-check-run-attestation-v1`  
**Base:** M25 / PR #29. **Draft, sem merge ou release.**

## Prova observada no GitHub (não simulada)

Foi aberto o [PR #30 — docs-only CI trigger](https://github.com/nego001/omsi-manager-ui-preview/pull/30)
contra a branch M25, com exatamente **um único arquivo modificado**:

`docs/ci-m26-docs-only-trigger-probe.md`

O arquivo está fora dos caminhos anteriormente aceitos pelo filtro
`pull_request.paths`. A API do GitHub confirmou o evento **pull_request**
associado ao PR #30 e a criação da execução real:

- [GitHub Actions #43785621826](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/43785621826)
- Workflow: **React Prototype Validation**
- SHA do PR de laboratório: `3d600a8b186484ae04e8f8a64d7185e8d2a8cddf`
- Base fixa da experiência: `7879d10780c4a89c11350e137f71600ce34d19d0`
- Check-run real observado: `build` — ID `133032469505`
- Check-run real observado: `Synthetic fixture two-revision comparison (CI only)` — ID `133032469802`
- Aplicativo de origem desses check runs: **github-actions**.

**Isso prova o disparo do workflow em um PR somente de documentação**
e a existência de IDs reais de check runs. Não prova que esses checks
passaram, nem que são identidades estáveis e já configuradas como
verificações obrigatórias no GitHub.

## Implementação adicional M26

`react-prototype/scripts/controlled_docs_only_check_runs.py`
confere os fatos pela API REST de leitura, não por suposições:

1. PR #30 aberto, Draft, head e base exatos.
2. Arquivos alterados: exatamente o Markdown identificado acima.
3. Execução Actions #43785621826 com `event=pull_request`, SHA e
   PR associado.
4. Jobs e check runs de verdade cruzados pelo **mesmo ID numérico**,
   nome e URL da execução. O app precisa ser `github-actions`.
5. Os nomes de checks observados devem constar do catálogo fechado
   de jobs do workflow candidato. Registros de outra execução são
   separados e não podem substituir prova ausente.
6. Exige pelo menos os check runs `build` e o comparador de
   duas revisões, mesmo enquanto os demais jobs estão pendentes.
7. A situação do Ubuntu 24.04 é registrada como observação — nunca
   ocultada ou promovida a aprovação.

O novo job `github_docs_only_check_run_observation` usa um token
com permissões **contents:read, pull-requests:read, actions:read,
checks:read**. O checkout não persiste credenciais. O classificador
não tem métodos que escrevem comentários, aprovações, branch rules ou
conteúdo do repositório.

Os testes adversariais recusam falsificação de SHA, PR, arquivo,
permissões do aplicativo, IDs de check runs, URLs de outra execução,
check duplicado, falso sucesso ou tentativa de dispensar Ubuntu 24.04.

## O que M26 NÃO libera

- A PR #30 e a PR do M26 continuam **Draft, sem merge**.
- O workflow ainda **não está instalado na `main`**.
- `requiredContextIDsSelected=[]`; nenhuma branch protection foi alterada.
- Uma execução `pull_request` disparada e seus IDs não garantem que
  todos os jobs concluam nem que check runs futuros tenham nomes
  imutáveis.
- Ubuntu 24.04 X11 com sandbox estrito segue bloqueando homologação
  enquanto falhar. Não há `continue-on-error`, bypass AppArmor ou
  Chromium `--no-sandbox`.
- Nenhum mod real lido, instalado ou extraído; nenhum caminho real
  de OMSI acessado e nenhuma mudança de Biblioteca.

**Próxima verificação independente:** comparar os mesmos nomes e apps
em novas execuções de PR de código e de documentação e revisar
manualmente a configuração futura de required status checks.
