# Fase 2 / M11 | Índices da primeira seção de triângulos O3D

**Branch:** feat/controlled-zip-o3d-triangle-index-v1
**Base:** PR #14 (M10), sem alterações na Biblioteca. **Draft e sem merge.**

## Escopo da mudança

Depois de M8 (BUS→CFG→O3D no mesmo ZIP/variante), M9 (cabeçalho O3D) e M10
(primeira seção de vértices), o M11 examina um **subconjunto sintético** do
bloco seguinte, tag 0x49, **somente em bytes de ZIPs fictícios construídos
pela CI em memória**. O classificador lê no máximo **4.096 bytes por O3D**
e exige previamente a pista M10 de bloco de vértices plausível.

A interpretação deliberadamente limitada e conservadora:
- Exige 0x49 imediatamente após a tabela de 1 a 32 vértices fictícios.
- Conta até 64 triângulos fictícios (u16 na v1, u32 nas versões observadas ≥3
  deste laboratório).
- Cada triângulo possui três índices u16, ou u32 quando bit 0 das flags é
  indicado nas versões observadas ≥3; ignora a semântica do campo u16 de material.
- Verifica se cada índice aponta para um vértice da própria tabela
  (0 ≤ índice < quantidade de vértices), não se há triângulos geometricamente válidos.
- Não inspeciona floats, posições, normais, UVs, material, matriz, ossos,
  animações, topologia física, triângulos degenerados ou qualquer seção posterior.

Acima de 32 vértices ou 64 triângulos a pista fica **fora do orçamento da
fixture**, o que **não significa** que um modelo OMSI real seja inválido.
Tags desconhecidas e variantes de codificação válidas em OMSI podem ser
marcadas como não suportadas por **este laboratório**, sem rejeição geral do
arquivo ou alegação de incompatibilidade.

## Novo relatório sanitizado

- o3dTriangleIndexHintCounts: contagens das categorias fechadas:
  plausibleBoundedTriangleIndices, vertexSectionUnconfirmed,
  missingTriangleSection, unsupportedTriangleSection,
  truncatedTriangleCount, zeroTriangleCount, countOverBudget,
  truncatedTrianglePayload, outOfRangeVertexIndex.
- omsiBoundedTriangleHintLinkedVehicleFolderCount: variantes fictícias
  com BUS→CFG→O3D exato cujo bloco de índices está dentro dos limites.
- omsiMeshLinkedWithoutBoundedTriangleHintFolderCount: variantes com
  vínculo estrutural M8, mas sem essa pista adicional do M11.

Nomes/bytes/índices/caminhos reais não são retornados ou registrados.
**A classificação M8 continua inalterada**: mesmo um ZIP com referências
e triângulos sintéticos pode ser um pacote falso. Sempre retornar:
meshFormatVerified:false, evidenceAuthenticated:false,
gameRecognized:false, realModInspected:false,
compatibilityVerified:false, installationEnabled:false,
realGameFilesTouched:false.

## Testes e proteções

Os testes abrangem revisões fictícias v1, v3, v4, v5, v7, flags de índice
16/32 bits, referências válidas e fora da faixa, seção/tabela ausente,
truncamento, zero e excesso de triângulos, outras variantes e CFGs,
ambiguidade OMSI/SII, privacidade e entrada inválida.

Preserva os limites ZIP legados, verificação CRC, política de paths e a
restrição absoluta a arquivos de teste em memória. **Nenhum arquivo de mod
real, instalação do jogo, filesystem, extração, rede ou IPC**. Não altera
o sandbox. Não autoriza instalação, merge ou release. Bloqueio de
homologação em Ubuntu 24.04 X11 com sandbox estrito permanece na issue #4.

Referência técnica para tags O3D e flags (não prova de implementação integral):
https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md
