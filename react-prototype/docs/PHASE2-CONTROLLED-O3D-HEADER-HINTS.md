# Fase 2 / M9 | Indícios limitados de cabeçalho O3D

**Branch:** `feat/controlled-zip-o3d-header-hints-v1`, empilhada na PR #12/M8. Draft; sem merge ou release.

## Objetivo

Separar a **existência estrutural** de uma entrada `.o3d` (M8) de um indício binário mínimo.
O leitor consome **somente os primeiros 8 bytes**, já disponibilizados durante a leitura
integral CRC do ZIP fictício em memória. O verificador reconhece a assinatura
`84 19` e versões observadas 1, 3, 4, 5 e 7, com comprimentos de cabeçalho
compatíveis (3, 4 ou 8 bytes, respectivamente). Todos os resultados são categorias
fechadas, sem nomes, caminhos, bytes ou exemplos privados.

Referências documentais independentes:
- https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md
- https://www.sweetscape.com/010editor/repository/templates/file_info.php?file=O3D.bt

## Saída e limites

- `o3dHeaderHintCounts`: `plausiblePrefix`, `truncatedPrefix`,
  `unknownVersion`, `magicMismatch`.
- `omsiPlausibleO3dHeaderLinkedVehicleFolderCount`: número de variantes
  com um BUS vinculado exatamente a CFG, que referencia um O3D de **prefixo plausível**.
- `omsiMeshLinkedWithoutPlausibleHeaderFolderCount`: variantes vinculadas
  estruturalmente, mas sem cabeçalho plausível na malha referenciada.

Importante: versões desconhecidas **não** invalidam automaticamente o ZIP;
são `unknownVersion`, sem promoção. O M8 ainda pode devolver
`omsi-fixture-candidate` por estrutura, mesmo se o prefixo for inválido.
Essa palavra não significa que a malha esteja correta. A nova informação é
separada: `meshFormatVerified: false`, `gameRecognized: false`,
`compatibilityVerified: false`, `installationEnabled: false`.
Não há parsing de vértices/triângulos, arquivos reais, extração,
consulta à instalação do jogo, IPC ou escrita.

Os casos de teste verificam versões observadas, arquivo curto, versão
desconhecida, magic incorreto, mistura de malhas na mesma variante,
isolamento entre variantes e privacidade de nomes.

**Bloqueio de homologação inalterado:** issue #4, Ubuntu 24.04, sandbox estrito.
