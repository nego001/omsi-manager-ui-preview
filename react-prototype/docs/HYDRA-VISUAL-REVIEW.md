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


## Correção: desfavoritar um mod interrompe a análise conjunta antiga

A interface usa agora uma única operação `toggleFavorite` nos cartões e em Detalhes. Ao **retirar dos favoritos** um mod marcado para análise conjunta, o aplicativo remove também seu ID da seleção e fecha qualquer relatório aberto. Se o usuário adicionar esse mesmo mod aos favoritos posteriormente, a seleção **não reaparece automaticamente**. A marcação exige uma nova ação explícita.

- Remover um favorito **não selecionado** não fecha o relatório dos mods que continuam selecionados.
- O histórico de resumos declarativos já salvos nesta sessão permanece como um registro anterior, não como diagnóstico atualizado.
- Não há alteração em arquivos, instalação, compatibilidade, inspeção de pastas ou sandbox.
- Três testes Playwright cobrem fluxo na Biblioteca, fluxo em Detalhes e preservação de relatório quando o favorito removido não fazia parte da seleção.


## Resumo por simulador e análise sob demanda

A Biblioteca mostra **Seleção por simulador** quando há favoritos marcados para análise conjunta, separando OMSI 2, ETS2 e ATS mesmo que os filtros escondam itens selecionados. A contagem considera apenas favoritos selecionados e **não** dependências teóricas.

O cálculo de dependências `analyzeDeclaredBatch` e as verificações cooperativas da interface só ocorrem após clicar **Analisar seleção**. Ao modificar a seleção, o relatório é fechado até novo pedido. Testes Playwright cobrem três simuladores, seleção oculta, viewport de 390 px, resultado sob demanda e cancelamento por desmarcação. Nada acessa, instala ou altera mods reais.

## Classificação sanitizada da falha nativa X11 (CI)

O teste X11 exige que o mesmo Electron empacotado abra uma janela mapeada com sandbox estrito. Quando essa prova falha, o smoke emite `AUTO_X11_NATIVE_TRIAGE` com um vocabulário limitado de categorias: controle X11 indisponível, launcher com janela verificada, saída após abertura, prova direta indisponível, suspeita específica do launcher, falha compartilhada com indícios de sandbox ou falha indeterminada.

O resultado é **diagnóstico**, não prova da causa. A categoria `shared-electron-sandbox-startup-suspected` nunca afirma que AppArmor causou a falha, embora o Ubuntu 24.04 tenha registrado restrição de *user namespaces* e `SIGTRAP` tanto no launcher quanto no Electron direto. Campos privados, caminhos, nomes de perfil, argumentos e saídas brutas não são emitidos. Testes com entradas sintéticas verificam limites de privacidade.

A CI continua **vermelha** se uma janela nativa não abrir. Nenhum controle do sistema, política AppArmor, privilégio ou sandbox foi enfraquecido, e nenhum `--no-sandbox` foi adicionado.

## Trava automática contra regressão da matriz X11

A CI executa `native-x11-workflow-admission.test.mjs` antes dos testes gráficos. O contrato lê o próprio workflow e recusa a retirada do Ubuntu 24.04 ou Ubuntu 22.04, a desativação de falhas obrigatórias, condições que ignorem o job, alteração de permissões de leitura, quebra da ordem SHA256 → validação segura → extração ou supressão do teste de janela real. Também recusa opções que desativem sandbox, alterações de política de kernel e AppArmor e retornos artificialmente bem-sucedidos.

Esse teste é um **controle preventivo do texto do workflow**, não substitui a execução do Electron, não comprova compatibilidade e não pode tornar verde um Ubuntu 24.04 que falhe ao abrir janela. Regras de segurança da branch e revisão humana ainda são importantes; uma edição maliciosa que remova simultaneamente o contrato e a etapa de teste não pode ser impedida apenas pelo próprio workflow.


## Filtro de selecionados na Biblioteca

A Biblioteca oferece a caixa **Só selecionados** para mostrar apenas os favoritos marcados para análise conjunta. O filtro combina com simulador, categoria, alertas e pesquisa, sem desfavoritar ou desmarcar itens ocultos. O chip **Seleção: só marcados** remove somente esse filtro; **Limpar filtros** restaura a lista completa.

Com seleção vazia, ou após desmarcar todos os selecionados, a lista mostra o estado vazio e preserva os controles para recuperar os cartões, inclusive em 390 px. Alterar apenas a visualização não invalida um relatório válido; mudar a seleção continua fechando relatórios desatualizados. Testes Playwright cobrem seleção mista, filtros combinados, contagem dos ocultos, resultado vazio e recuperação. Nenhum arquivo real de jogo ou mod é lido ou alterado.

## Histórico temporário: exclusão de resumos individuais

Cada resumo declarado da sessão possui **Excluir este resumo**, com rótulo acessível específico. Excluir um registro não apaga outros resumos, favoritos, seleção da Biblioteca ou configurações. **Limpar resumos da sessão** continua removendo todos apenas quando solicitado.

O indicador da Biblioteca agora diz **Simuladores nos favoritos**, porque a contagem sempre se referiu a todos os favoritos, e não apenas à seleção de análise. No Histórico, o título estável **Sem atividades registradas** continua compatível com os testes de segurança existentes, enquanto o parágrafo e a seção de resumos declarativos esclarecem que nenhuma operação real foi realizada. Playwright cobre dois resumos distintos, exclusão seletiva, preservação de favoritos/seleção, limpeza até zero e tela de 390 px.

Nada disso comprova compatibilidade, instalação ou leitura de mods reais.

### Compatibilidade dos seletores de segurança no Histórico

O texto do título acessível **Sem atividades registradas** foi preservado: 22 testes Playwright de segurança de fluxos sintéticos dependem desse identificador para garantir que nenhuma atividade real foi criada. A nova exclusão individual de resumos temporários funciona sem alterar esse contrato. As verificações específicas do Histórico também foram realinhadas ao título original; os testes completos da CI continuam necessários.

## Histórico: desfazer exclusão temporária

O Histórico permite **Desfazer exclusão** de um resumo recém-removido, inclusive quando era o único registro da sessão. Restaurar não modifica favoritos, seleção de análise ou outros relatórios. Os IDs de relatórios são gerados por um contador monotônico da sessão e não são reutilizados quando o relatório mais recente foi excluído.

A recuperação é de um único nível e expira após uma nova análise salva, nova exclusão, limpeza total, restauração da demonstração ou importação de outro catálogo. O comando **Limpar resumos da sessão** não gera undo, evitando recuperar relatórios apagados intencionalmente em conjunto. Playwright valida restaurar a ordem, IDs 1/2/3, reset explícito e largura de 390 px. Tudo continua em memória e sem tocar em mods reais.

## Histórico: rever seleção declarada na Biblioteca

Cada resumo temporário apresenta **Rever seleção**, que reabre a Biblioteca e a análise conjunta com os IDs de favoritos ainda existentes. O relatório agora conserva uma cópia desses IDs além dos títulos; não persiste ao recarregar e não depende de arquivos reais. Se algum favorito tiver sido removido, ele é ignorado sem ser recriado, e uma mensagem indica quantos ficaram indisponíveis. Se nenhum restar, a Biblioteca abre sem selecionar nada nem simular instalação.

A navegação respeita os filtros atuais; a Biblioteca já informa quando uma seleção reaplicada fica fora dos filtros. A ação não modifica favoritos, não restaura arquivos excluídos, não executa downloads e não cria histórico de instalação. Há cobertura Playwright para seleção integral, remoção parcial/total de favoritos, preservação do resumo e largura de 390 px.

## Histórico: exportação local de resumos JSON (somente metadados)

O botão **Exportar JSON** gera um arquivo `OMSI-Manager-Resumo-N.json` exclusivamente por ação explícita do usuário. O conteúdo tem esquema versionado, títulos e IDs declarados, jogos, contagem de bloqueios/avisos declarados e os campos obrigatoriamente falsos `installationVerified` / `compatibilityVerified`. Não contém caminhos completos, conteúdo de mods, arquivos de jogos, tempos inventados nem alegações de instalação.

A serialização é pura, valida contagens e limites e recusa entradas inválidas ou relatórios com mais de 64 KiB de JSON. O download usa apenas Blob local, sem chamadas de rede, integração nativa ou permissão de gravação em jogos. Testes cobrem o contrato do JSON, rejeição de dados inválidos, download real no Chromium, ausência de operações e largura de 390 px. O Histórico continua temporário em memória e o arquivo é responsabilidade de quem o exportar.

## Exportar todos os resumos da sessão

Além da exportação individual, o Histórico oferece **Exportar todos JSON**, gerando um único `OMSI-Manager-Resumos-da-sessao.json`. O conteúdo versionado inclui no máximo 10 relatórios na ordem exibida, cada um com o contrato sanitizado da exportação individual e declarações explícitas de `installationVerified:false` e `compatibilityVerified:false`. Não reúne registros de instalação nem lê arquivos de jogo.

A rotina é disparada exclusivamente por clique e rejeita coleção vazia, IDs duplicados, relatórios inconsistentes e arquivos acima de 128 KiB UTF-8. Ao excluir um resumo, ele deixa de integrar o próximo arquivo. A exportação usa um Blob temporário local, não envia requisições e não persiste a coleção na aplicação. Contratos e Playwright cobrem download real, ordem, remoção, limites e visual em 390 px.
