# OMSI Manager | Vinculação de evidências sintéticas à revisão exata do índice

**Situação:** implementação em memória, sem leitura real de mods, hashes calculados, permissões de sistema, execução paralela ou operações de instalação.

## Problema e solução

O identificador `synthetic-entry-0001` é ordinal. Duas versões diferentes do índice, mesmo com o mesmo digest **declarado**, podem ter o mesmo identificador apontando para arquivos diferentes. Também podem coincidir exatamente em todos os campos públicos e diferir nos nomes privados.

A função `issueSyntheticRevisionTicket(index, moduleId, handle?)` cria um ticket opaco e imutável, guardado em uma `WeakMap` **privada e em memória**, associando:
- **objeto de índice exato**, criado pelo gate;
- **ID do especialista exato**;
- **handle de uma entrada de arquivo permitida**, ou `null` para o relatório completo do especialista.

O ticket de relatório é obrigatório em `SyntheticWorkerDeclaration.revisionTicket`. Cada `observations[]` também exige um ticket próprio ligado ao mesmo índice, módulo e handle. Em `runSyntheticIndexedWorkers()`, o lote inteiro é validado antes da emissão de qualquer relatório; falha retorna `stale-revision` (ou `invalid-fixture` para contratos malformados), sem sinais aceitos e com ações bloqueadas.

### Casos protegidos

- Reuso de relatório inteiro de índice anterior, mesmo com digest e contagem idênticos;
- Reuso do relatório antigo após inclusão que desloca IDs posicionais;
- Renomeação de arquivo sem mudar o tipo, tamanho ou handle visível;
- Troca isolada do carimbo do relatório com observações velhas (e vice-versa);
- Ticket do especialista errado, do handle errado, de um arquivo não autorizado ou de um diretório;
- Ticket fabricado por JSON e cópia superficial de índice;
- Ausência de tickets e tentativa de classificar o jogo com módulos sem atribuição.

**Não há vazamento dos tickets** nas saídas do coordenador: somente o identificador opaco do sinal, o jogo fictício e os módulos contribuintes são publicados, e Oficina/Instalador continuam desativados. O contrato central de fusão `coordinateSyntheticEvidence()` é uma função pura para testes, não uma barreira de segurança independente.

## Limitação obrigatória

**Ticket não é assinatura digital, hash, prova de leitura, identidade de usuário ou autorização de arquivos.** Por ser um programa de testes em memória, quem pode solicitar tickets para um índice sintético também pode criar novas declarações falsas. O objetivo nesta fase é impedir **replays acidentais entre revisões**, não autenticar conteúdo de mods nem proteger contra um processo hostil. Uma implementação com arquivos reais precisará de leitura isolada, proveniência assinada ou verificada, hash calculado de bytes, escopos reais de acesso, revogação, cancelamento, defesa TOCTOU e revisão de confiança entre processos.

### Validação automatizada

`tests/synthetic-revision-tickets.spec.ts` exercita replays de relatórios, observações e tickets; mismatches por revisão, módulo e handle; índices falsificados; ausência de credenciais; imutabilidade; ausência de vazamentos; e novos resultados ainda ambíguos quando as declarações contradizem entre si.

PR da prévia permanece **draft e sem merge**; mod, jogo, biblioteca real, backups e projeto principal não foram tocados.
