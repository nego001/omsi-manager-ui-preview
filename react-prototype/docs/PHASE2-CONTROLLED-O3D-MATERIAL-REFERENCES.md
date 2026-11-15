# OMSI Manager | Fase 2 / M12: referências sintéticas de materiais O3D

**Ramo:** feat/controlled-zip-o3d-material-references-v1
**Base:** PR #15/M11, stack Draft.
**Escopo:** somente ZIPs descartáveis gerados pela CI, em memória.

## Sequência de indícios

M8: referência BUS → CFG → O3D, dentro do mesmo ZIP e da mesma variante.
M9: assinatura e versão plausíveis do O3D (somente prefixo).
M10: primeira seção `0x17` de vértices sintéticos.
M11: primeira seção `0x49` de triângulos sintéticos, índices de vértices dentro da faixa.
**M12:** primeira seção `0x26` de materiais sintéticos, bloco fixo de 11 floats,
comprimento de nome limitado, **índice de material do triângulo dentro da contagem**.

O algoritmo M12 é um classificador de **layout de bytes e relações numéricas**,
não um parser real de O3D. Não interpreta floats nem a codificação do nome,
não avalia UV, textura, MTL, shader, matriz, materiais válidos, topologia,
qualidade de malha, aparência, compatibilidade ou autenticidade.

## Limites estritos do laboratório

- Janela por O3D: **até 8.192 bytes**, somente durante a leitura CRC já autorizada.
- Primeira tabela de vértices: **1 a 32** (M10).
- Primeira tabela de triângulos: **1 a 64** (M11).
- Primeira tabela de materiais: **1 a 16**.
- Cada material fictício: **44 bytes** para onze floats32, depois
  **um byte de tamanho do nome**, seguido de **1 a 48 bytes** de nome opaco.
- Material referenciado pelos triângulos: **índice u16 menor que a
  quantidade de materiais**. Nenhum nome/índice é exposto.

Esses orçamentos **não** estabelecem limites do OMSI. Exceder os valores
retorna uma classificação de orçamento do laboratório, não um diagnóstico
de arquivo real danificado. Seções em ordem alternativa, desconhecidas ou
protegidas podem ser legítimas e não são reconhecidas neste protótipo.

## Saída sem dados privados

`o3dMaterialReferenceHintCounts`: somente totais destas categorias estáticas:
`plausibleBoundedMaterialReferences`,
`triangleSectionUnconfirmed`,
`missingMaterialSection`,
`unsupportedMaterialSection`,
`truncatedMaterialCount`,
`zeroMaterialCount`,
`countOverBudget`,
`truncatedMaterialFloats`,
`missingMaterialNameLength`,
`emptyMaterialName`,
`nameOverBudget`,
`truncatedMaterialName`,
`outOfRangeTriangleMaterial`.

`omsiBoundedMaterialHintLinkedVehicleFolderCount`: quantas variantes
fictícias têm a pista no O3D exato do BUS → CFG → O3D.

`omsiMeshLinkedWithoutBoundedMaterialHintFolderCount`: variantes
que possuem vínculo M8 mas não essa nova pista material.

A classificação anterior permanece **inalterada**, mesmo com material fictício
aparentemente consistente. Flags públicas continuam:
`meshFormatVerified=false`,
`evidenceAuthenticated=false`,
`gameRecognized=false`,
`realModInspected=false`,
`compatibilityVerified=false`,
`installationEnabled=false`,
`realGameFilesTouched=false`.

## Testes e segurança

Testes adversariais: versões sintéticas v1/3/4/5/7; flags de índices
16/32 bits; materiais ausentes, truncados ou em excesso; comprimento
de nome inválido/truncado; referência de material fora da tabela;
pistas de outro O3D, CFG ou variante; marcadores OMSI/SII misturados;
bytes privados e argumentos inválidos.

Sem arquivo de mod real, extração, leitura da pasta de jogo, escrita em
sistema de arquivos, rede/IPC, instalação, alteração de sandbox ou
redução do orçamento ZIP. **PR Draft, sem merge ou release.**
Ubuntu 24.04 com sandbox X11 estrito permanece bloqueante na issue #4.

Referência externa para a estrutura pesquisada (não equivale a homologação):
https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md
