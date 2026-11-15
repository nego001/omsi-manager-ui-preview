# OMSI Manager | Especialistas fictícios conectados ao índice

**Estado: contrato de teste 100% sintético, sem leitura de arquivos e sem execução paralela real.**

O arquivo `src/synthetic-index-workers.ts` conecta as **visões filtradas** de `src/synthetic-package-index.ts` ao coordenador de evidências `src/distributed-reader-contract.ts`. Os testes ficam em `tests/synthetic-index-workers.spec.ts`.

## Fluxo em memória

1. O gate sintético `buildSyntheticPackageIndex()` rejeita entradas perigosas, cria um índice imutável e fornece handles fictícios de registros, sem paths.
2. `runSyntheticIndexedWorkers(index, declarations)` confirma que o índice foi realmente emitido pelo gate. Objetos copiados ou inventados são rejeitados.
3. Cada especialista recebe `projectSyntheticIndex(index, moduleId)`, limitada por tipo de arquivo. Estrutura tem índice amplo; manifestos, definições, recursos, sons, mídias e relações têm apenas seus subconjuntos. Contêiner não é um especialista e nunca pode ser falsificado na entrada.
4. Somente estrutura, manifesto e definições podem publicar indícios de jogo; um indício sintético precisa referenciar um **handle existente, de arquivo, dentro da visão daquele próprio módulo**, além de declarar o mesmo digest do índice e um jogo permitido.
5. O coordenador recebe os relatórios normalizados em ordem canônica e publica um único snapshot. Ausência, falha ou incompletude dos especialistas preservam bloqueio ou incerteza. ETS2/ATS conflitantes produzem estado ambíguo.
6. A saída de cada especialista relata exclusivamente ID do módulo, quantidade de entradas visíveis, quantidade de observações e status. Não devolve nomes ou caminhos. A saída e os relatórios são imutáveis. Biblioteca, Oficina e Instalador consomem a mesma projeção consolidada, **sem liberar operações**.

## Limites cruciais

A declaração `observations: [{handle, game}]` é **fornecida pelo fixture de teste**, não descoberta lendo bytes, manifestos ou modelos. A vinculação a um handle demonstra escopo **lógico**, não procedência autenticada. Extensão `.scs`, `.bus`, `.sii` ou `.bank` por si só não prova jogo, integridade, compatibilidade, licença, possibilidade de edição ou instalação. O digest declarado não é hash de conteúdo verificado.

Não existe worker real, thread, script de mod, processo isolado, timeout de CPU, parser ZIP/SCS ou rede habilitada. Os testes provam apenas que o contrato de informação restringe as observações sintéticas e não permite a uma etapa usar o índice de outra. O guard de proveniência em memória não é um mecanismo de segurança para entrada externa real.

**Próximo degrau independente:** leitores reais apenas depois de sandbox, validadores de formatos e bytes, limites de recurso reais, hash verificado, autorização granular, proteção TOCTOU e homologação física. Instalação, remoção, atualização e Oficina continuam bloqueadas; PR permanece draft sem merge.
