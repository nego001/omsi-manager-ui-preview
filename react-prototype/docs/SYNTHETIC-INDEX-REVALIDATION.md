# OMSI Manager | Revalidação incremental sintética

**Etapa implementada:** comparação em memória de índices fictícios e um plano fechado de rechecagem. Nenhum arquivo real é lido e nenhum snapshot antigo é reutilizado.

## Problema evitado

IDs como `synthetic-entry-0001` dependem da ordenação. Uma inclusão pode deslocar todos os IDs sem alterar um digest fornecido pelo teste. Também é possível renomear um arquivo mantendo seu tamanho, extensão e posição. Comparar apenas IDs, hashes **declarados** ou campos visíveis do índice criaria falsos negativos.

## Contrato

`compareSyntheticIndexDeclarations()` mantém apenas dentro de `src/synthetic-package-index.ts`, em `WeakMap`, nomes **canônicos de fixtures** associados aos índices emitidos pelo gate. Não retorna nomes: entrega contagens e categorias de entradas adicionadas, removidas ou alteradas. Objetos falsificados são recusados.

`planSyntheticRevalidation()` em `src/synthetic-index-revalidation.ts` usa o delta privado e publica:
- pistas de módulos afetados (por exemplo textura → Recursos, Mídia, Definições e Estrutura; som → Áudio, Definições e Estrutura);
- alteração de contêiner SCS/ZIP, arquivo desconhecido, diretório ou digest fornecido diferente → todos os módulos;
- `requiredBeforeNewClaims`: **todos os módulos**, sempre, até que haja procedência real para reuso confiável;
- `previousSnapshotInvalidated: true`, `previousEvidenceReusable: false`, `handlesReusableAcrossIndexes: false`;
- `operationsEnabled: false` e `actualContentVerified: false`, independentemente do resultado.

`projectPendingSyntheticRevalidation()` representa o estado pendente para Biblioteca, Oficina e Instalador sem declarar jogo candidato, instalação ou compatibilidade. A projeção não é integrada ainda à interface do aplicativo.

## Limites

Comparações dizem apenas o que mudou nas **declarações sintéticas**. O mesmo índice, caminho, tamanho e digest de fixture não demonstram que bytes reais sejam iguais. Os módulos afetados são somente dicas de planejamento, sem autorização para pular validação de outros setores. Nenhum editor de skin/som, instalador, desinstalador, atualizador, verificador de hash real ou executor paralelo foi habilitado.

**Segurança:** somente branch de prévia, PR rascunho, sem merge, sem alterar mods, Steam, jogos, backups ou executáveis do usuário.
