# OMSI Manager — Plano mestre de reorganização
Data: 2026-10-20 (BRT). Fonte: inspeção dos repositórios públicos/privados conectados, arquivos de status e WORKLOG, e workflow runs.

## Regra de escopo
- `nego001/omsi-manager-ui-preview`: vitrine pública independente, dados fictícios, HTML/CSS, screenshots por Windows GitHub Actions. Nunca transferir código privado, OMSI real, Electron main/IPC, arquivos do usuário ou outras informações sensíveis.
- `nego001/omsi-manager-private-backup`: aplicação Electron/React real, ainda privada. Branch de design `design/hydra-4-2-adaptacao-v1`; PR #2 draft sem merge; base `dev/codigo-isolado`.
- Base visual aprovada pelo usuário é a prévia Hydra; modificações estilísticas posteriores devem preservar sua estrutura visual. Não afirmar 1:1 pixel-a-pixel sem confronto real.
- Segurança: `P2H_TOCTOU_UNRESOLVED`, `P1N=BLOCKED`; sem instalação, restauração destrutiva ou exclusão no OMSI real, Steam, RUN1/RUN2.

## Inventário do que foi comprovado
1. Prévia pública `index.html` com home, catálogo, seções, busca e dados fictícios: ARQUIVO PRESENTE, scripts sintaticamente testados em sessão anterior.
2. Prévia pública `personalizacao.html`: seis estilos (OLED Premium, Glass Carbon, Neon Control, Titanium Pro, Minimal Slate, Blue Pulse), abas Cores/Aparência/Sidebar/Topbar/Cards/Tipografia/Branding/Presets; editar, aplicar, duplicar, restaurar, JSON. ARQUIVO PRESENTE, JS sintaticamente aprovado; browser/UX ainda não auditados.
3. Windows screenshot em repo público: workflows `windows-screenshots.yml` recentemente SUCCESS; screenshot UI estática apenas. Último sucesso observado nesta consulta: run `39478544453`. Não implica teste da aplicação Electron privada.
4. GitHub Pages público: `pages.yml` ainda FAILURE na última verificação (run `39478544442`). Página publicada NÃO COMPROVADA.
5. App privado: Shell Hydra, Home sobre AppStore, CSS contextual para biblioteca real e demais páginas, rotas e workflows estáticos na branch de design. PR #2 aberto draft, 23 arquivos afetados. Code presence comprovada; TypeScript/build Windows e fidelidade 1:1 pendentes.
6. App privado Actions: runners não alocados por esgotamento dos 2000 minutos mensais do GitHub Free (informação mostrada pelo usuário no Billing). Sem prova de execução dos testes/build no repo privado.
7. Segurança: registros anteriores relatam P2J contratos estáticos e laboratório NTFS parcialmente verificados; cenários 3/4 e bloqueio TOCTOU continuam em aberto.

## P0 — Auditoria e consolidação (PRIMEIRO)
- [ ] Inventário completo das rotas, componentes, operações, modais e estados nas três branches relevantes.
- [ ] Matriz funcional: implementado vs validado vs bloqueado vs planejado; rastrear evidência por commit/job/test.
- [ ] Separar frontend seguro, IPC/backend e operações com acesso a arquivos do OMSI; manter gates.
- [ ] Atualizar WORKLOG do repo privado e este plano após cada mudança real.
Critério de saída: lista única de tarefas e dependências com evidência.

## P1 — Acabamento e identidade visual
- [ ] Preservar a estrutura original que usuário aprovou na prévia; padronizar sidebar/topbar/cards.
- [ ] Responsividade 1366×768 e 1920×1080, contraste, foco, teclado, mouse/touch.
- [ ] Capturas lado a lado com Hydra e UI privada no ambiente renderer-only, sem Electron produtivo.
Critério: screenshot real, testes de navegação e revisão do usuário.

## P2 — Personalização no aplicativo de verdade
- [ ] Migrar os seis presets do HTML independente ao React real.
- [ ] Modelo tipado de temas; valores padrão/compatibilidade; salvar/restaurar/importar/exportar com validação e limites.
- [ ] Editor de cor, opacidade, fonte, botões, sidebar, topbar, cards, densidade, ícones e branding.
- [ ] Prévia ao vivo com possibilidade de reverter, sem escrita em OMSI e respeitando acessibilidade.
- [ ] Testes de persistência, presets malformados e temas herdados.
Critério: funcionalidade comprovada no renderer real em sandbox, não só na vitrine pública.

## P3 — Módulos reais, por domínio
- [ ] Dashboard; Biblioteca e detalhes (Ônibus, Mapas, Mods).
- [ ] HOF/HOF Studio, perfis, histórico, backups e conteúdo externo.
- [ ] Diagnóstico, ferramentas, configurações, instalador (somente visual até liberação da segurança).
- [ ] Busca/filtros/organização, status verdadeiros, loading/erro/sem dados.
Critério: revisão de cada rota em ambiente UI-only com relatório e capturas.

## P4 — Segurança e confiabilidade (gate independente)
- [ ] Reproduzir/fechar cenários P2J 3 e 4 num TEMP sintético, preservar evidência.
- [ ] Resolver TOCTOU P2H, testar handling de caminho/handle/identidade, regressões de instalação/exclusão.
- [ ] Revisar quarantine/recovery/journaling/rollback/isolamento antes de habilitar escrita real.
Critério: avaliações de segurança documentadas e aceite explícito para alterar gates. Sem bypass.

## P5 — CI, release e publicação
- [ ] Corrigir GitHub Pages em repo público e capturar nova tela de personalização.
- [ ] Completar jobs screenshot + auditorias visuais de navegação no público.
- [ ] Definir estratégia segura/privada de build Windows do renderer sem publicar código privado. Não migrar o aplicativo para o público para fugir da cota.
- [ ] CI TypeScript, testes, builds e regressões da aplicação real; artefatos privados.
- [ ] Release/instalador apenas após P4 e validação UX/build.
Critério: release assinável/reprodutível e explícita decisão do proprietário.

## Próximo trabalho prioritário
1. Corrigir Pages público e adicionar teste de capturas da tela Personalização.
2. Auditar cada controle da prévia, reparar fluxo Configurações → Personalização → Editar → Aplicar/Salvar → Retornar.
3. Mapear dependências e integrar somente UI ao React privado, em branch draft, quando for possível testar com segurança.
4. Segurança P2J/P2H isolada antes de qualquer deploy operacional.

## Evidência / limites
- PR app privado: https://github.com/nego001/omsi-manager-private-backup/pull/2
- Demo pública: https://github.com/nego001/omsi-manager-ui-preview
- Workflow público Windows: https://github.com/nego001/omsi-manager-ui-preview/actions
- Nenhuma conclusão de teste não executado será anotada como PASS.
