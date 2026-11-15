# Fase 2 / M5 | Duas passagens de SHA-256 sobre buffers sintéticos

**Ramo:** `feat/synthetic-two-pass-recheck-v1`, empilhado sobre M4 e totalmente separado da Biblioteca/Detalhes v1. Nenhuma leitura de disco, mod, ZIP/SCS, Steam ou arquivo pessoal. Nenhum IPC ou instalador.

## Problema

M4 verifica SHA-256 de um pequeno `Uint8Array` fornecido pelo teste. Um recibo único não deve servir como duas verificações. Também precisamos distinguir `hash igual` e `hash diferente` quando dois testes fornecem conteúdos fictícios distintos com o mesmo comprimento.

## Implementação

- `recheckSyntheticFixtureBytes()` recebe dois buffers distintos e seus **dois hashes esperados declarados pelo fixture**. Reutiliza `checkSyntheticFixtureBytes()` de M4 sequencialmente para calcular SHA-256 duas vezes. Rejeita o mesmo `Uint8Array` ou views com o mesmo `ArrayBuffer`; falhas de qualquer passagem impedem resultado parcial.
- `compareSyntheticFixtureReceipts()` exige um índice efetivamente emitido pelo gate, handle na visão de `definitions` e **dois recibos M4 distintos, emitidos para a mesma instância de índice e handle**. Clones JSON, recibos de outra revisão e o mesmo recibo repetido são rejeitados.
- Resultado `unchanged-fixture` indica que os dois pares de buffers fornecidos pelo teste produziram o mesmo SHA-256 e tamanho. `changed-fixture` indica comparação diferente; ambos são apenas **estados fictícios em memória**. A saída não contém bytes, caminhos, SHA-256, nome privado, permissões ou controle do disco.
- Todo resultado mantém `previousEvidenceReusable:false`, `realPackageDigestVerified:false`, `realPackageRead:false`, `gameVerified:false`, `compatibilityVerified:false`, `installationVerified:false` e `operationsEnabled:false`.

## Importante: NÃO é proteção TOCTOU real

O usuário do laboratório escolhe ambos os buffers e ambos os hashes esperados. Não existe segunda leitura independente de um mesmo arquivo de jogo, handle nativo revalidado, identidade do processo, garantia de origem, instante de leitura autenticado ou prova de que o pacote do disco não mudou. Mesmo dois hashes iguais **não autorizam reutilizar evidências nem instalar**.

Uma revalidação real exigirá autorização explícita, backend isolado, identidade estável do handle, hash de fluxo calculado sobre bytes reais, índice com proveniência autenticada e rechecagem atômica antes de operações autorizadas. Ubuntu 24.04 estrito segue bloqueado pela issue #4.

## Testes

Onze testes: vetor estável conhecido, conteúdo alterado com mesmo tamanho, hashes esperados errados, fonte de buffer repetida/alias, recibo repetido, recibos de outra revisão/handle/clonados, índice falsificado, escopo de módulo, entrada inválida/sobrelimite e sanitização de saída. Todos os testes são apenas dados em memória, sem leitura de mods.
