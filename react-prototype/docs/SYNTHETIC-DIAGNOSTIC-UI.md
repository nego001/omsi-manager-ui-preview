# OMSI Manager | Laboratório visual da linha do tempo sintética

**Implementado na prévia de nove telas**, dentro da página Histórico, abaixo do histórico REAL de atividades que permanece vazio.

A demonstração tem título e limites visíveis, sem confundir execução real com simulação:
- `src/synthetic-diagnostic-demo.ts` constrói quatro etapas de uma mesma história, inteiramente a partir de fixtures estáticos em memória, com gates, revisões, tickets e relatórios sintéticos. Não abre pastas, arquivos de mods, jogos nem executa IPC.
- `src/SyntheticDiagnosticPreview.tsx` apresenta etapas selecionáveis, estado atual da análise, revisão ativa, módulos pendentes, jogo apenas candidato fictício, revisões históricas, sete especialistas por revisão e explicações por teclado.
- Revisões anteriores são marcadas como históricas e não voltam a ser o jogo candidato da revisão atual. Uma pintura declarada como alterada destaca módulos afetados sem dispensar os demais; áudio ausente não é chamado de OK.
- A visualização contém ênfase permanente em "somente demonstração", "mod fictício" e "operações bloqueadas". A página de Histórico continua exibindo "Sem atividades registradas" para atividades reais. As outras oito telas, ações bloqueadas e a navegação de nove páginas continuam intactas.
- `src/style.css` recebeu estilos novos limitados ao laboratório, cartões e responsividade de 390/850/1440 px, além de foco visível.
- `tests/synthetic-diagnostic-preview-ui.spec.ts` cobre 9 cenários de UI, incluindo navegação por teclado, separação entre evento real e fictício, revisões, priorização, segurança e geometria.

Não existe parser ZIP/SCS, leitura real, hash de conteúdo ou certificação de compatibilidade. A demo não lê arquivos escolhidos pelo usuário e não salva dados em disco. Instalar, remover, atualizar, oficina de skin e áudio seguem indisponíveis. PR em rascunho, sem merge; homologação do executável na máquina pessoal do usuário não foi feita.

## Filtros de diagnóstico sintético

- Novo módulo puro `src/synthetic-timeline-filter.ts`. Aceita apenas `all`, `pending`, `blocked` e `changed`: todos, pendentes/ausentes/incompletos, bloqueados e afetados por mudanças declaradas.
- `SyntheticDiagnosticPreview.tsx` usa um filtro nativo acessível por teclado e mostra a contagem de registros visíveis entre todas as revisões do cenário fictício. O filtro permanece selecionado ao navegar entre etapas do cenário.
- Nenhuma revisão é removida pelos filtros. Seus títulos, situação, eventual candidato histórico e o resultado total de sete especialistas continuam apresentados, mesmo quando nenhum especialista corresponde à seleção. A situação geral não é recalculada por ocultação visual.
- Os dados de entrada e saída são imutáveis; as opções de instalação, remoção e edição permanecem desativadas. A seleção atua somente na apresentação, não reanalisa arquivos nem libera ações.
- Testes de funções e de interface cobrem ausência de correspondências, seleção persistente, ordenação, histórico substituído, navegação por teclado e responsividade.


## Comparação lado a lado entre duas revisões fictícias

- O novo contrato `src/synthetic-revision-comparison.ts` compara **dois números de revisão distintos e ordenados cronologicamente** da mesma timeline sintética emitida. Objetos reconstruídos/copias JSON e resultados filtrados não são aceitos como fonte de comparação: um `WeakSet` privado identifica as timelines geradas pelo coordenador de histórico.
- A comparação lista sete especialistas em ordem estável, com estado antes/depois, quantidade de observações declaradas, diferença do sinal de prioridade da alteração, explicação e contagem de módulos alterados. O algoritmo **não compara bytes reais** nem considera indicadores iguais uma prova de integridade.
- Na visualização `SyntheticDiagnosticPreview.tsx`, as duas revisões podem ser escolhidas com controles nativos acessíveis por teclado. O usuário não pode escolher a mesma revisão nem inverter a cronologia. Na etapa inicial, com uma única revisão, aparece uma mensagem informativa, sem controles falsos.
- A comparação utiliza a timeline **completa**, mesmo quando a interface principal está filtrada em "Somente bloqueados" ou outro filtro. Os cartões lado a lado deixam visível que o candidato da revisão anterior é apenas histórico; uma revisão pendente não reutiliza classificações anteriores.
- Layout adaptativo em 390/850/1440 px, sem criar décima tela, alterar o registro real de atividades ou habilitar instalação, remoção, Oficina ou atualização. 13 testes do contrato e 11 testes de interface foram adicionados.
- Contrato de dados puro, isolado e ficcional: não há parser real, acesso às pastas de jogos, SHA-256 de arquivos reais, confirmação de instalações ou gravações. A validação automatizada não substitui homologação manual em um PC Windows real.


## Orientação de conferência, não análise de risco (etapa nova)

- `src/synthetic-revision-comparison.ts` marca em um `WeakSet` privado as comparações realmente produzidas pelo comparador fictício. Uma cópia JSON, comparação fabricada ou resultado filtrado não passa por essa associação de identidade em memória. Ela não é autenticação.
- `src/synthetic-comparison-review.ts` recebe apenas comparações emitidas, classifica os sete especialistas em `investigate-first` (relatório bloqueado, ausente, incompleto ou pista de impacto declarada), `recheck-required` (estado pendente sem pista de impacto) e `informational` (somente mudança de estado/quantidade declarada ou indicadores inalterados). **Prioridade significa ordem sugerida de conferência de fixtures, jamais risco, vulnerabilidade, compatibilidade ou falha real comprovados.**
- Cada especialista informa *se* houve alteração de estado, de contagem de observações ou da pista declarada de impacto, e fornece uma justificativa curta. A classificação não afirma diferenças reais em arquivos, não revalida hashes e não reaproveita observações.
- O laboratório em `src/SyntheticDiagnosticPreview.tsx` possui contadores das três classes e filtro exclusivo da **apresentação da comparação**. A linha do tempo independente e seus filtros não alteram a classificação. Totais e resumo das revisões continuam intactos mesmo que zero especialistas sejam exibidos.
- `tests/synthetic-comparison-review.spec.ts` e `tests/synthetic-comparison-review-ui.spec.ts` cobrem tipos de evidência, ausência de relatórios, estados pendentes, pistas de impacto, contradições de exibição, histórico, imutabilidade, segurança e tamanhos 390/850/1440 px.

Limitação: todos os módulos e exemplos são simulados na memória do protótipo. A prioridade não gera uma fila real nem permite ações de instalação, edição, remoção ou atualização. Não há inspeção dos arquivos de jogos/mods, comunicação externa, hashes reais ou homologação manual em Windows físico.


## Por que um tipo de mudança pode envolver um especialista? (24/10/2026)

- `src/synthetic-change-explanations.ts` explica apenas *relações indicativas por escopo declarado*: tipos fictícios .dds/.png/.jpg são associados a Estrutura/Definições/Recursos/Imagens; .wav/.ogg/.bank a Estrutura/Definições/Áudio; .json a Estrutura/Manifestos/Relações. Outros tipos seguem o contrato da revalidação. **Isso não é dependência real, diagnóstico causal ou detecção de defeito.**
- O módulo compara **índices que foram emitidos pelo gate**, consultando os caminhos canônicos somente por meio da comparação privada. Publica exclusivamente operação (inclusão/remoção/modificação), sufixo, tipo arquivo/pasta, quantidade de declarações e módulos potencialmente envolvidos. Omite nome completo, path, raiz, digest, handles e conteúdo.
- A renomeação aparece como *retirada + inclusão*, jamais como identidade real do arquivo renomeado. Modificações com troca de classificação podem produzir mais de uma anotação; contadores representam **declarações**, não arquivos físicos identificados.
- Mudança **apenas de digest informado** e índices com declarações **aparentemente idênticas** são explicados sem inventar diferenças; independentemente da coincidência, a nova revisão exige a reanálise dos sete especialistas. O digest é fornecido pelo fixture, nunca calculado.
- `src/synthetic-diagnostic-demo.ts` mantém vínculos entre o objeto de etapa original e os índices sintéticos de cada revisão via `WeakMap`. Comparações não consecutivas (revisão 1 → 3) exibem as duas alterações declaradas, sem vazar nomes ou permitir que clones de etapas recuperem índices.
- `src/SyntheticDiagnosticPreview.tsx` apresenta `O que pode estar relacionado às mudanças?` acima das orientações de conferência, com detalhes por tipo de alteração e explicação explícita de que não existe prova de causalidade. Os filtros de timeline e de orientação **não alteram esses registros**.
- `tests/synthetic-change-explanations.spec.ts` e `tests/synthetic-change-explanations-ui.spec.ts` cobrem privacidade, associação por extensão, grupo e contagem, rejeição de índices/etapas clonados, história 1/2/3, filtros independentes, texto honesto, responsividade e instalação desativada.

**Fronteira de segurança:** tudo é fictício e em memória; não acessa diretórios de jogos, arquivos reais, processos ou rede; não verifica hashes ou compatibilidade; não habilita escrita nem ações na Oficina. As nove telas aprovadas permanecem com o visual original fora desta seção de laboratório. O PR segue draft e a homologação manual em um computador Windows físico não foi realizada.


## Parecer explicável: por que uma conclusão ainda não é confirmada

- `src/synthetic-decision-explanation.ts` projeta um parecer imutável para uma revisão da **timeline completa e genuinamente emitida** pelo coordenador sintético. Um histórico clonado, falso ou filtrado não pode emitir parecer porque a procedência em memória é verificada antes de ler relatórios.
- Mesmo em estado `candidate` com 7 de 7 especialistas OK, o parecer exibe `confirmation: not-confirmed`: consenso do fixture não confirma identidade do jogo, integridade de arquivos, compatibilidade ou instalação real.
- Os dados publicados são SOMENTE identificadores fixos dos sete especialistas, seus status, a quantidade de observações declaradas e uma pista booleana de impacto. **Nunca** caminhos, nomes, tickets, handles, bytes, valores de hash ou arquivos privados.
- As razões são estruturadas com códigos de falta de comprovação (fixture fictício, conteúdo real não lido, digest declarado não verificado, compatibilidade não testada e instalação não validada), acrescidas de motivos específicos conforme o estado: revisão histórica, reanálise pendente, relatório ausente, incompleto ou bloqueado, alegações contraditórias, evidências insuficientes ou candidato apenas provisório.
- A apresentação em `src/SyntheticDiagnosticPreview.tsx` exibe o parecer da **revisão ativa** e oferece expansão por teclado dos sete indícios declarados. Ela fica isolada abaixo do histórico de atividades reais, que continua vazio. Os filtros da timeline e da comparação não alteram os fatos do parecer, que parte do resultado não filtrado.
- `tests/synthetic-decision-explanation.spec.ts` acrescenta 18 testes de contrato e `tests/synthetic-decision-explanation-ui.spec.ts` acrescenta 8 testes de interface, incluindo os estados candidato, histórico, pendente, ausente, incompleto, bloqueado, ambíguo e não identificado; apresentação móvel, privacidade e bloqueios de operações.

**Limites:** nenhuma classificação constitui análise real de bytes, malware, dependências, mods ou jogos. Não existem hashes de arquivos reais nem integração autorizada com diretórios pessoais. A interface apenas exibe fixtures em memória: operações de instalar, remover, atualizar e editar continuam indisponíveis. Nenhum histórico real é produzido. PR permanece draft, sem merge, e validação manual no Windows físico do usuário segue pendente.


## Requisitos para uma futura validação real (24/10/2026)

O módulo `src/synthetic-validation-readiness.ts` descreve **12 requisitos de engenharia distribuídos em quatro etapas**, sempre com `status: not-evaluated`, `completed: false`, `approvedForOperations: false` e `operationsEnabled: false`.

Etapa **Origem e isolamento**: consentimento para um arquivo específico, confinamento de caminhos/symlinks/junctions, limites de tamanho/expansão/tempo/cancelamento de arquivos potencialmente hostis. Etapa **Integridade e leitura**: hash SHA-256 calculado sobre bytes reais e associado à revisão, parser ZIP/SCS/OMSI seguro e relatórios independentes dos especialistas. Etapa **Dependências e compatibilidade**: avaliação efetiva de dependências/conflitos, critérios reais de jogo/versão e homologação supervisionada em Windows físico. Etapa **Segurança antes de operações**: backup e restauração testados, rechecagem de integridade/identidade contra TOCTOU imediatamente antes da escrita e aprovação explícita da ação e do destino pelo usuário.

A lista é **design futuro, não auditoria**. Nenhum item pode ser marcado como verificado com evidência fictícia ou uma simples interação na UI. Mesmo depois de uma futura implementação comprovada dos requisitos, será necessário desenvolver e auditar um mecanismo independente de autorização por operação. Não existe hoje tal mecanismo nem aprovação implícita.

`createSyntheticValidationReadiness()` somente aceita timelines sintéticas emitidas de verdade pelo coordenador em memória, nunca clones, cópias ou apresentações filtradas. `filterSyntheticValidationReadiness()` somente modifica os itens VISÍVEIS e exige um plano emitido no WeakSet interno. Nenhuma conclusão sobre mods reais, validação de bytes, hashes ou permissões é inferida do consenso entre os sete especialistas fictícios.

A interface `SyntheticValidationReadinessPreview.tsx`, dentro do laboratório do Histórico, mostra os doze itens não avaliados, suas provas exigidas e o motivo por trás de cada requisito (expandível por teclado). Não possui botões ou checkboxes para aprovar ações. As outras oito telas, atividades reais vazias e operações bloqueadas permanecem inalteradas.

Testes adicionados: `tests/synthetic-validation-readiness.spec.ts` (14) e `tests/synthetic-validation-readiness-ui.spec.ts` (8), totalizando **22 cenários** para estado sempre fechado, navegação por teclado, privacidade, filtros e responsividade em 390/850/1440 pixels.

A prévia continua isolada de arquivos de usuários, mods, jogos, instaladores e backups; sem parse real, IO de pacotes, atualização, edição, remoção ou instalação. PR draft, sem merge, e homologação manual física pendente.


## Contrato de admissão do futuro leitor de arquivos (24/10/2026)

Implementado **somente como simulação em memória**, não como permissão real:

- `src/synthetic-read-admission.ts` estabelece um contrato declarativo estrito: revisão atual, alegação de consentimento por arquivo, escopo de entrada única, intenção de leitura sem escrita/execução, confinamento declarado e recusa de symlinks/junctions, orçamento de bytes e expansão, quantidade de entradas, profundidade, tempo e cancelamento.
- Todos os pedidos terminam com `status:'blocked'`, `permittedReadBytes:0`, `realConsentVerified:false`, `realPathVerified:false`, `nativeHandleIssued:false` e `operationsEnabled:false`. **Nenhum valor declarado por um fixture pode simular consentimento nativo e liberar leitura real.**
- Mesmo com alegações adequadas, há três bloqueios permanentes: consentimento real não adquirido pelo sistema operacional, ausência de confinamento canônico verificado na origem e ausência de backend de leitura real.
- `createSyntheticReadAdmissionSession()` exige um plano `createSyntheticValidationReadiness()` emitido na memória; os vínculos são privados num `WeakMap`. Sessões copiadas, forjadas, com revisão incorreta e contratos malformados falham fechado. Não há ID de arquivo, caminho, token, digest, handle nativo ou acesso ao disco.
- A validação de entrada rejeita campos desconhecidos/ausentes, protótipos não padrão, propriedades getter, enums inventados, números negativos/decimais, limites de recursos excessivos, escape de caminhos, links não rejeitados e pedido cancelado. O limite é uma simulação de orçamento, não uma garantia efetiva de processamento de arquivos hostis.
- `SyntheticReadAdmissionPreview.tsx`, embutido na lista de 12 pré-requisitos, mostra sete cenários exclusivamente fictícios e os motivos do bloqueio; nenhuma seleção de arquivo, botão de acesso ou caixa de aprovação. Filtros/etapas não podem mudar uma decisão de acesso.
- Testes `tests/synthetic-read-admission.spec.ts` (21) e `tests/synthetic-read-admission-ui.spec.ts` (10) verificam contrato, rejeição por padrão, intenção única, limites, revogação, replay por revisão, cópias forjadas, isolamento de apresentação, teclado, tamanhos móveis e ações destrutivas bloqueadas.

**O que continua faltando para um leitor real:** confirmação genuína de um arquivo escolhido por interação do usuário; handles do sistema operacional com permissões mínimas e escopo restrito, checagem real de caminhos canônicos, symlinks/junctions e arquivos alterados entre abertura/uso; parser robusto sem extração; limites de leitura efetivamente aplicados em I/O real; vinculação de hash a bytes e revisão; cancelamento efetivo; revisões de segurança e homologação no computador Windows físico. Nenhuma dessas capacidades foi habilitada aqui.

O código não deve ser usado como um controle de acesso de produção: o verificador confiável precisa ser implementado separadamente, na camada nativa, com auditoria. Instalação, remoção, edição e atualização continuam desativadas. O PR permanece DRAFT, sem merge.


## Triagem incremental de catálogos ZIP/SCS fictícios (24/10/2026)

Nesta etapa foi implementado o contrato `src/synthetic-container-screen.ts`. Ele simula uma **máquina de estados**, não um descompactador ZIP/SCS e tampouco um leitor de arquivos de usuário.

**Fluxo arquitetural pretendido:** consentimento nativo por arquivo escolhido explicitamente → handle de leitura restrito ao arquivo com identidade revalidada → verificação canônica da origem e links → reconhecimento real, versionado, de contêiner ZIP/SCS → enumeração limitada de entradas e bytes sob orçamento efetivamente aplicado → inspeção individual de caminhos e estruturas → relatórios especializados independentes vinculados ao mesmo conteúdo verificado → diagnóstico sem operação implícita. Este fluxo **não existe no programa hoje**: falta a implementação/auditoria do lado nativo, inclusive proteção contra substituição de arquivo (TOCTOU), parser robusto, hash real, aplicação de quotas de memória/CPU/tempo, cancelamento de I/O e testes de formatos SCS específicos.

**Simulação atual:**
- `createSyntheticContainerReview()` só aceita sessões de admissão sintéticas emitidas no mesmo processo; seu catálogo é uma coleção inteiramente **inventada**, exclusivamente de metadados. O fluxo de entrada é rigidamente definido e não recebe caminho ou token real do sistema.
- `advanceSyntheticContainerReview()` avalia exatamente uma entrada declarada por chamada, permitindo cancelamento **entre checkpoints** via `cancelSyntheticContainerReview()`. Isso demonstra o estado de cancelamento; não interrompe descompressão ou I/O reais, pois nenhum ocorre.
- As validações declarativas rejeitam caminho absoluto, segmentos `.`/`..`, separador Windows, componentes vazios, dispositivos especiais do Windows, nomes repetidos independentemente de caixa, symlinks/hardlinks, colisão entre arquivo e diretório, compressão desconhecida, excesso de entradas e tamanhos/razão de expansão. A versão de SCS proprietário *não reconhecido* é **bloqueada**, sem tentar fingir que ZIP e todos os SCS são equivalentes.
- Mesmo com o estado `declarations-reviewed`, todos os resultados continuam `archiveParsed:false`, `bytesRead:0`, `realConfinementVerified:false`, `realConsentVerified:false`, `operationsEnabled:false` e `pathsExposed:false`. “Declarações percorridas” não significa pacote íntegro, jogo compatível nem leitura segura em produção.
- Caminhos de catálogo ficam em estado privado `WeakMap` e não aparecem no handle ou checkpoint público. Catálogos hostis não geram handles nativos nem operação. A sessão emitida é apenas identidade local de fixture, **não credencial de acesso**.
- `SyntheticContainerScreenPreview.tsx` fica dentro do contrato de admissão já bloqueado, na tela Histórico. Exibe cenários ZIP fictício, SCS declarado como ZIP, travessia, links, explosão declarada de tamanho, duplicação por caixa, SCS proprietário não suportado e cancelamento. O usuário pode avançar uma declaração, cancelar e reiniciar; nunca selecionar arquivo real ou habilitar instalação.
- Testes `tests/synthetic-container-screen.spec.ts` (24) e `tests/synthetic-container-screen-ui.spec.ts` (11) verificam limites, checkpoints, revogação da simulação, proteção contra caminhos, aliases, formas erradas, privacidade, teclado, interface móvel e operações bloqueadas.

**Atenção:** não há leitura ZIP/SCS real, decompression bomb testada com bytes, controle real de recursos, defesa comprovada contra ataques de sistema de arquivos ou ativação de verificador nativo. Os checks de strings sobre nomes declarados são um protótipo pedagógico e **não substituem validação por handles nativos e parser de produção**. A PR segue DRAFT, sem merge, com homologação no Windows pessoal pendente.


## Checkpoints de blocos sintéticos, quotas acumuladas e descarte de resultados incompletos (24/10/2026)

A arquitetura fictícia ZIP/SCS agora tem uma etapa adicional de **fluxo de blocos de metadados**, não um descompressor, leitor de arquivo ou medição de desempenho real.

- Uma origem de blocos é emitida por `issueSyntheticStreamDeclarationSource()` **somente depois da triagem integral, não bloqueada e não cancelada** de um catálogo já emitido. A origem é uma projeção imutável de ordinais e contagens declaradas de arquivos. O vínculo de procedência local usa `WeakSet`, sem caminhos, nomes, handles de OS, payloads ou conteúdo.
- `src/synthetic-stream-checkpoints.ts` valida **um registro numérico por chamada**: ordinal da entrada, quantidade declarada de bytes comprimidos e expandidos, duração declarada da etapa e sinal de final de entrada. Bloqueia sequência inválida, entrada fora de ordem, duplicação implícita, divergência dos tamanhos da triagem, terminador incorreto, dados malformados e fluxo truncado.
- Quotas declarativas incluem até 512 blocos, 64 KiB comprimidos e expandidos por bloco, razão de expansão de no máximo 100:1, orçamento acumulado do catálogo (2 MB comprimidos/4 MB expandidos) e até 250 ms declarados por bloco e 5.000 ms declarados no total. **Nenhuma dessas cotas controla CPU, memória, descompressão ou disco real**, que ainda não estão conectados.
- Não há publicação gradual de resultados. Um relatório de blocos só informa um número de *declarações completas* quando **todas** as entradas esperadas terminam corretamente. Ao cancelar, bloquear, detectar truncamento, mismatch, expiração declarada ou excesso de tamanho, qualquer contagem de resultado intermediário é descartada e acumuladores são zerados. Campos `realBytesRead:0`, `dataRetainedBytes:0`, `archiveParsed:false`, `decompressionPerformed:false`, `realIntegrityVerified:false` e `operationsEnabled:false` nunca mudam.
- `SyntheticStreamCheckpointPreview.tsx` só aparece após conclusão da triagem fictícia anterior, com cenários de contagens consistentes, expansão declarada, truncamento, ordem errada, tempo declarado excessivo e cancelamento durante uma entrada. O usuário pode avançar, interromper ou reiniciar checkpoints; isso não habilita arquivos, pasta, escrita nem operações. O contador de conclusões refere-se exclusivamente a *declarações*, jamais arquivos reais.
- 22 testes de contrato em `tests/synthetic-stream-checkpoints.spec.ts` e 11 testes UI em `tests/synthetic-stream-checkpoints-ui.spec.ts` avaliam rejeição por identidade, fonte ainda pendente/bloqueada, cancelamento e descarte, quotas individuais/acumuladas, divergência, truncamento, malformação, limites, imutabilidade, privacidade, teclado, responsividade e ações de instalação ainda bloqueadas.

Para uma implementação real faltam consentimento nativo verificável por arquivo, isolamento efetivo de handles/paths, parser seguro para variantes ZIP/SCS, leitura incremental real com backpressure, aplicação de limites de CPU/memória/tempo, interrupção de I/O e limpeza de recursos, autenticação criptográfica de bytes e robustez contra troca de arquivos durante a análise. Nada disso foi habilitado nesta prévia. PR continua DRAFT e sem merge.


## Ciclo de vida do leitor futuro: abrir, avançar, fechar e limpar (24/10/2026)

Foi implementado `src/synthetic-reader-lifecycle.ts`, um contrato de transições **estritamente em memória**. Trata apenas de checkpoints numéricos fictícios, não de recursos nativos.

- A criação exige um fluxo de blocos genuinamente emitido, ainda intocado e pendente. O módulo associa a instância a um único ciclo por `WeakSet`, e seus dados privados ficam em `WeakMap`. Clones, fluxos falsos e a reutilização de um mesmo fluxo não podem criar outra sessão.
- Estados explícitos: `created` → `simulated-open` → `ready-to-close` → `closed`. A abertura simulada **não** produz arquivo aberto, handle de sistema, permissão ou consentimento nativo.
- Apenas o ciclo aberto pode avançar um bloco fictício por chamada. O relatório conclusivo só é exposto **depois de TODOS os blocos e do fechamento explícito**. Antes disso, `completedDeclarations: 0`; mesmo no fim, a contagem significa apenas declarações imaginárias coerentes.
- Fechar antes de abrir ou durante o fluxo, cancelar em qualquer etapa ou encontrar erro chama uma limpeza **simulada** que apaga contadores e descarta conclusões parciais. O encerramento é terminal e idempotente, com `completedCleanupCount: 1` no máximo. Uma mutação do fluxo por fora do ciclo também força fechamento e descarte (`external-mutation`).
- Todos os checkpoints mantêm `nativeHandlesOpen: 0`, `realBytesRead: 0`, `realResourcesAllocated: false`, `realCleanupVerified: false`, `realFileAccessGranted: false` e `operationsEnabled: false`. O número de leases em memória NÃO equivale a um descritor de arquivo do Windows.
- `SyntheticReaderLifecyclePreview.tsx` integra a demonstração ao laboratório de blocos fictícios na tela Histórico. O usuário pode simular abertura, avanço, cancelamento, fechamento e reinício, com quatro cenários (completo, interrupção, fechamento precoce e erro). Nenhum seletor de arquivos ou comando nativo é chamado.
- `tests/synthetic-reader-lifecycle.spec.ts` adiciona 20 testes de contrato e `tests/synthetic-reader-lifecycle-ui.spec.ts` adiciona 9 testes de interface, cobrindo reentrada, fechamento obrigatório, exceções lógicas, vazamento de recursos simulados, mutação externa, privacidade, responsividade e operações reais desabilitadas.

**Fronteira real ainda não implementada:** para usar arquivos do sistema operacional, será necessária arquitetura própria de handles nativos com consentimento por arquivo, abertura atômica de identidade verificada, direitos mínimos, realpath/symlinks e isolamento, workers e leitura incremental limitada, cancelamento de I/O real, gestão RAII/`finally` em falha ou desligamento do processo, descarte seguro de buffers, hash dos bytes lidos, teste de falhas injetadas e auditoria. Este código não executa nem demonstra nenhum desses comportamentos reais. PR continua em rascunho, sem merge, e homologação manual em Windows físico pendente.


## Falha de processo, interrupção durante o fechamento e replay (24/10/2026)

O contrato de ciclo de vida fictício (`synthetic-reader-lifecycle.ts`) passou a modelar duas janelas adicionais de falha, sem acessar processos, recursos ou arquivos reais:

- **Fechamento em duas etapas**: `beginSyntheticReaderLifecycleClose` move `ready-to-close` para `closing`, SEM publicar contagens. Apenas `finishSyntheticReaderLifecycleClose` chega a `closed` com `completed`, uma limpeza fictícia registrada e as contagens de declarações entregues. A função anterior de fechamento direto continua disponível para cenários simples.
- **Perda inesperada simulada**: `simulateSyntheticReaderLifecycleProcessLoss` pode interromper uma sessão antes, durante ou depois da conferência, inclusive entre as duas etapas do fechamento. Torna o estado `interrupted`, zera contagens parciais, impede qualquer publicação, exige reconhecimento explícito e atribui o motivo `process-lost` ou `close-interrupted`. Isso **não mata processo verdadeiro** nem fornece evidência de como o Windows trataria descritores.
- **Reconhecimento sem falsa limpeza**: `acknowledgeSyntheticReaderLifecycleLoss` apenas declara o abandono da instância do **modelo**. Transita `interrupted` → `closed` mantendo `cleanupPerformed:false`, `completedCleanupCount:0`, `realCleanupVerified:false` e `abandonedWithoutConfirmedClose:true`. O sistema não afirma ter executado `finally`, RAII, flush de disco ou liberação real de memória após um crash.
- **Reutilização impedida**: uma sessão interrompida ou encerrada não volta para `created`. Comandos de abrir/avançar/fechar não retomam uma sessão abandonada, e o `WeakSet` da origem impede que o mesmo fluxo de blocos seja revendicado. Clones de handles fictícios são recusados pela identidade privada.
- A interface `SyntheticReaderLifecyclePreview.tsx` recebeu três cenários (perda de processo, interrupção durante o fechamento e tentativa de reabrir). Apresenta avisos específicos de limpeza NÃO comprovada. Botões apenas simulam transições numéricas e não oferecem acesso a mods nem instalação.
- Testes adicionados: `tests/synthetic-reader-process-loss.spec.ts` (19 casos) e `tests/synthetic-reader-process-loss-ui.spec.ts` (9), incluindo falhas no meio da conferência e fechamento, abandono, idempotência, clonagem, responsividade e operações desativadas.

**Limitação deliberada:** não existe watchdog nativo, persistência de journal, recuperação após desligamento efetivo, injeção de falha no Windows nem gerenciamento de handles reais. Uma aplicação futura exigirá auditoria desses componentes separadamente. A simulação de processo perdido não prova segurança ou recuperação de dados após crash físico. PR continua DRAFT sem merge.
