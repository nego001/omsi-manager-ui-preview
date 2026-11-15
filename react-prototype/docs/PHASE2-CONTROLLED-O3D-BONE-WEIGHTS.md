# OMSI Manager | Fase 2 / M14: indícios opcionais de ossos O3D

**Branch:** feat/controlled-zip-o3d-bone-weight-hints-v1
**Base:** PR #17 / M13, sem merge nem release.
**Escopo:** somente ZIPs fictícios produzidos em memória na CI.

## Regra incremental

A pista sintética M8–M13 exige o vínculo BUS → CFG → O3D do mesmo ZIP/
variante e as seções simplificadas de vértices (0x17), triângulos (0x49),
materiais (0x26) e matriz (0x79). O M14 acrescenta uma análise **opcional**
de 0x54, após a matriz de 16 f32.

- O3D sem seção 0x54: optionalBoneSectionAbsent; NÃO é problema de formato,
  e NÃO remove a pista M8 anterior.
- Quando a seção existe neste pequeno dialeto de teste: contagem u16 de
  1 a 4 ossos, nome opaco de 1 a 48 bytes (precedido por tamanho u8),
  seguido de u16 de 1 a 8 pesos por osso.
- Cada peso sintético contém índice de vértice u16 ou u32 (de acordo com a
  versão/flags aceitas em M13) e um float32. O teste verifica apenas se
  o índice pertence à tabela de vértices e se o peso é finito.
- Nunca normaliza pesos, calcula animação, modifica malha, decodifica nomes,
  interpreta semântica dos ossos, verifica influências totais ou aplica matriz.
  Valores finitos até negativos **não** certificam física/animação válidas.
- v7/flags 3 e demais extensões desconhecidas ficam explicitamente como
  matrixSectionUnconfirmed, sem alegar que os arquivos reais sejam inválidos.
- Os limites **4 ossos/8 pesos** são exclusivamente de fixture, não
  limites do formato de modelos reais. Conteúdo de mod real não é suportado.

O classificador reutiliza o **mesmo buffer de até 8192 bytes por O3D**
já usado em M12/M13, sem aumentar os limites ZIP. Prefixo maior que a
janela não é acesso autorizado ao restante do arquivo. A leitura total
para CRC permanece a existente, sempre sobre um ZIP de teste em memória.

## Categorias fixas

`o3dBoneWeightHintCounts` contém somente contagens de:
plausibleBoundedBoneWeights, matrixSectionUnconfirmed,
optionalBoneSectionAbsent, boneSectionOutsideSampleBudget,
unsupportedTrailingSection, truncatedBoneCount, zeroBoneCount,
boneCountOverBudget, missingBoneNameLength, emptyBoneName,
boneNameOverBudget, truncatedBoneName, truncatedWeightCount,
zeroWeightCount, weightCountOverBudget, truncatedWeightPayload,
outOfRangeBoneVertexIndex, nonFiniteBoneWeight.

`omsiBoundedBoneHintLinkedVehicleFolderCount` conta apenas
as variantes com indício positivo no O3D exato referenciado pelo CFG
efetivamente ligado ao BUS da mesma variante, nunca pistas de outra
entrada do ZIP.

`omsiMeshLinkedWithoutBoundedBoneHintFolderCount` informa
a diferença entre variantes com vínculo M8 e variantes com indício de
ossos M14; **não** é uma contagem de mods inválidos.

O resultado do projeto continua **não autenticado**:
meshFormatVerified:false, evidenceAuthenticated:false,
gameRecognized:false, realModInspected:false,
compatibilityVerified:false, installationEnabled:false,
realGameFilesTouched:false.

## Testes e bloqueios

Inclui testes sintéticos de versões 1/3/4/5/7, indexação u16/u32, flags
estendidas, ausência opcional, tipos de truncamento, nomes opacos,
limites de ossos/pesos, vértices fora da faixa, valores NaN/Inf,
pesos finitos não semânticos, cruzamento de variante/CFG/O3D, mistura
OMSI/SII, entradas inválidas e não vazamento de informações.

Não lê mod real, filesystem, instalação de OMSI, rede, IPC, não extrai
pacotes nem altera sandbox ou permissões de host. A CI completa e a
issue #4 (Ubuntu 24.04 X11 sandbox estrito) continuam como gates de
homologação, com PR Draft e sem merge.

## Fonte técnica (não implica compatibilidade comprovada)

https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md
