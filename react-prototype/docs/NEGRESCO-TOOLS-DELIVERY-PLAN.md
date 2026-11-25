# Negresco Tools — Plano mestre de entrega

Aprovado pelo proprietário em 25/11/2026. Controle de execução: [#167](https://github.com/nego001/omsi-manager-ui-preview/issues/167). Fonte de requisitos: [registro de decisões](PRODUCT-DECISIONS-REGISTER.md), [leitor distribuído](DISTRIBUTED-MOD-READER.md), [análise compartilhada](SHARED-ANALYSIS-ECOSYSTEM.md).

| Fase | Entrega e critério verificável | Estado inicial |
|---|---|---|
| F1 | Documentação coerente, identidade, dependências reproduzíveis, pacote e revisão visual; distinguir gates externos | Em andamento |
| F2 | Contratos Core, armazenamento com migração (SQLite a avaliar), fila cancelável, cache, orçamento e logs; testes de falha em fixtures | Planejada |
| F3 | Índice seguro, adaptadores por formato, fusão e AnalysisSnapshot versionado; corpus adversarial, limites e identidade | Planejada; integração real bloqueada |
| F4 | Biblioteca persistente de mods autorizados, deduplicação, mídia com origem, pesquisa e estados verificáveis | Planejada |
| F5 | Diagnóstico de dependências, conflitos, regras de versão, relatórios rastreáveis | Planejada |
| F6 | Plano sem escrita, staging, backup, recuperação, instalação/remoção/atualização após autorização e auditoria independente | Bloqueada para jogos reais |
| F7 | Studio de skins/sons/texturas/3D em cópia de trabalho, suporte condicionado ao formato | Planejada |
| F8 | Projeções compartilhadas, automação, loja com direitos e consentimento | Planejada |
| F9 | Benchmarks desde F2, consumo de recursos, cache e paralelismo adaptativo medidos | Planejada |
| F10 | Distribuição assinada, atualização do app, testes reais e aprovação explícita | Bloqueada |

## F1: checklist de trabalho

- [x] Registrar plano aprovado, escopo e critérios.
- [x] Preparar documentação de entrada com nome Negresco Tools e distinção entre vitrine, prévia, laboratório e produto.
- [ ] Validar a revisão N09.8, inclusive atalho Linux.
- [ ] Inventariar nomes externos/internos e decidir migração compatível sem quebrar contratos.
- [ ] Auditar resolução das dependências e gerar lockfile por ferramenta confiável; validar instalação limpa e CI reprodutível (não fabricar lockfile).
- [ ] Consolidar apresentação, checksums, manifesto e instruções dos pacotes.
- [ ] Revisar screenshot final com usuário e validar desktop real.
- [ ] Resolver gate Ubuntu24 estrito e revisar assinatura/proveniência antes da release.

## Gates que não podem ser dispensados

Ubuntu 24.04 strict X11, desktop real Hyprland/GNOME/KDE conforme suporte, seletor nativo/identidade de handles, confinamento independente, revisão humana e assinatura/autorização de distribuição. Leituras e escritas de mods reais exigem aprovação e controles adicionais. Não modificar host, sandbox, dados do usuário ou backup privado. F2 pode desenvolver contratos e armazenamento de fixtures sem aguardar os gates externos; isso não fecha a homologação F1 nem abre operação em jogo real.

## Regra de acompanhamento

Cada entrega registra commit, escopo, critérios, testes efetivamente executados e lacunas. Não confundir demonstração com recurso real, aprovação de revisão antiga com aprovação atual ou aprovação do plano com autorização de merge/release. Preferir entregas verticais completas a etapas artificiais de consulta de CI. Base M145 `218bc2407dfb223aeb014528c7d3dcdf09313f50` preservada.
