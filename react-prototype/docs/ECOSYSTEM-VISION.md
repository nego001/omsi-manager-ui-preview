# OMSI Manager | Visão do ecossistema inteligente

**Estado:** especificação de produto aprovada como direção, NÃO como implementação pronta.  
**Jogos iniciais:** OMSI 2, Euro Truck Simulator 2 (ETS2), American Truck Simulator (ATS). OMSI 1 somente após estudo de formato e suporte concreto.  
**Etapa ativa (23/10/2026):** acabamento visual da Biblioteca e Detalhes do protótipo React/Electron, mantendo a CI verde e a instalação real desativada.

## Princípio do produto

O usuário deve conseguir **selecionar mods, entender sua situação e administrar sua biblioteca com o mínimo de cliques**. O aplicativo precisa ser visualmente rico, mas a complexidade deve ficar no motor de inteligência, não em dezenas de opções. O objetivo se aplica a **todo o ecossistema**: Início, biblioteca, catálogo/loja, visualização, diagnóstico, compatibilidade, instalação, atualização, manutenção, desinstalação, backups, restauração e suporte.

O programa deve prevenir problemas comuns e explicar o que encontrou, mas **nunca fingir certeza**: um diagnóstico sem evidência suficiente fica marcado como "Não verificado" e não resulta em instalação automática.

## Experiência-alvo

1. Usuário arrasta ou seleciona um ou vários arquivos/pacotes de mods. O aplicativo apresenta imediatamente uma **pré-análise somente leitura**.
2. O identificador de formato detecta o tipo de contêiner (ex.: ZIP, SCS) por assinatura e estrutura, não apenas extensão. Valida tamanho, caminhos e limites antes de abrir conteúdo.
3. Uma classificação **multissinal** combina árvore interna, arquivos típicos, metadados de manifesto, modelos e dependências para estimar **OMSI 2, ETS2, ATS ou desconhecido**; mostra evidências e confiança. Se indícios forem ambíguos, oferece confirmação simples e não mistura jogos.
4. A biblioteca visual agrupa os mods por **jogo e categoria** (ônibus, mapa, veículo/caminhão, reboque, som, gráficos, tráfego, utilitários etc.), com pesquisa e filtros de categoria, estado e origem. A categorização deve ser baseada nos arquivos e nas regras de cada simulador, não em rótulos fornecidos cegamente.
5. A imagem da biblioteca privilegia **arte real do próprio pacote**, miniatura/preview do mod ou imagem fornecida por fonte legítima com proveniência; em ETS2/ATS, procurar arquivos de apresentação/ícones compatíveis com o formato; em OMSI 2, procurar imagens associadas ao veículo/mapa e arquivos de prévia. Um render 3D local só entra quando o formato for suportado e o render puder ser produzido com segurança. **Não apresentar uma imagem de IA como se fosse captura autêntica do mod.** Sem mídia confiável, usar ilustração genérica claramente rotulada.
6. O sistema detecta instalação do jogo **se houver permissão e evidência**. Uma pasta de mods remanescente não comprova que o jogo está instalado. Mostrar os estados separadamente: "Pasta de mods encontrada" e "Jogo não localizado". A opção de preparar destino sem jogo exige autorização explícita e caminho reconhecido; **não presumir que instalar na pasta equivale a ativar o mod**.
7. Diagnóstico: identificar versão **declarada** do mod, versão **detectada** do jogo quando realmente disponível, pré-requisitos, conflitos, conteúdo faltando e possíveis incompatibilidades. Estados: **Compatível verificado no cenário testado**, **Incompatível confirmado**, **Suspeita de incompatibilidade**, **Precisa de atualização**, **Não verificado**, **Inspeção incompleta**. Resultados são específicos de versão do jogo e mod, com fonte da evidência e data.
8. Se o jogo atualizou ou o mod é antigo, oferecer **Analisar atualização** em vez de corrigir às cegas. Um pipeline de adaptação pode inspecionar logs de crash, referências de modelos, caminhos de texturas, materiais, definições, áudio e formatos por versão. Alterar apenas `manifest.sii` raramente resolve incompatibilidade. Toda transformação usa uma regra versionada com testes, pacote original imutável, cópia de trabalho e rollback.
9. Antes de qualquer instalação real: simular o plano, informar arquivos afetados, hashes, dependências, espaço e eventuais conflitos. Só então executar uma transação com backup, staging isolado, validação, confirmação e rollback. Nunca sobrescrever ou remover silenciosamente mods de terceiros.
10. Após instalar: confirmar integridade e presença nos diretórios, **sem afirmar ativação no jogo** sem observar evidência apropriada. Erros de log devem gerar diagnóstico compreensível; a correção não pode ser prometida quando o formato/versão não é suportado.
11. Desinstalar: identificar ownership pelos registros da transação e remover **apenas arquivos que o próprio gerenciador colocou**, preservando modificações manuais e outros mods, com restauração fácil.
12. Loja/catálogo: combinar curadoria, busca e sinalização transparente de origem, autoria, licença, integridade e compatibilidade. Não atribuir a si arquivos ou screenshots dos criadores. Uploads/downloads e execução de código externo requerem mecanismos próprios de segurança.

## Leitura espalhada: módulos especializados trabalhando juntos

**Requisito transversal:** o usuário não quer um "leitor único". O analisador deve **distribuir a leitura entre módulos cooperativos** (estrutura, metadados, definições OMSI/ETS2/ATS, modelos/texturas, áudio, capas reais, versões, integridade e destinos), cada um responsável por uma parcela do pacote. Um coordenador reúne evidências, interpreta conflitos e produz uma **identificação conjunta**. O planejamento da instalação e sua futura validação utilizam **o mesmo resultado**, não um segundo detector desconectado.

Os módulos independentes podem executar em paralelo **somente depois de um gate de segurança e índice imutável**, com limites globais de recursos e acesso restrito às entradas permitidas. Divergência ETS2/ATS, versão desconhecida, pacote híbrido ou falha de módulo **não autorizam instalar automaticamente**. Sem evidência: apresentar "Não verificado" ou "Inspeção incompleta".

**Contrato específico, diagrama, módulos, testes adversariais e sequência futura:** [DISTRIBUTED-MOD-READER.md](DISTRIBUTED-MOD-READER.md). Essa leitura cooperativa será aplicada a **análise, biblioteca, atualização, instalação, conferência pós-instalação e desinstalação**; ainda não está implementada no protótipo.

## Núcleo de conhecimento: distribuição do resultado para todos os setores

A leitura espalhada produz um retrato comum `AnalysisSnapshot` que **não é exclusivo do Analisador nem do Instalador**. Outros setores recebem **projeções especializadas** dos dados necessários, sem acesso indiscriminado ao arquivo ou aos caminhos do usuário. A Biblioteca recebe identidade, filtros, mídia e estados; o Instalador recebe o retrato e suas evidências para construir plano simulado; o Atualizador recebe versões/diferenças; diagnósticos recebem constatações sanitizadas.

A **Oficina** recebe capacidades comprovadas do mod: para **skins**, referências permitidas de texturas, materiais, UVs e templates; para **sons**, mapeamentos, eventos, arquivos e configurações suportados pelo jogo/versão. Ela só oferece o editor realmente compatível com o pacote, mantém o original íntegro e salva derivados em workspace isolado. Uma skin ou configuração sonora modificada **volta aos leitores responsáveis pela parte alterada**, produz um novo snapshot, atualiza a Biblioteca e obriga o plano futuro de instalação a ser revalidado. Ausência de suporte não deve ser mascarada por IA.

**Contrato transversal detalhado:** [SHARED-ANALYSIS-ECOSYSTEM.md](SHARED-ANALYSIS-ECOSYSTEM.md). O núcleo e os editores da Oficina são **arquitetura prevista**, não recursos operacionais do protótipo.

## Arquitetura prevista (módulos separados)

| Módulo | Responsabilidade | Limite |
| --- | --- | --- |
| Intake | Recebe arquivos selecionados, faz hash e identifica tipos | Não extrai/executa sem verificação |
| Archive Safety | Inspeciona arquivos compactados em sandbox e impõe limites de recursos | Bloqueia path traversal, symlinks, zip bombs, executáveis |
| Detector | Regras independentes para OMSI 2, ETS2 e ATS; classificação por evidência | Resultado desconhecido quando sinais são insuficientes |
| Inventory | Diferencia arquivos de mod, destinos, instalação e presença do jogo | Não deduz "instalado" apenas porque a pasta existe |
| Media Resolver | Extrai previews legítimos com origem e permissões, cria thumbnails locais | Nunca inventa captura real |
| Compatibility | Matriz de versões, relações, regras de dependência, evidência de logs | Nunca transforma "sem aviso" em "compatível" |
| Update Analyzer | Gera proposta de adaptação com mudanças justificadas | Nenhuma correção irrestrita, mutação sempre em staging |
| Transaction Engine | Plano, backup, cópia atômica quando possível, hash, commit, rollback | Sem exclusão arbitrária nem escrita antes de consentimento |
| Library UI | Visão bonita, filtros combináveis, estados, ações contextuais | O usuário vê o essencial; detalhes avançados sob demanda |
| Store/Creators | Origem, licença, direitos de distribuição, avaliação e atribuição | Não trata conteúdo de terceiros como próprio |
| Diagnostics | Logs sanitizados, códigos de erro e plano de ação | Sem envio de dados privados sem autorização |

## Pipeline mínimo de segurança de compatibilidade

`Entrada → Verificar contêiner e limites → Classificar por sinais → Conferir dependências e versões → Prévia e origem da imagem → Plano simulado → Consentimento → Backup + staging → Validação → Instalação transacional → Registro → Recuperação/rollback`.

**Regras obrigatórias:**

- Ausência de evidência não autoriza modificação; classificação não depende apenas de nome/extensão; sinal ETS2 não implica automaticamente que é ATS e vice-versa.
- Nenhum processo de IA modifica mods reais silenciosamente. Recursos com IA apenas sugerem diagnósticos até serem suportados por verificações técnicas e testes.
- Para versões antigas, validar na versão-alvo em ambiente de teste. Corrigir `manifest`, modelos, texturas, materiais ou áudio depende de formato e erro concretos; algumas versões não são recuperáveis automaticamente.
- Preservar autor, licença, permissões e integridade dos arquivos originais. O gerenciador não remove proteção ou reempacota conteúdo de terceiros para distribuição sem autorização.
- Biblioteca e análise precisam funcionar offline quando possível; conectividade para marketplace e metadados de terceiros deve ser opcional e identificada.
- Coletar o mínimo de dados e jamais enviar nomes de arquivos/caminhos pessoais sem consentimento claro.

## Fluxo visual da biblioteca planejada

Barra com **Jogo [Todos / OMSI 2 / ETS2 / ATS]**, **Categoria [Todas / Mapas / Ônibus / Caminhões / Sons / ...]** e **Estado [Todos / Atualização disponível / Incompatível / Não verificado]**. Grade de capas com imagem do mod (e indicação de sua origem), nome, versão, jogo e uma etiqueta de estado. Ações contextuais aparecem somente quando aplicáveis e fundamentadas. O clique leva a Detalhes com evidências, dependências e plano de ação, sem exigir navegação por dezenas de menus.

**Nesta fase do protótipo**, a Biblioteca contém somente favoritos do catálogo demonstrativo. Não interpretar esses favoritos como mods instalados. A evolução visual desta etapa deve abrir espaço para filtros e estados **declarativos**, sempre identificados como simulação, sem ler arquivos de jogos.

## Ordem de execução

- **Etapa atual: UI v1.** Consolidar aparência da Biblioteca e Detalhes, filtros de favoritos por jogo/categoria e estados transparentes baseados somente em metadados. Testes de navegação, teclado, contraste, mobile, Windows e screenshots.
- **Depois: contratos de leitura.** Especificar interfaces do detector, representação de evidências, mídia legítima e casos conhecidos de OMSI 2 / ETS2 / ATS. Criar corpus de fixtures sintéticas e testes de identificação sem tocar nos jogos.
- **Depois: leitor real isolado.** Inspecionar um pacote escolhido pelo usuário, com controles de segurança, sem extração irrestrita, sem escrever no jogo e com permissões claras.
- **Depois: diagnóstico e atualização proposta.** Matriz de compatibilidade respaldada, leitura segura de logs, transformações testadas em staging; sem promessas de atualização automática universal.
- **Por último: operações reais.** Revisar backup privado do programa, desenho de transações, backup e rollback, testes de falha/interrupção, versão física Windows, e só então habilitar instalação/desinstalação por etapas.
- **Loja e criadores:** requisitos transversais desde já (origem, mídia, licença, confiança), implementação conforme segurança e modelo de publicação.

## Critérios globais de qualidade

- Um usuário novo consegue filtrar, identificar e entender um mod com poucos passos.
- Todos os resultados automáticos trazem justificativa ou indicação visível de incerteza.
- Tudo que modifica disco deve ser reversível, auditável e autorizado.
- Interface cheia de conteúdo útil, não de controles redundantes; desempenho e acessibilidade sustentados.
- Cada módulo possui testes sintéticos adversariais e uma etapa específica de homologação em máquina real.
- A visão deve valer para **o produto inteiro**, não apenas o instalador.

### Estado da implementação

Esta página é uma **especificação/roadmap**. Detector binário, imagens autênticas de mods, compatibilidade real, adaptação de versões, instalação e desinstalação **ainda não foram implementados nem homologados**. A branch `feat/react-nine-screens-safe` e o PR #1 seguem como protótipo isolado, sem merge e sem alterar o programa original.
