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
