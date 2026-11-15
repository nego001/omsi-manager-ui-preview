# Fase 2 / M4 | Hash real de bytes em memória fictícia, sem acesso a mods

**Escopo:** experimento de limite criptográfico, **somente sobre um `Uint8Array` de teste já fornecido em memória**. O módulo não abre arquivos, não lê ZIP/SCS, não acessa Steam, não solicita permissões nem interpreta conteúdo de mod.

## O que realmente é verificado

`checkSyntheticFixtureBytes(index, handle, bytes, expectedSha256)` recebe um índice sintético emitido pelo gate, um handle dentro da visão `definitions`, um pequeno bloco de bytes de fixture e um SHA-256 esperado **também fornecido pelo cenário de teste**.

O código usa `crypto.subtle.digest('SHA-256', ...)` para calcular o SHA-256 dos bytes copiados em memória e exige igualdade exata com o valor esperado. Rejeita digest malformado, handle inválido, bytes vazios, incompatibilidade com o tamanho *declarado* no índice e mais de **65.536 bytes**. O buffer de trabalho é zerado após o cálculo. Nenhum digest parcial é retornado quando ocorre falha.

Uma confirmação `matched` prova somente que **aqueles bytes de memória**, escolhidos pelo teste, coincidem com **aquele SHA esperado**, também escolhido pelo teste. Isso **não prova** a autenticidade do pacote, seu hash real, a origem ou a compatibilidade de um mod.

## Não reutilizar recibos como poderes de leitura

Um resultado válido é associado internamente por `WeakMap` à instância exata do índice sintético e ao seu handle. `matchesSyntheticFixtureByteReceipt(...)` rejeita cópias JSON, índices reconstituídos e revisões diferentes, ainda que seu texto de digest e seus handles pareçam idênticos.

O recibo tem sempre `realPackageDigestVerified:false`, `realPackageRead:false`, `gameVerified:false`, `compatibilityVerified:false`, `installationVerified:false` e `operationsEnabled:false`. Ele **não está conectado** ao coordenador como prova de jogo, nem ao instalador ou à Oficina.

## Testes

Vetor SHA-256 conhecido dos bytes `abc`, alteração de conteúdo do mesmo tamanho, cópia defensiva antes do await, limite de tamanho, divergência de bytes declarados, índices/handles forjados, formato de digest inválido, anti-replay por identidade e não exposição de dados.

## O que falta para bytes de mods reais

Um backend nativo isolado, seleção e consentimento limitados a um arquivo, caminho canônico e vínculos protegidos, verificação de identidade do handle, cálculo de hash em **fluxo limitado** com cancelamento e prazo, segurança do contêiner, indexação imutável, vinculação de evidências às revisões e rechecagem antes de qualquer operação. Ainda é necessário homologar Ubuntu 24.04 sob sandbox estrito (issue #4). Nenhum módulo desta PR autoriza abrir arquivos reais ou liberar merge/release.
