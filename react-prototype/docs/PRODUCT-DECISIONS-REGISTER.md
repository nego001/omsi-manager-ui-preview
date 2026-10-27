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
