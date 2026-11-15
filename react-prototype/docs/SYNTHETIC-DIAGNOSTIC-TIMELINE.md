# OMSI Manager | Linha do tempo fictícia de diagnóstico

Implementação em src/synthetic-diagnostic-timeline.ts; testes em tests/synthetic-diagnostic-timeline.spec.ts.

A estrutura de histórico agora guarda, para cada revisão, o estado dos sete especialistas, em ordem fixa: ok, pendente, ausente, incompleto ou bloqueado. Inclui contagem de observações declaradas e marcador de que a revisão de um módulo pode ser afetada por alterações no pacote fictício.

A função projectSyntheticDiagnosticTimeline() cria eventos imutáveis, com mensagens explicativas em português: primeira análise, abertura de revisão, alteração do digest declarado, reanálise concluída ou incompleta, pendência, ausência de relatório e bloqueio de módulo. Resultados anteriores são marcados como históricos, sem virarem candidatos atuais.

Os módulos afetados são dicas de prioridade, não autorização para ignorar os outros. Cada revisão contém um evento geral e sete eventos especializados, até 192 eventos para 24 revisões. O resultado não publica caminhos, nomes, handles, tickets ou digest do fixture.

ATENÇÃO: OK significa somente que o fixture produziu relatório com estado OK. Não há leitura ou validação real de arquivos, hashes calculados, verificação de compatibilidade, instalação, edição, atualização ou desinstalação. A timeline não foi conectada às nove telas do protótipo, e não opera sobre jogos, mods ou backups privados.

Continua em PR draft isolado, sem merge. Homologação no PC Windows físico do usuário segue pendente.
