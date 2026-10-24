# OMSI Manager | Revisão visual com referência pública do Hydra

Revisão de aproximação visual, **não** validação de fidelidade 1:1. O OMSI Manager é um aplicativo independente, com objetivos e recursos diferentes do Hydra. Não copiamos marcas, imagens, layouts proprietários, recursos de download nem identidade comercial de terceiros.

## Fontes e recorte

- Referência do launcher Hydra: https://docs.hydralauncher.gg/ (captura da interface Home consultada em 23/10/2026).
- Capturas do OMSI Manager executado no Windows: https://github.com/nego001/omsi-manager-ui-preview/actions/runs/40017963184/artifacts/12529331769
- Código de prévia atual: `feat/react-nine-screens-safe`.
- A CI anterior tinha arquivos `06-*-1440.png` produzidos por um runner Windows cuja tela disponível era **menor que 1440 px** (alguns PNGs perto de 993 px). Esses nomes estavam errados; não podem sustentar comparação geométrica objetiva a 1440 px. O teste agora usa sufixo `initial-NNN` calculado a partir do viewport e publica `screenshot-manifest.json` com dimensões reais e bounds nativos.

## Diferenças verificáveis

| Região | Referência Hydra | Prévia OMSI antes desta rodada | Ajuste atual |
| --- | --- | --- | --- |
| Moldura / superfícies | Predomina preto / cinza-escuro uniforme | Contorno roxo/azulado em painéis e banner | Tons neutros em barra lateral, barra superior, cartões e gradiente do destaque |
| Navegação | Sidebar lateral com item ativo discreto | Blocos roxos e bordas com acento vibrante | Estado ativo mais neutro, preservando nove páginas e nomes de acesso |
| Destaque | Uma faixa de jogo em destaque com imagem panorâmica | Banner anterior com três capas inclinadas de jogos | **Segunda rodada:** banner panorâmico com um simulador selecionável por vez, ainda diferente da composição do Hydra |
| Biblioteca / grade | Capas de jogos de conteúdo real | Cards demonstrativos de mods com tipografia e gradientes próprios | **Diferença funcional intencional**: o catálogo de mods é fictício, não um download do Hydra |
| Experiência sem internet | Não avaliada nesta referência | Capas Steam com fallback | Fallback acessível e verificado na CI anterior |
| Acessibilidade | Sem certificação observada | Link de salto visível indevidamente em capturas de CI | Link de salto fica visualmente oculto até receber foco do teclado |

## Critérios usados nesta rodada

1. Ajustar as superfícies de navegação e o destaque para tons mais discretos, preservando contraste AA nas amostras existentes.
2. Confirmar que nove telas, busca, navegação por teclado e simulação de mods continuam funcionais.
3. Garantir que o link de salto só fique aparente com foco real.
4. Publicar metadados reais de dimensão das screenshots Windows para comparações futuras.
5. Não declarar 1:1 até comparar capturas na **mesma resolução e estado de interface**, com uma referência Hydra datada e revisada por pessoa.

## Não concluído

- Ajustar proporções e densidade do destaque, biblioteca, tipografia, geometria e espaçamento a partir de capturas equivalentes.
- Inspecionar diferenças de anti-aliasing, sistema de fontes, contraste em sobreposições, DPI do Windows real e desempenho gráfico com o notebook.
- Homologação física do seletor nativo de diretórios e revisão da segurança antes de considerar operações com escrita.

O PR continua **draft**. Nenhum mod, jogo ou arquivo do OMSI Manager original é modificado.

## Segunda rodada: um destaque panorâmico por simulador

O banner inicial agora deixa de exibir três capas inclinadas simultaneamente. Um **destaque panorâmico** usa uma única capa decorativa e oferece botões explícitos `OMSI 2`, `ETS2` e `ATS`, com `aria-pressed` para o estado atual. A chamada **Ver mods de ...** abre o catálogo filtrado corretamente pelo jogo escolhido, sem instalação de arquivos. **Explorar jogos** mantém o acesso à biblioteca de simuladores.

- Seleção é operável por mouse ou teclado, sem carrossel automático, sem temporizador e sem dependência de imagens online.
- No Windows, o smoke do `.exe` empacotado muda o destaque, abre um catálogo filtrado e verifica que a prévia continua somente leitura.
- Playwright cobre um único pôster no destaque, atualização do título, prevenção de estado de capa antigo, seleção por teclado e largura de 390/850/1024/1440 CSS px.
- O hero ainda **não** replica uma arte panorâmica específica do Hydra e permanece intencionalmente autoral. Sem imagens reais de mods nem integração com instalação.

**Comparação geométrica 1:1, tipografia detalhada e homologação com a interface Hydra em resolução equivalente continuam pendentes.**

## Terceira rodada: ritmo visual e legibilidade dos cartões

O destaque panorâmico foi preservado, porque a composição já se mostrou adequada ao OMSI Manager. Nesta rodada, as alterações se concentram no **restante da interface**:

- Tipografia da biblioteca e do catálogo: nomes dos mods a 14 px, metadados a 11 px, títulos de jogos a 15 px, linhas mais confortáveis e títulos de páginas fluidos.
- Espaçamento: cabeçalhos de seções, grades de jogos/mods e conteúdo principal usam intervalos consistentes. Em janelas estreitas, o espaçamento diminui sem perder a hierarquia.
- Rodapés dos cartões: layout flexível mantém o número de versão, tamanho declarado e botão de favoritos na mesma base para os cartões da mesma linha, inclusive com títulos de tamanhos diferentes.
- Títulos de catálogo importado: o texto de até 100 caracteres faz quebra de linha, inclusive com largura compacta, sem executar nem ler arquivos reais dos mods.
- Foco de teclado: os contornos das capas e controles de cards ficam dentro de superfícies recortadas, para não desaparecer sob `overflow:hidden`.

A nova suíte `tests/card-layout.spec.ts` valida geometria, linhas, fonte e alinhamento a 1440, 1024, 850 e 390 px, além de testar título importado longo e card compacto. O relatório `card-layout-audit.json` é publicado como artefato, e o smoke do **EXE Windows empacotado** repete as verificações essenciais de tamanho de fonte e alinhamento a 1024/850 px.

Estas são medições de consistência **interna** do projeto. Não alegam igualar espaçamento, fontes, arte ou geometria ao Hydra pixel a pixel. A validação física no notebook continua pendente.

## Ajustes após o teste de regressão responsiva

A primeira CI da rodada de tipografia e alinhamento identificou uma **largura extra transitória de 21 a 57 px** durante a mudança para viewport estreito. A transição de largura da barra lateral não deve rodar enquanto o breakpoint reduz o menu; ela agora é desligada abaixo de 760 px, preservando as animações no desktop. Também acrescentamos contorno de foco quando cartões recebem foco por APIs assistivas ou automaticamente, não apenas via `:focus-visible`.

A etapa só pode ser considerada validada depois da nova CI verde. O teste de títulos longos continua impedindo o corte de nomes de até 100 caracteres informados em JSON.

## Quarta rodada: fluxo contextual entre Biblioteca e Detalhes

Sem trocar a identidade visual já aprovada, esta etapa melhora **a continuidade da navegação**:

- **Busca contextual:** o campo no topo procura entre os favoritos quando o usuário está na Biblioteca. Em outras páginas conserva a busca do Catálogo; a pesquisa não troca de tela apenas porque o campo recebeu foco.
- **Filtros combinados:** pesquisa textual, jogo e categoria funcionam simultaneamente com contagem clara. Limpar filtros restaura a seleção sem apagar favoritos.
- **Ordenação:** ordem original do catálogo, nome A–Z ou agrupamento por jogo e nome, sem reescrever os metadados originais.
- **Voltar de Detalhes:** o aplicativo lembra de onde o cartão foi aberto (Início, Catálogo ou Biblioteca). Ao voltar à Biblioteca, preserva busca, jogo, categoria e ordenação. Isso evita perder o contexto enquanto se examina vários mods.
- **Evidência Windows:** o teste agora adiciona favoritos fictícios no armazenamento local e captura a Biblioteca preenchida, além de exercitar busca e retorno. Nenhum mod é instalado.

Novos testes de navegador em `tests/library-workflow.spec.ts` verificam pesquisa contextual, filtros, ordenação, ida/volta e controles em 390 px. A implementação segue **somente metadados**, não mede compatibilidade real e não altera arquivos de jogos.

Documentação de visão futura permanece em `PRODUCT-DECISIONS-REGISTER.md`. Leitura espalhada, Oficina, instalação e atualização seguem como requisitos de fases posteriores.

## Quinta rodada: estados declarados, sem prometer compatibilidade

Na Biblioteca, cada favorito passou a reutilizar o **mesmo analisador de relações JSON** já usado em Detalhes. Isso evita duas lógicas que discordam sobre dependências, faixas declaradas ou conflitos.

- **Bloqueios declarados:** dependência ausente, versão insuficiente, referência de jogo indevida, ciclo ou conflito **conforme os metadados**. Isso impede considerar o plano teórico livre de conflitos.
- **Avisos declarados:** faixa de versão sem versão hipotética informada, conflito potencial ou requisito que ainda precisa de validação. Não representam detecção de falha de execução.
- **Sem alertas declarados:** apenas ausência de problemas lógicos encontrados no JSON; **não significa** mod compatível, atualizado ou instalado. O cartão continua `não verificado`.
- Campo **Alertas** na barra de filtros: todos, bloqueios, avisos e sem alertas. A busca textual, jogo, categoria e ordenação continuam funcionando em conjunto.
- Resumo contextual de quantos favoritos contêm bloqueios/avisos **declarados**, com ressalva explícita. O botão de limpar filtros restaura também a seleção de alertas.
- Testes de unidade e Playwright em `tests/library-declared-status.spec.ts`, usando `examples/catalog.versions.example.json`, que possui uma dependência de áudio declaradamente abaixo do requisito e outra faixa de versão sem hipótese informada. O teste do executável Windows empacotado também verifica o filtro sem conteúdo de jogo real.

Isso é apenas **apresentação e consistência das evidências declarativas** na etapa visual. Nenhum leitor de arquivos de mod, detector de jogo, motor de instalação ou atualizador real foi ativado.

## Sexta rodada: explicações para dependências e conflitos na tela Detalhes

A seção `Dependências e conflitos · simulação` agora reaproveita `analyzeModRelations` como **fonte única** de análise e inclui uma camada de apresentação estritamente informativa (`relation-guidance.ts`). A intenção é que o usuário compreenda as incoerências declaradas no catálogo sem precisar interpretar códigos técnicos.

- **Resumo com três contadores:** bloqueios no catálogo, avisos no catálogo e número de etapas teóricas da sequência. Os números não representam mods instalados.
- **Explicações por tipo de problema:** dependência ausente, referência a outro jogo, ciclo, versão mínima não atendida, comparação de versões inviável, faixa hipotética do jogo não informada/inválida/incompatível, conflitos dentro e fora da sequência e referência de conflito ambígua.
- Cada problema permanece visível com a mensagem original do analisador. Um expansor acessível `Entender e conferir este alerta` mostra o significado e uma **próxima verificação manual** não destrutiva. Não existem botões de corrigir/instalar nesta seção.
- A comparação de versões continua **hipotética**; nunca inferimos a versão instalada. Se o catálogo não apresenta erros, isto tampouco prova a compatibilidade.
- `tests/relation-guidance.spec.ts` cobre os 11 códigos de inconsistência, simulação de faixa fora do limite, conflito na sequência, execução sem escrita e reflow a 390/850 CSS px.
- O smoke do EXE Windows verifica a presença dos contadores, ausência de inconsistências declaradas no demo e a ressalva de que a instalação não está autorizada.

Não houve alteração nos arquivos dos jogos ou no OMSI Manager principal. A etapa segue visual/informativa; as futuras capacidades de leitura espalhada, Oficina de skins e sons e instalador continuam no registro mestre.
