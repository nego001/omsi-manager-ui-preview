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

## Sétima rodada: linha do tempo das dependências declaradas

A tela Detalhes passa a apresentar uma **linha do tempo visual, apenas informativa**, sobre a sequência teórica de dependências do JSON. Cada cartão identifica sua função com uma explicação simples:

- **Dependência indireta:** exigida por outro componente da cadeia.
- **Dependência direta:** exigida diretamente pelo mod selecionado.
- **Mod selecionado:** objetivo final da sequência.
- **Ver dados declarados:** expansor acessível revela ID, categoria, versão e jogo do registro; deixa explícito que presença, instalação e integridade não foram verificadas.

**Importante:** a lista não é um plano de instalação nem uma prova de ordem válida. Se existir **ciclo**, o sistema informa que a ordem é ilustrativa e inválida para instalação. Se faltar uma dependência ou houver referência a outro simulador, avisa que a linha do tempo está **incompleta**. Pacotes sem dependências declaradas recebem aviso de que isso não comprova autonomia real.

A implementação usa `buildRelationTimeline` em `src/relation-timeline.ts`, derivado do analisador JSON já existente. **Não cria segundo leitor** nem acessa arquivos de mods. Playwright valida papel direto/indireto, ciclos, IDs ausentes, abertura via teclado e reflow em 390/850/1440 CSS px. Smoke Windows do `.exe` empacotado confere a linha do tempo na prévia, sem alterar jogos.

**Etapa atual preservada:** Biblioteca/Detalhes com segurança e CI. Leitor espalhado, Oficina de skins/sons, imagens reais dos mods e instalação transacional continuam no roadmap/documento mestre, não são funcionalidades prontas.

## Oitava rodada: da Biblioteca direto ao alerta correspondente

A Biblioteca agora pode exibir um pequeno comando **Consultar N alertas declarados** em cada cartão de favorito cujos metadados JSON têm bloqueios ou avisos lógicos. Esse atalho:

- Utiliza `summarizeDeclaredStatus` do **mesmo analisador de relações** usado em Detalhes: não executa uma segunda leitura do mod.
- Abre `Detalhes` **do favorito certo**, desloca a visualização até `Dependências e conflitos · simulação` e coloca foco de acessibilidade na seção. Não abre o relatório de outro mod.
- Oferece o retorno **Voltar à biblioteca**, preservando filtros, pesquisa e ordenação anteriores.
- Só aparece quando há alertas **declarados**; ausência de alertas deixa a etiqueta `Sem alertas declarados · não verificado` e **não** cria um falso CTA de compatibilidade.
- Continua a identificar compatibilidade, instalação, integridade e conteúdo do pacote como **não verificados**. Não oferece atalhos de instalação, correção, leitura ou edição.
- Exibe foco visível por teclado ou foco programático e é responsivo em 390 CSS px.

`tests/library-diagnostic-jump.spec.ts` cobre bloqueios, avisos, ausência de alertas, foco, retorno com filtro e janela estreita. O teste do **executável Windows empacotado** agora importa um JSON gerado em diretório temporário (somente metadados de ETS2 fictício), percorre o atalho de diagnóstico, confirma foco e bloqueio dos botões instalar/remover e publica duas capturas adicionais da Biblioteca. O manifesto de capturas Windows registra **31 imagens** em vez de 29.

A identidade aprovada é preservada, assim como a etapa **visual/informativa**. A Oficina e o analisador distribuído continuam no registro mestre para fases futuras.

## Nona rodada: índice de alertas, com orientação e foco preciso

Em **Dependências e conflitos · simulação**, o usuário encontra um índice navegável dos bloqueios e avisos declarados. Cada botão é identificado pelo tipo e título do alerta e, ao ser acionado com mouse ou teclado, expande **a orientação correspondente**, rola até ela e leva o foco ao resumo da explicação.

O índice é derivado da mesma `relationAnalysis.issues` já usada na Biblioteca e no Relatório, sem leituras de arquivos, novas classificações ou execução de correções. Quando a versão hipotética do jogo muda, a lista se atualiza. Ao abrir outro mod (ou voltar da Biblioteca ao diagnóstico), a hipótese anterior é limpa, para a contagem declarativa inicial ser coerente com o atalho exibido no cartão.

Playwright cobre orientação por teclado, contagem dinâmica, retorno Biblioteca/Detalhes e bloqueio contínuo de instalação/remoção. O smoke do Windows empacotado também exercita um item do índice. A identidade visual permanece; o roadmap do leitor cooperativo e da Oficina não é tratado como implementado.


## Continuação: seleção de análise conjunta fora dos filtros atuais

A Biblioteca preserva seleções ao alternar jogo, categoria, alertas e pesquisa. Essa persistência é intencional, mas a interface agora evidencia a diferença entre **selecionado para análise** e **visível nos filtros**.

- Se houver itens selecionados fora dos filtros, a contagem mostra quantos estão ocultos e uma nota explica explicitamente que **Analisar seleção os incluirá**.
- A ação **Desmarcar ocultos (N)** remove apenas essas seleções de sessão, mantém as seleções visíveis, não remove favoritos e fecha um relatório anterior que ficaria desatualizado.
- Os filtros podem produzir uma lista vazia sem esconder o aviso nem o comando de correção.
- O fluxo permanece apenas de metadados declarados. Nenhum pacote real é lido, instalado, reparado ou alterado, e nenhuma compatibilidade é comprovada.
- Playwright cobre inclusão de ocultos no relatório, desmarcação seletiva, preservação de favoritos e janela de 390 px.

 
## Refinamento: desmarcar somente a seleção visível

A ferramenta de análise conjunta da Biblioteca agora apresenta **Desmarcar exibidos (N)** quando algum favorito da lista filtrada estiver selecionado. Assim, é possível reverter uma seleção em massa sem desmarcar favoritos anteriormente selecionados, mas ocultos pela pesquisa, categoria, jogo ou alertas.

- O comando atua só sobre os IDs atualmente visíveis na Biblioteca; **não remove favoritos**.
- A seleção oculta permanece ativa e segue sinalizada na interface; a contagem e a explicação não tratam os itens ocultos como inexistentes.
- Um relatório de análise conjunta já exibido é fechado após a alteração da seleção, para evitar resultados desatualizados.
- Playwright cobre grupos em simuladores diferentes, seleção parcialmente oculta, busca/categoria e viewport de 390 px.
- Nenhuma análise real, compatibilidade confirmada ou operação de leitura/escrita nos jogos é ativada.


## Inspetor local da seleção oculta

Quando há favoritos marcados para análise conjunta, mas escondidos pelos filtros atuais, a Biblioteca oferece **Ver selecionados ocultos (N)**. O usuário pode expandir a lista pelo teclado e conferir **título, simulador, categoria e ID declarados no catálogo**. Cada item tem **Desmarcar** individual; o controle remove somente seu ID da análise conjunta e invalida um resultado anterior. Não retira o favorito, não modifica a pesquisa nem desmarca os demais.

- Nenhuma inspeção de arquivo real, leitura de conteúdo de mod, descoberta de instalações ou alteração em jogos é acionada.
- Não confundir os títulos listados com conteúdo detectado no PC: todos são metadados da demonstração ou JSON importado.
- O inspetor se oculta quando não há mais selecionados fora dos filtros e funciona quando a pesquisa retorna zero cartões.
- Playwright cobre abertura com Enter, remoção individual, preservação dos demais favoritos, títulos longos e viewport de 390 px.
