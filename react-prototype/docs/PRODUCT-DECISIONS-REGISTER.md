# Registro mestre de decisões | Ecossistema OMSI Manager

**Tipo:** decisões e requisitos de produto trazidos nas conversas, consolidados para orientar implementação futura.  
**Status:** visão registrada, com recursos em fases distintas; **não** declara que as funções futuras estejam prontas.  
**Ramo de desenvolvimento:** `feat/react-nine-screens-safe`; [PR #1](https://github.com/nego001/omsi-manager-ui-preview/pull/1) em rascunho, sem merge.  
**Etapa ativa que NÃO deve ser esquecida:** acabamento visual da **Biblioteca** e **Detalhes**, com filtros por jogo/categoria, cartões informativos, estados honestos, responsividade, acessibilidade e testes Linux/Windows no protótipo isolado.

## 1. Visão de experiência: poucos comandos, inteligência profunda

- O produto não será um botão solitário nem um painel confuso de centenas de opções. Deve ser visualmente atraente, rico em informações úteis, contextual e simples para iniciantes.
- O usuário escolhe um ou vários mods; processos internos fazem inspeção, reconhecimento, organização, diagnóstico e, no futuro, planejamento/instalação com confirmação.
- A inteligência é **transversal ao ecossistema todo**, e não exclusiva do instalador: Início, Biblioteca, Oficina/Studio, Catálogo/Loja, Analisador, Atualizador, Instalador, Desinstalador, Diagnósticos e Histórico.
- Prevenir problemas conhecidos **antes** de ocorrerem; ainda assim explicar limites de suporte, incerteza e riscos em vez de prometer conversão ou correção impossível.
- UX com uma ação principal por contexto; modos técnicos, evidências e opções avançadas ficam disponíveis sem sobrecarregar a tela principal.
- Manter identidade visual autoral, inspirada em referências de usabilidade, sem afirmar fidelidade 1:1 ao Hydra e sem copiar indevidamente marcas ou conteúdo.

## 2. Leitura espalhada, identificação coletiva e compartilhamento

**Regra central:** *vários módulos especializados leem partes/aspectos de um mesmo mod; um coordenador cruza as evidências, resolve divergências e publica um resultado único e versionado.*

Módulos de leitura previstos: segurança de contêiner, assinatura/índice, árvore e arquivos de definição, manifesto/metadados, indícios de jogo/categoria, geometrias e modelos, texturas/materiais/UV, áudio e eventos, imagens/preview/proveniência, versões/dependências/conflitos, instalação detectada/destinos, integridade e planejamento. Podem ser paralelos depois do gate de segurança, com limite global de recursos. **Não é um único leitor monolítico, nem leitores divergentes em cada setor.**

O registro comum é um `AnalysisSnapshot` imutável, com versão do contrato/regras, hash do pacote, evidências, classificação fundamentada, lacunas, bloqueios, capacidades disponíveis e referências de recursos com acesso delimitado.

**Compartilhamento setorial:** o núcleo publica somente a **projeção de dados necessária a cada setor**, sem liberar todo o conteúdo bruto nem caminhos pessoais. Biblioteca recebe categoria, jogo, preview, estado e versão; Oficina recebe materiais/UVs/eventos suportados; Atualizador recebe informações de versões e diferenças; Instalador recebe evidências e plano; Loja recebe autoria/licença/mídia autorizada; Diagnóstico recebe constatações sanitizadas.

**Ciclo de volta:** edição feita na Oficina gera um derivado em cópia de trabalho; os leitores afetados são reexecutados (skin → texturas/materiais/preview, som → áudio/eventos, definições → classificação/compatibilidade), produzem **novo snapshot** e invalidam planos desatualizados. Biblioteca passa a diferenciar original e variantes.

Documentos técnicos: [Leitor distribuído](DISTRIBUTED-MOD-READER.md) · [Núcleo compartilhado e Oficina](SHARED-ANALYSIS-ECOSYSTEM.md).

## 3. Reconhecimento automático e destino correto

- Identificar OMSI 2, ETS2 e ATS por **indícios combinados da estrutura interna**, e não só pelo nome/extensão/manifesto. OMSI 1 fica condicionado à investigação específica de formatos e suporte.
- Diferenciar mapas, ônibus, veículos/caminhões, som, pinturas, gráficos e outras categorias de acordo com as regras do jogo; reconhecer variantes e pacotes compostos.
- Quando há sinais conflitantes ETS2/ATS ou de vários jogos, explicar a ambiguidade e **não copiar automaticamente para destino errado**.
- Diferenciar presença de pasta de mods e existência/versão confirmada do executável do jogo. Se o jogo estiver ausente, mas a pasta existir, manter um estado específico e permitir preparar destino somente quando reconhecido e autorizado. Pasta presente não prova jogo instalado nem mod funcional.
- Separar "arquivo encontrado", "favorito", "instalado pelo gerenciador", "ativado pelo jogo", "compatível verificado", "incompatível confirmado", "suspeita", "precisa atualizar" e "não verificado".

## 4. Biblioteca visual integrada aos jogos

- Uma Biblioteca unificada, com **filtros combináveis por jogo, categoria, estado e pesquisa**, inclusive mapa/ônibus OMSI e caminhão/som ETS2/ATS. Evitar misturar registros de jogos diferentes.
- Cartões ricos e informativos: imagem real do mod quando extraída de fonte legítima, nome, variante, jogo, versão, estado, autoria e avisos relevantes.
- Preferir previews existentes no pacote ou imagens autorizadas pela origem. Para ATS/ETS2 investigar assets de apresentação; para OMSI 2 investigar preview de mapa, veículo e skins. Um render 3D deve depender de formatos/modelos com suporte testado; onde não der, usar preview 2D ou ilustração **explicitamente identificada**.
- Nunca disfarçar imagem de IA/placeholder como screenshot autêntica do mod.
- Biblioteca conectada à análise, à Oficina e futuramente à instalação/atualização; apresentar "Atualizar" ou "Abrir na Oficina" só se evidências e capacidade suportarem.
- **Implementação atual:** favoritos de catálogo JSON *demonstrativo*, filtros por jogo/categoria e arte ilustrativa rotulada; **não** é inventário instalado ou verificação real.

## 5. Oficina / Studio de personalização

**Pinturas e skins:**
- Reutilizar a classificação e handles autorizados do snapshot para reconhecer veículo, materiais, texturas, transparências, UV e templates.
- Oferecer editor de camadas/arte e prévia 2D; 3D só se a geometria e os mapeamentos forem realmente acessíveis com adaptador confiável.
- Exportar derivado validado, mantendo mod original e licença, com resolução/formato apropriados; verificar caminhos de textura/repaint e atualizar preview com procedência.

**Áudio e sons:**
- Leitura de configurações/definições/eventos válidos de OMSI/ETS2/ATS, referências de arquivos e formatos suportados.
- Oficina poderá permitir montar variantes de sons (motor, trocas de marcha, turbo, escape, freio motor, retarder, portas, ambiente etc.) **apenas quando os eventos forem identificados**, com preview, parâmetros e validação.
- ETS2/ATS/FM0D ou formatos proprietários requerem adaptadores reais para formato/versão; não assumir que todo banco é editável. Se não houver suporte, explicar e não improvisar gravação no original.
- Uma alteração de som ou skin deve ser reanalisada e resultar em nova revisão do pacote, para Biblioteca, Atualizador e planejamento de instalação.

## 6. Atualização inteligente e diagnóstico de falhas

- Detectar potencial incompatibilidade quando a versão do jogo muda ou a versão do mod é antiga, com base em evidências reais de arquivos/requisitos/logs.
- **Não considerar alteração do manifesto suficiente para atualizar.** Examinar definições, modelos, materiais, texturas, referências, sons/eventos, dependências e registros de crash conforme adaptadores e versões.
- Exemplo de erros a reconhecer: textura rosa, recursos faltando, erro de console, modelo que não carrega, som silencioso/sem evento, jogo que trava, conflito de dependência.
- Propor etapas de correção versionadas, em cópia de trabalho, com diffs e testes automatizados. Validar na versão-alvo e explicar quando uma migração não for suportada.
- A IA pode sugerir hipóteses e orientar triagem; não alterar mods reais sem teste e autorização. Diagnóstico incompleto nunca vira "corrigido" por dedução.

## 7. Instalador, desinstalador e atualização espelhados

- Analisador produz o **mesmo snapshot** que o planejador de instalação usará; não desenvolver detectores paralelos incompatíveis.
- Fluxo pretendido: selecionar → validação do contêiner → módulos cooperativos → fusão de evidências → verificação de destinos/dependências → **plano simulado** → explicação das alterações → consentimento → backup/staging → aplicação transacional → validação por hashes/inventário → registro de ownership.
- Antes de executar, revalidar hash do pacote, destino, versão das regras, espaço e consentimento; se algo mudou, **invalidar o plano** e exigir nova revisão.
- Desinstalar só os arquivos pertencentes às transações registradas, preservando alterações manuais e outros mods. Deve existir recuperação após interrupção, falhas parciais e rollback.
- Não prometer que mod foi carregado pelo jogo só porque foi copiado; estados verificados dependem de evidência independente.

## 8. Loja / catálogo / criadores

- Busca e organização por jogo/categoria, reputação e diagnóstico transparente, com procedência e permissão de uso/distribuição de imagens e arquivos.
- Respeitar licenças, direitos do autor e versões publicadas. Não redistribuir arquivos privados/proprietários sem autorização.
- Uploads, downloads e conteúdo não confiável exigem moderação, controle de tamanho/formato, verificações técnicas, origem clara e isolamento.
- Avaliações automáticas devem expor critérios e limitações para não prometer compatibilidade universal.

## 9. Segurança, privacidade e confiabilidade (condições obrigatórias)

- Inspeção inicial **somente leitura**, sem executar scripts contidos em mods, sem extração irrestrita, sem seguir caminhos externos ou symlinks.
- Controlar zip bombs, traversal, formatos malformados, arquivos gigantes, limites de CPU/memória/I/O/tempo, cancelamento e módulos que falham.
- Sem acesso privilegiado ao disco a partir do renderer; interface recebe somente capacidades com escopo estrito.
- Cache por hash e versões das regras, com invalidação de derivados/planos desatualizados.
- Não enviar arquivos, caminhos locais, logs pessoais ou dados de criadores a terceiros sem consentimento.
- Escrita/desinstalação apenas após testes de backup, rollback, permissão, integridade, interrupções e homologação física no Windows. Nunca tocar no backup privado ou no programa principal durante o protótipo.

## 10. Plano de execução e estágio real

| Fase | Escopo | Estado |
| --- | --- | --- |
| A. UI da Biblioteca e Detalhes | Visual, filtros de favoritos, status honestos, responsividade, testes no protótipo | **Em andamento** |
| B. Contratos e testes sintéticos | `AnalysisSnapshot`, `CapabilityProjection`, `AssetHandle`, derivados, fixtures por jogo, fusão de resultados | Planejada |
| C. Leitor seguro de mods reais | Contêiner/estrutura/recursos/imagens genuínas, com autorização e sandbox | Planejada |
| D. Oficina e atualização simulada | Editores suportados, staging de skins/sons, reanálise incremental e provas de compatibilidade | Planejada |
| E. Instalação/desinstalação real | Plano espelhado, backup, commit/rollback, testes físicos e auditoria do programa original | Bloqueada até homologação |
| F. Loja e serviços | Origem, licença, integração com catálogo e criadores, segurança de distribuição | Planejada; requisitos desde já |

**Princípio de continuidade:** novas ideias alimentam este registro e suas especificações filhas, **sem trocar a etapa ativa sem decisão explícita**. PR #1 permanece em rascunho; não mesclar no OMSI Manager principal.

## 11. Fontes internas e rastreabilidade

- [ECOSYSTEM-VISION.md](ECOSYSTEM-VISION.md): visão e roadmap macro.
- [DISTRIBUTED-MOD-READER.md](DISTRIBUTED-MOD-READER.md): leitura dividida em módulos e identificação conjunta.
- [SHARED-ANALYSIS-ECOSYSTEM.md](SHARED-ANALYSIS-ECOSYSTEM.md): núcleo compartilhado, Oficina, skin/som e ciclo de retorno.
- [HYDRA-VISUAL-REVIEW.md](HYDRA-VISUAL-REVIEW.md): decisões de estilo, diferenças e pendências visuais.
- [WINDOWS-HOMOLOGATION.md](WINDOWS-HOMOLOGATION.md): testes físicos e limitações do executável.
- [Issue #2: Visão macro](https://github.com/nego001/omsi-manager-ui-preview/issues/2), [Issue #3: Oficina](https://github.com/nego001/omsi-manager-ui-preview/issues/3), [PR #1: etapa UI](https://github.com/nego001/omsi-manager-ui-preview/pull/1).

### Nota de precisão

Todas as funções avançadas de reconhecimento por estrutura, leitura distribuída de arquivos de mod, geração de preview 3D, editores reais de skin/som, atualizações automáticas, compatibilidade confirmada e transações de instalação/desinstalação **são especificações futuras**. O protótipo atual não as executa. Nenhum mod do usuário foi analisado ou alterado para produzir este documento.

## Retorno à etapa funcional: análise conjunta de favoritos

A Biblioteca oferece agora seleção de vários favoritos e um relatório conjunto
que **cruza metadados declarados** do JSON, reúne dependências teóricas e
detecta conflitos entre raízes independentes. O relatório separa OMSI 2,
ETS2 e ATS e mostra bloqueios e avisos com as limitações explicitadas.

Esta função não lê os binários dos mods, não identifica instalações reais,
não valida compatibilidade com as versões dos jogos e não oferece instalação.
A seleção é transitória da interface e não expõe caminhos. O relatório nunca
pode liberar as ações de instalar ou remover.

A próxima etapa continua sendo o núcleo cooperativo real, somente após
gate de segurança, corpus sintético adversarial e contratos verificáveis.

### Refinamento de seleção e ordem determinística

A ação **Marcar favoritos exibidos** respeita os filtros atuais de jogo,
categoria, alertas e pesquisa. A análise permanece explicitamente
limitada aos metadados do catálogo. Cada item da sequência informa se
foi selecionado ou aparece somente como dependência teórica.

A ordem é reconstruída de forma determinística, visitando dependências
antes dos mods consumidores, independentemente da ordem dos cliques.
Ciclos e bloqueios continuam impedindo qualquer interpretação dessa
sequência como um plano de instalação. Operações reais seguem desligadas.

### Histórico temporário do relatório conjunto

Após gerar um relatório, a pessoa pode guardá-lo em **Histórico** somente
durante a sessão atual. Esse histórico limitado a dez resumos guarda
contagens, títulos declarados e jogos, sem caminhos, hashes de arquivos
pessoais ou dados da instalação. Não é persistido nem enviado à rede.

A tela mantém explícito que nenhuma instalação, desinstalação ou atualização
real foi registrada. Importar outro catálogo limpa o histórico declarativo
para evitar misturar análises de fontes diferentes. Instalar/remover continua
desabilitado.


### Biblioteca e checklist do analisador cooperativo

A análise conjunta passou a exibir, sob demanda, os **oito módulos que precisarão verificar os mods reais**: gate de segurança, estrutura, manifesto, definições, recursos, áudio, imagens e relações. Essa lista é derivada do **mesmo plano sintético já existente** em `distributed-reader-contract.ts`. O componente não executa nenhum leitor, não calcula hash, não identifica mods reais e mantém os oito estados como **Não executado**. O gate aparece antes dos demais e a instalação permanece bloqueada. Essa separação impede que as relações declaradas no JSON sejam apresentadas como evidências coletadas pelos especialistas.


### Laboratório interativo do gate de pacotes fictícios

A Biblioteca ganhou um laboratório opt-in com seis exemplos predeterminados: pacote fictício de estrutura regular, travessia de caminho, link, colisão de nomes, razão de expansão excessiva e formato malformado. O componente usa **o mesmo simulador de índice sintético já testado**, sem arquivar, extrair, enumerar arquivos do usuário nem invocar IPC. No exemplo regular, apenas o índice fictício é criado; o resultado segue **incompleto**, porque não há relatórios de especialistas. Nos demais, o gate fictício recusa o pacote antes de divulgar índice algum.

O laboratório não interpreta favoritos nem relaciona seus resultados com os mods do catálogo: é uma ferramenta didática e de regressão de segurança. As interfaces e os testes confirmam `realPackageRead: false`, `compatibilityVerified: false` e `operationsEnabled: false`. O digest declarado é fictício e nunca implica hash real verificado.

### Pesquisa acessível de metadados no Catálogo e na Biblioteca

A pesquisa do catálogo demonstrativo e dos favoritos agora tolera
acentuação, caixa, espaços extras e termos fora da ordem (por exemplo,
`onibus urbano`, `OMSI mapas serra` e `caminhoes rodoviario`).
O filtro considera apenas **título, categoria e jogo declarados**
no JSON; não examina arquivos, caminhos, conteúdo de mods ou logs.
Ele continua combinável com os filtros de jogo, categoria e alertas.
Limpar a busca não apaga favoritos e nenhum resultado de pesquisa
comprova compatibilidade ou habilita instalação.

Os testes Playwright exercitam o uso real do filtro e comprovam que as
ações de instalar/remover nos Detalhes continuam bloqueadas.

### Limpeza consistente dos filtros da Biblioteca

A Biblioteca demonstra agora um único botão **Limpar filtros** sempre que
algum dos controles não estiver no padrão: jogo, categoria, alerta,
pesquisa textual ou ordenação. O botão fica disponível tanto quando há
favoritos visíveis como quando nenhum satisfaz os filtros e mostra a
quantidade de ajustes ativos. Ele restaura apenas os filtros e a
ordenação, **sem apagar favoritos, a seleção para análise conjunta ou
metadados do catálogo**. O estado vazio não duplica a ação, evitando
dois botões com o mesmo nome acessível. Há testes Playwright de múltiplos
controles e layout em 390 pixels. A busca e os filtros continuam
restritos a metadados demonstrativos, não leitura ou instalação de mods.


### Continuidade de teclado na Biblioteca e Detalhes (protótipo)

A navegação acionada por botão ou teclado desloca o foco para o conteúdo principal da nova tela, evitando perder o contexto quando o botão anterior é desmontado pelo React. O campo de pesquisa global é exceção explícita: ao entrar no Catálogo por foco, permanece ativo para permitir digitação sem precisar selecioná-lo novamente. Os controles de favorito continuam com ação contextual e recebem uma descrição acessível vinculada ao título do mod, sem alterar os IDs de dados, favoritos ou a instalação. No toque, o alvo de favorito tem pelo menos 44 por 44 pixels. O fluxo é verificado por teste Playwright de teclado; comportamento de leitor de tela físico não é certificado por essa automação. Instalação e remoção permanecem bloqueadas.


### Navegação contextual entre Detalhes sem atravessar filtros

Detalhes agora pode avançar para o mod anterior ou seguinte **somente dentro da lista da origem**: Catálogo respeita jogo, categoria e pesquisa; Biblioteca respeita os favoritos e todos os filtros combinados; Início percorre somente os quatro cartões em destaque. A navegação exibe posição e origem, não muda os filtros e desloca o foco ao título do novo mod para teclado/leitores de tela. O botão de voltar retorna ao cartão de origem quando ele ainda está visível. Se o mod deixou de satisfazer os filtros (por exemplo, após remoção dos favoritos), o componente informa que ele está fora da lista e desabilita os atalhos; o retorno usa o conteúdo principal como foco seguro.

Os testes usam fixtures exclusivamente demonstrativas, incluindo largura de 390 px, escopo de cada lista, remoção de favorito e persistência de filtros. Nenhuma ação inspeciona arquivos do mod, garante compatibilidade ou libera instalação/desinstalação.


### Consistência de importações JSON assíncronas (interface)

As consultas temporárias de JSON (resumos e comparações) e o catálogo demonstrativo usam leitura assíncrona de `File.text()`. A escolha de um novo arquivo invalida conclusões atrasadas de escolhas anteriores. Descartar uma consulta, restaurar a demonstração ou aceitar um novo catálogo impede que uma leitura anterior recrie dados já descartados, mesmo se o navegador devolver o conteúdo depois. A restauração também cancela a aplicação de importação de catálogo ainda pendente. Arquivos inválidos continuam sem substituir a última consulta válida, desde que a ação não tenha sido descartada. Essa proteção é local, não altera o formato dos exports, não persiste arquivos nem modifica jogos.

Quatro cenários Playwright simulam leituras atrasadas: descartar consulta, escolher outra, aceitar catálogo e restaurar demonstração. O bloqueio da CI Ubuntu 24.04 continua independente desta correção.


### Ordenação de favoritos por alertas declarados

A Biblioteca oferece a ordenação opcional **Alertas declarados (bloqueios primeiro)**. Ela consulta os mesmos resultados de metadados já exibidos nos cartões, priorizando `blocking`, depois `attention` e, por último, `no-issues`. Empates são resolvidos pelo título e ID para manter a sequência determinística. Isso não verifica instalação, integridade ou compatibilidade e não transforma ausência de avisos declarados em aprovação técnica.

A nova ordenação respeita jogo, categoria, estado, pesquisa e seleção visível, sem alterar favoritos, metadados, filtros ou relatórios. Os controles **Limpar filtros** e o chip de ordenação restauram a sequência padrão. Os atalhos Anterior/Próximo de Detalhes usam a mesma lista filtrada/ordenada. Testes com catálogo fictício exercitam prioridades, empates, limpeza, navegação e tela de 390 pixels; operações de instalação e remoção seguem bloqueadas.


### Resumo coerente de alertas sob filtros

A faixa de alertas da Biblioteca distingue explicitamente a contagem geral, referente a **todos os favoritos**, das contagens de bloqueios e avisos **entre os cartões visíveis** quando algum filtro elimina resultados. Os valores filtrados são calculados a partir da mesma lista usada na renderização dos cartões, portanto respeitam jogo, categoria, estado, pesquisa e seleção. A simples ordenação não muda as contagens. Quando os filtros deixam zero resultados, o resumo informa zero exibidos, sem apagar ou reclassificar favoritos. Quando todos os favoritos estão visíveis, a linha adicional desaparece para evitar números duplicados. A terminologia permanece "declarado": nenhum número comprova instalação, atualização ou compatibilidade real.

Há teste Playwright com metadados fictícios, combinação de filtros, lista vazia, limpeza e largura de 390 pixels.


### Atalhos para investigar alertas da Biblioteca

A faixa de alertas agora oferece **Ver bloqueios declarados** e **Ver avisos declarados**. Cada botão modifica exclusivamente o filtro de alertas existente, preservando jogo, categoria, pesquisa, ordenação e seleção conjunta. Pressionar de novo o atalho ativo restaura `Todos os estados do catálogo`; escolher o outro alterna imediatamente o filtro. O atributo acessível `aria-pressed` acompanha o estado atual do filtro, inclusive quando o usuário usa o seletor convencional. Botões sem nenhuma ocorrência no total de favoritos ficam desabilitados. A visualização estreita dispõe os dois atalhos em linhas próprias e oferece alvo de toque de 44 pixels.

Os atalhos usam exclusivamente a classificação de **relações declaradas no JSON**, não uma verificação real de mods, arquivos, ativação ou compatibilidade. Os testes Playwright cobrem teclado, alternância, limpeza, ausência de alertas, lista vazia por combinação de filtros e largura de 390 pixels. As ações de instalar e remover não mudam.


### Correção de regressões na faixa de alertas e teste sintético Windows

Uma execução automatizada encontrou um conflito de texto na Biblioteca: a frase secundária "1 favorito exibido" duplicava o contador principal e tornava consultas estritas ambíguas para testes e seletores. O texto filtrado agora informa **somente as quantidades de bloqueios e avisos**; o contador primário continua sendo a fonte única para a quantidade de favoritos visíveis.

Separadamente, um processo filho PowerShell do laboratório Windows **exclusivo de testes** atingiu o prazo fixo de 15 segundos numa CI com carga concorrente. O orçamento do helper foi ampliado para **30 segundos**, ainda com timeout e recusa segura. Não houve mudança nos limites de leitura de jogos reais, no renderer, no IPC distribuído, nas operações de instalação ou no sandbox. A causa precisa do atraso do runner não está definitivamente comprovada; a CI seguinte precisa confirmar o resultado.


### Recuperar favoritos quando um filtro deixa a Biblioteca vazia

Quando a Biblioteca tem favoritos, mas os controles combinados retornam zero cartões, o estado vazio oferece o botão **Mostrar todos os favoritos** no próprio contexto do resultado. O botão utiliza a função existente de limpeza de filtros, **sem remover favoritos nem desmarcar itens da análise conjunta**. O foco de teclado volta ao primeiro cartão agora visível para evitar perder a posição ao desmontar o estado vazio. O controle continua disponível em viewport estreita e recebe alvo de toque de no mínimo 44 px em dispositivo de ponteiro grosseiro. A seleção e a classificação de alertas declarados permanecem não verificadas contra arquivos de jogos reais.

Dois testes Playwright verificam a ação por Enter a 390 px, foco resultante, integridade dos favoritos, estado dos filtros e preservação da seleção conjunta. Sem autorizar instalar, remover, inspecionar conteúdo de mods ou mudar a proteção sandbox.


### Foco após limpeza de filtros em qualquer estado

O botão **Limpar filtros** no topo da Biblioteca desaparece quando a coleção retorna ao estado padrão. Sem redirecionamento, usuários de teclado poderiam perder a posição de navegação. Tanto esse controle quanto o botão **Mostrar todos os favoritos** do estado vazio agora compartilham a mesma ação acessível: restauram jogo, categoria, alertas, ordenação, busca e opção "só selecionados", sem remover favoritos ou desfazer a seleção conjunta, e depois focam o título do primeiro cartão visível na ordem padrão. O efeito de foco é acionado somente após a lista voltar a existir e não tenta focar cartões enquanto a Biblioteca não está na tela.

Dois testes Playwright verificam Enter no botão da barra em 390 px, ausência de rolagem horizontal, reset apenas da ordenação, continuidade dos favoritos e preservação da seleção. Não há leitura de arquivos reais nem alteração de instalação ou das restrições do Electron.


### Remoção de chips de filtro com continuidade de foco

A Biblioteca possui chips que desaparecem após a remoção de um filtro individual. A ação no teclado agora registra a posição do chip antes da atualização: o foco vai para o próximo chip ainda presente, ou para o anterior se o último da fila foi removido. Quando não restam chips ativos, o foco é devolvido ao título do primeiro favorito exibido; se a combinação ainda não mostrar nenhum cartão, usa o primeiro seletor da barra de filtros como alternativa. O fluxo usa os mesmos setters de filtro, sem apagar favoritos, seleção de análise ou relatórios declarativos.

Dois testes Playwright verificam a navegação por Enter/Space, o foco sucessor/antecessor, o fim da fila, a continuidade da seleção conjunta e o layout a 390 px. O sandbox, as permissões e o escopo de metadados demonstrativos não mudam.


### Recuperação local do Catálogo sem resultados

Quando uma combinação de busca, simulador e categoria esconde todos os resultados, o Catálogo mostra **Mostrar todos os mods** dentro do próprio estado vazio. Esse botão restaura os três filtros padrão, preservando o catálogo de metadados atual (inclusive um JSON importado), a origem da importação e os favoritos. Após a lista reaparecer, o foco do teclado passa ao primeiro título visível. Em largura estreita, o botão respeita a caixa disponível e possui alvo de toque de 44 px em dispositivos de toque.

A lista vazia resulta apenas de filtros e não significa que um mod foi removido ou que qualquer jogo foi inspecionado. Dois testes Playwright incluem Enter em 390 px, restauração da demonstração filtrada, preservação de origem e favorito em catálogo JSON importado e confirmação de que instalação e remoção seguem bloqueadas.


### Filtros ativos do Catálogo removíveis individualmente

Quando a busca, o jogo ou a categoria do Catálogo diferem dos padrões, o resultado mostra chips acessíveis com os filtros ativos. Cada chip remove **apenas o respectivo critério**, mantendo intactos os outros dois, os favoritos e o manifesto demonstrativo ou JSON importado. Os chips não são comandos de instalação nem indicadores de compatibilidade.

Como a remoção desmonta o próprio botão acionado, o foco de teclado passa ao próximo chip, ou ao anterior quando o último é removido. Sem chips restantes, o foco retorna ao primeiro mod visível. A interface permite retorno à coleção completa tanto pela remoção individual quanto pelo botão do estado vazio. Os testes Playwright cobrem Enter, foco sucessor/antecessor, largura de 390 px, filtros que produzem zero resultados, catálogo JSON importado e permanência de favoritos.


### Ordenação reversível dos metadados do Catálogo

O Catálogo permite as ordens **Original do catálogo**, **Nome (A–Z)** e **Jogo e nome** (OMSI, ETS2, ATS). A ordenação só afeta a visualização e o fluxo de navegação **Anterior/Próximo** dos Detalhes abertos a partir do Catálogo; jamais modifica a lista de metadados importada ou os favoritos. Empates são resolvidos pelo ID. Uma ordem não padrão aparece como chip removível, com continuidade de foco após seu desaparecimento. A ordem padrão é restaurada ao importar outro JSON ou voltar à demonstração. Já o botão para mostrar todos os resultados remove apenas os filtros de jogo, categoria e busca, preservando a ordenação escolhida.

Os testes Playwright cobrem exibição a 390 px, navegação e retorno dos Detalhes, remoção por teclado, catálogo JSON importado, favoritos e ausência de comandos de instalação ou remoção.

### Ordenação reversível por tamanho declarado na Biblioteca

A Biblioteca permite ordenar os favoritos por **tamanho declarado
(maior/menor primeiro)**, preservando as ordenações já existentes e o
fluxo de Detalhes anterior/próximo na ordem filtrada. O conversor
estritamente local reconhece unidades decimais (B, KB, MB, GB, TB)
e binárias (KiB, MiB, GiB, TiB), números com vírgula ou ponto e
descarta quantidades ambíguas ou grandes demais. Tamanhos não
reconhecidos ficam **por último** em qualquer direção, com empates
estáveis por título/ID. Ao selecionar essa ordem, um aviso deixa
explícito que o dado é metadado fornecido pelo catálogo, e **não**
consumo real de espaço no disco.

As ações de limpar filtros e remover apenas o chip de ordenação
voltam à ordem original sem apagar favoritos nem seleção de análise.
Nenhuma operação de arquivo, instalação, medição de disco ou alteração
do sandbox é efetuada.

### Subtotal de tamanhos declarados dos favoritos visíveis

A Biblioteca soma somente os **tamanhos declarados dos favoritos exibidos**
segundo os filtros atuais. A ordem não altera os resultados. Valores incertos
são excluídos com contagem explícita; zero valores reconhecidos não produz
um falso valor de espaço. O subtotal usa BigInt para evitar transbordamento
da soma de metadados seguros, com apresentação arredondada e marcada ≈,
em unidades decimais. O texto explica que **não se trata de espaço em disco
nem de instalação verificada**. A implementação não lê nem altera mods, jogos,
sistema de arquivos ou sandbox. Testes cobrem metadados mistos, filtros,
ordenação, dados desconhecidos, agregados grandes e 390 px.

### Visão rápida por simulador na Biblioteca (somente favoritos)

A Biblioteca agora separa uma visão **de todos os favoritos cadastrados**
por OMSI 2, ETS2 e ATS, mostrando contagem e subtotal de **tamanhos declarados**
com quantidade desconhecida. As contagens representam a coleção inteira,
independentemente dos filtros atuais; isso é explicado na tela. Botões nativos
com `aria-pressed` funcionam como atalhos reversíveis para o filtro de jogo
existente, sem trocar ordem, seleção de análise ou favoritos. Em 390 px, os
cartões se ajustam à largura sem rolagem horizontal. Este painel não altera o
estado de compatibilidade, não mede espaço real nem autoriza instalação;
suas únicas fontes são os metadados já carregados.

### Filtro reversível: tamanho de catálogo reconhecido ou desconhecido

A Biblioteca oferece dois atalhos para selecionar favoritos com tamanho
**interpretável** ou **desconhecido/inválido**, usando a mesma conversão
segura já presente na ordenação. `0 B` explicitamente declarado conta como
reconhecido, enquanto ausência, unidades não suportadas e notação ambígua
ficam no grupo desconhecido. A contagem dos botões considera **todos os
favoritos**, com procedência visível. O filtro combina com jogo, categoria,
alertas, busca, seleção e ordenação, participa dos filtros ativos e pode ser
removido pelo chip acessível ou pelo botão geral de limpar filtros.
Importar catálogo ou restaurar demonstração limpa esse filtro, sem alterar
favoritos indevidamente. Testes Playwright incluem zero vs. desconhecido,
combinação com outros filtros, navegação por teclado, Detalhes e tela de 390 px.
Nenhum conteúdo de jogo/mod é aberto, instalado ou alterado.

### Detalhes: procedência e interpretação de tamanho declarado

O painel Detalhes apresenta a interpretação do tamanho fornecido no catálogo:
**reconhecido**, **formato não reconhecido** ou **zero explicitamente declarado**.
Um valor ausente ou inválido não é tratado como 0 B. Quando reconhecido e
positivo, a equivalência arredondada em unidades decimais aparece com ≈; 
continua sendo apenas metadado, não medição do pacote nem do disco. O
indicador identifica se o valor veio do catálogo demonstrativo ou de JSON
importado e atualiza ao navegar Anterior/Próximo. Não abre pacotes, mede disco,
certifica compatibilidade, nem permite instalação/remoção.
Três testes Playwright exercitam troca de mod, zero/unknown, modelo
demonstrativo, navegação filtrada pela Biblioteca, foco e largura de 390 px.

### Seleção para análise conjunta diretamente nos Detalhes da Biblioteca

A tela Detalhes, **quando aberta a partir da Biblioteca e o mod ainda é
favorito**, permite marcar/desmarcar esse mod para a análise declarativa
conjunta. É o mesmo estado dos checkboxes da Biblioteca, sem cópia paralela
ou alteração de favoritos. Alterações fecham relatórios de seleção em aberto
para não exibir resultados obsoletos. A quantidade de favoritos marcados na
sessão permanece visível. A opção não aparece ao abrir Detalhes pelo Catálogo
ou pelos Destaques, nem para itens removidos dos favoritos; remoção de
favorito também elimina a seleção antiga, sem restaurá-la ao favoritar de novo.

Com filtro "Só selecionados", desmarcar um item pode removê-lo da lista
atual; a navegação passa a informar "Fora dos filtros atuais" em vez de
inventar um vizinho. A interface continua somente com metadados e
instalação/remoção seguem bloqueadas. Quatro testes Playwright cobrem
passagem anterior/próximo, estado compartilhado, saída de filtro, perda
de favorito, refavoritar, escopo Catalog vs Biblioteca e viewport 390 px.

### Detalhes → Biblioteca: atalho para revisar seleção declarativa

Quando Detalhes tem origem na Biblioteca e existe algum favorito
selecionado, o botão `Revisar seleção na Biblioteca (N)` volta
ao painel existente da Biblioteca e posiciona o foco de teclado
nele. Os filtros e seleções são preservados. O atalho não
abre a análise automaticamente, não salva relatórios e não
lê/instala/edita arquivos de mods. Sem seleção ou com origem
Catálogo/Destaques, o atalho não aparece. O painel de destino
ganha um ID estável e `tabIndex=-1`; três testes Playwright
cobrem foco, preservação, ausência de análise automática,
Enter e largura de 390 px.

### Busca por ID e versão declarados nos metadados do catálogo

As pesquisas locais de Catálogo e Biblioteca também consideram `id`
e `version` da ficha JSON, além de título, categoria e nome do jogo.
A normalização existente de acentos, caixa e termos independentes é
preservada. O ID é exibido nos Detalhes com o rótulo explícito
**ID declarado no catálogo**, distinto de um ID real instalado.
Isso permite conferir referências de dependências sem abrir arquivos
de mod, pastas de jogo, rede ou instaladores. O ID de até 64 caracteres
quebra linhas para telas móveis e não afeta filtros, favoritos nem seleção.
Três testes Playwright cobrem busca por ID/versão, origem declarada,
navegação Anterior/Próximo, limites operacionais e viewport de 390 px.

### Resultados da busca explicam ID/versão declarados

Após busca por ID ou versão, os cartões do Catálogo e da Biblioteca
identificam **qual campo declarado contém um dos termos** (ID e/ou versão).
O aviso não aparece para busca vazia ou para coincidência somente no
título, categoria ou jogo. Não altera o algoritmo de seleção de resultados
nem a ordenação. Em combinações de termos, ambos os campos podem aparecer.
Os cartões continuam explicando apenas o JSON local: nenhuma identificação
real de arquivo, instalação ou compatibilidade é inferida. Não há
consultas externas. Três testes Playwright cobrem ID, versão, ambos,
ausência do aviso, seleção da Biblioteca, retorno de Detalhes e 390 px.

### Consulta por ID a partir da linha do tempo de dependências

Em Detalhes, cada etapa **direta ou indireta** que existe no catálogo
validado agora tem um atalho "Localizar ID no Catálogo" nos dados
declarados. Esse atalho apenas abre a busca pelo ID local, limpa filtros
do Catálogo que impediriam o resultado e posiciona foco no campo de
pesquisa. Não instala, detecta, lê, valida ou modifica o mod. A busca
por ID continua sendo uma consulta a metadados, sem afirmar presença
ou compatibilidade real. IDs ausentes e a etapa do mod selecionado não
ganham atalhos fictícios. Filtros da Biblioteca permanecem inalterados.
Três testes Playwright exercitam dependência indireta, seleção via teclado
e foco, viewport 390px e ciclo com referência ausente.

### Consulta reversível de dependência com retorno ao diagnóstico

O atalho "Localizar ID no Catálogo" passa a mostrar um contexto temporário
que informa de qual mod/diagnóstico veio a consulta. O botão **Voltar ao
diagnóstico original** restaura os quatro controles anteriores do Catálogo
(jogo, categoria, pesquisa e ordem) e retorna ao Detalhes original, com
a hipótese de versão preservada e foco na seção de relações. O botão
**Restaurar filtros do Catálogo** encerra a consulta e reconstitui apenas os
controles anteriores, com foco no campo de busca. Os dois caminhos são
explicitamente reversíveis: não modificam favoritos, seleção conjunta,
instalações, pacotes, nem leem arquivos locais. Importar um JSON válido ou
restaurar a demonstração invalida o contexto para impedir retorno a
IDs de um catálogo antigo. Três testes Playwright exercitam ida e volta,
teclado em 390px e descarte de contexto em troca de catálogo.

### Localização de dependência por ID exato (sem colisões por prefixo)

O atalho "Localizar ID no Catálogo" ativa uma correspondência
**exata** enquanto o campo contém o mesmo ID de destino declarado.
Assim, `dep` não traz automaticamente `dep-extra`. O aviso no
contexto indica quando o ID exato está ativo. Ao editar a
pesquisa, o usuário volta ao comportamento normal de termos e
substrings; ao digitar novamente o ID exato, o alvo é isolado.
Retornar ao diagnóstico, cancelar a consulta ou trocar o catálogo
remove o contexto. A verificação é apenas no JSON validado,
nunca em arquivos reais, versões instaladas ou compatibilidade.
Três testes Playwright cobrem colisão de prefixo, alternância
de modo, retorno, teclado e viewport 390 px.

### Referências recebidas por um mod (arestas reversas diretas do catálogo)

A seção "Quem menciona este mod no catálogo?" em Detalhes mostra outros
registros que declaram diretamente o ID selecionado em `requires` ou
`conflictsWith`. Cada grupo é **unilateral**, não inferindo versões,
arestas transitivas, conflitos recíprocos nem instalações. Preserva
referências entre jogos diferentes para que as inconsistências sejam
visíveis, e distingue estado vazio de qualquer alegação de compatibilidade.
Os botões usam a localização exata de ID e o retorno reversível ao
diagnóstico já existente. Os testes cobrem direção, autorreferência,
dependência indireta, conflito, salto ao Catálogo, retorno, 390px e
dados entre jogos. Apenas JSON validado é consultado.

### Referências recebidas: bilateralidade declarada e jogo de origem

A UI de Detalhes distingue agora **declaração unilateral de conflito**
(um outro registro aponta para o ID selecionado) de **declaração
recíproca** (ambos os registros explicitamente se mencionam em
`conflictsWith`). Reciprocidade não comprova incompatibilidade no jogo.
Dependências e conflitos recebidos de outro jogo recebem identificação
expressa de **referência entre jogos diferentes**, com o jogo declarado.
Nenhuma relação transitiva ou simétrica é inferida.
Dois testes adicionais cobrem a mistura de conflitos recíprocos e
unilaterais, referência entre jogos diferentes, ações bloqueadas e
viewport 390px.

### Biblioteca: avisos separados de referências recebidas

Os cartões de favoritos apresentam, quando houver, uma área neutra
indicando quantos **outros registros do catálogo completo** declaram
depender diretamente daquele ID ou conflito com ele. Essas contagens
não se misturam aos bloqueios e avisos da análise declarativa do
próprio mod; a ausência de uma referência não é comprovação de
compatibilidade. A ação **Ver referências recebidas** abre Detalhes,
foca a seção correspondente e permite voltar ao mesmo cartão e
filtros da Biblioteca. A seção não executa leitura, instalação,
inspeção real ou deduções de relações transitivas. Ao importar outro
catálogo, as contagens são recalculadas pelo JSON validado.

Testes Playwright: contagem dependência/conflito recebida, separação
dos alertas, navegação por teclado e foco em 390px, retorno com filtros
e recálculo após troca de catálogo. O trabalho permanece na etapa
visual Biblioteca/Detalhes.

### Biblioteca: ordenação por referências diretas recebidas no catálogo

A ordenação **Referências recebidas no JSON (mais primeiro)** usa
somente a soma das referências diretas `requires` e `conflictsWith`
recebidas de outros registros do catálogo completo, inclusive não
favoritos ou registros ocultos pelos filtros. Empates são resolvidos
pelo número de dependências recebidas, depois título e ID.

Essa ordenação não mede popularidade, severidade, funcionamento,
compatibilidade nem instalação. A escolha convive com filtros, chips,
limpeza de filtros e Anterior/Próximo em Detalhes vindo da Biblioteca.
Três testes Playwright verificam a contagem de não favoritos, a
ordem determinística, 390px, filtros, retorno e operações bloqueadas.
