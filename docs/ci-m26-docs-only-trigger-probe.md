# M26 — PR somente de documentação: prova do disparo de CI

**Escopo:** experimento descartável, sem qualquer alteração de código ou configuração.

Este único arquivo fora de `react-prototype/**` e de `.github/workflows/**`
existe para comprovar se o workflow **React Prototype Validation** começa a
executar quando um pull request altera somente documentação.

A branch base é a versão de desenvolvimento do M25, que declara
`pull_request:` sem filtros de caminho. O teste não altera os workflows.

## Critérios do experimento

1. A lista de arquivos modificados do PR contém **somente este Markdown**.
2. O GitHub Actions registra uma execução de `pull_request` associada ao PR.
3. Verificamos os nomes e estados reais dos jobs, sem afirmar que são
   contextos obrigatórios já configurados.
4. O Ubuntu 24.04 X11 estrito continua na matriz e sua eventual falha
   **não** deve ser ignorada.
5. Nenhum merge, release, mod real, instalação ou ativação de proteções.

**Atenção:** um workflow enfileirado prova disparo; não comprova que todos
os jobs passaram. Mesmo uma execução verde não estabelece autorização
para usar required checks na branch `main`, onde o workflow ainda não
foi integrado e validado.
