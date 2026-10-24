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
