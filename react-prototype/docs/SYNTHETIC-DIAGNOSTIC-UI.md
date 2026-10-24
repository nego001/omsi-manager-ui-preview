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
