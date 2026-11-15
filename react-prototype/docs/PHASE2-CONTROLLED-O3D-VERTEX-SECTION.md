# Fase 2 / M10 | Primeiro bloco de vértices O3D em ZIPs sintéticos

**Ramo:** `feat/controlled-zip-o3d-vertex-section-v1`, empilhado na PR #13/M9. **Draft, sem merge.**

## Escopo estritamente limitado

O M9 inspecionava apenas os oito primeiros bytes para encontrar uma assinatura/versão O3D plausível. O M10 acrescenta, **somente nos arquivos O3D fictícios gerados pela CI e já aprovados no índice ZIP e no CRC**, uma janela de no máximo **1.100 bytes**. Nessa janela, a verificação conservadora exige:

1. Cabeçalho compatível com a evidência parcial do M9 (versões observadas 1, 3, 4, 5 ou 7).
2. Que o primeiro identificador de seção após o cabeçalho seja `0x17`.
3. Que exista a contagem de vértices do tamanho esperado (uint16 LE na v1; uint32 LE nas demais versões observadas).
4. Contagem no intervalo fictício de **1 a 32 vértices**. Acima disso retorna `countOverBudget`, **não** significa que o modelo do OMSI seja inválido.
5. Pelo menos `count × 32` bytes para a tabela de oito valores float32 por vértice. Os floats **não são interpretados, autenticados nem verificados**.

A primeira seção não é analisada além de sua fronteira e **nada** é inferido sobre triângulos, materiais, textura, animação, normais, índices ou seções posteriores. Um segmento aparentemente correto pode ser totalmente falso ou ter valores semanticamente absurdos.

Limites M8/M9 preservados: payload ZIP ≤ 2 MB, descompactação acumulada ≤ 4 MB, ≤ 128 entradas, CRC, razão de compressão e caminhos previamente validados, arquivos somente na memória. Esta mudança não acessa o sistema de arquivos, pasta de jogo, executável do simulador, arquivos reais de mods, rede ou IPC.

## Saídas sanitizadas

- `o3dVertexSectionHintCounts`: somente uma contagem de categorias fixas:
  `plausibleBoundedVertexPayload`, `headerUnconfirmed`,
  `missingFirstSection`, `unsupportedFirstSection`,
  `truncatedVertexCount`, `zeroVertexCount`,
  `countOverBudget`, `truncatedVertexPayload`.
- `omsiBoundedVertexHintLinkedVehicleFolderCount`: número de variantes fictícias nas quais **BUS → CFG → O3D específico** possui o primeiro bloco dentro do orçamento.
- `omsiMeshLinkedWithoutBoundedVertexHintFolderCount`: quantas variantes possuem cadeia M8, mas **não** possuem essa nova pista.

Todas as identificações anteriores permanecem como estavam. Um O3D sem primeira seção suportada **não** desqualifica automaticamente o indício estrutural do M8 e **não** identifica um mod verdadeiro. Flags continuam `meshFormatVerified:false`, `gameRecognized:false`, `realModInspected:false`, `compatibilityVerified:false`, `installationEnabled:false` e `realGameFilesTouched:false`.

## Testes e bloqueio

Testes sintéticos incluem versões 1/3/4/5/7, truncamento de contagem ou tabela, zero e excesso de vértices, ausência de seção, marcador não suportado, magic inválida, variante diferente, O3D não referenciado, ambiguidade com SII, dados privados e entradas inválidas.

Sem validação de mods reais nem escrita de conteúdo. **Homologação permanece bloqueada** pela issue #4 Ubuntu 24.04, sandbox estrito. A PR continua Draft independentemente do resultado CI do M10.

Referência de formato usada como ponto de partida: [openOMSI / FORMATS.md](https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md), especialmente a seção `o3d (binary mesh)`; o M10 não pretende implementar seu parser integral.
