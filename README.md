# Negresco Tools — vitrine e prévia isolada

Este repositório reúne dois escopos distintos. A vitrine HTML original usa dados fictícios, sem Electron ou acesso aos jogos. A pasta [react-prototype](react-prototype/README.md) contém a prévia experimental React/Electron, com inspeção local limitada e somente leitura. Nenhum deles constitui uma versão operacional de instalação, atualização ou remoção de mods.

- [Plano mestre aprovado — issue #167](https://github.com/nego001/omsi-manager-ui-preview/issues/167).
- [Plano de execução e critérios de entrega](react-prototype/docs/NEGRESCO-TOOLS-DELIVERY-PLAN.md).
- [Prévia desktop e limites de segurança](react-prototype/README.md).
- [GitHub Actions](https://github.com/nego001/omsi-manager-ui-preview/actions): evidências por revisão, não aprovação de release.

## Vitrine estática histórica

`index.html` e `personalizacao.html` são demonstrações de interface. Os workflows `windows-screenshots.yml` e `pages.yml` referem-se à vitrine estática. Não usar a publicação Pages como prova de funcionamento da aplicação Electron. O backup privado original é separado; não foi integrado ou auditado nesta entrega.

## Estado de distribuição

Artefatos portáteis de CI são temporários, experimentais e não assinados. Validação de desktop real, revisão independente, Ubuntu 24.04 estrito e assinatura continuam pendentes. Não desabilitar proteções para iniciar a prévia.
