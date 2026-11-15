# OMSI Manager | Fase 2 / M13: indícios da matriz O3D 0x79

**Base:** PR #16 / M12. **Branch:** feat/controlled-zip-o3d-matrix-hints-v1.
**Estado:** empilhado, somente Draft, sem merge/release.

## Escopo

M13 preserva a cadeia sintética M8 → M12 (BUS → CFG → O3D e
seções 0x17/0x49/0x26) e acrescenta uma verificação *mínima* da próxima
seção 0x79: **16 valores float32 (64 bytes)** em ordem de bytes little-endian.
Não transforma vértices, não calcula posições ou inversas de matrizes,
não manipula o arquivo original e não verifica renderização, UV,
normais, triângulos ou compatibilidade com o OMSI.

Somente bytes de ZIPs **fictícios da CI, criados em memória**, previamente
submetidos aos limites de índice, CRC e tamanho do leitor original.

### Resultados de categoria fechada
- plausibleBoundedMatrixLayout: a seção 0x79 veio imediatamente após a
  tabela fictícia de materiais e contém 16 float32 finitos.
- materialSectionUnconfirmed: alguma etapa M8–M12 requerida falhou.
- extendedFlagsUnconfirmed: flags fora do bit 0 nas versões observadas
  a partir da versão 3. Inclui os casos reportados para O3D v7/flags 3
  protegidos; **não** afirma arquivo real inválido.
- missingMatrixSection: bytes terminam logo após a tabela de materiais.
- unsupportedMatrixSection: o próximo byte não é 0x79. O leitor completo
  pode aceitar seções em outra ordem ou dados opacos; este protótipo não.
- truncatedMatrixPayload: não há 64 bytes depois da tag.
- nonFiniteMatrixElements: pelo menos um float32 sintético é NaN/inf.

Os resultados não incluem qualquer valor da matriz, nome, byte,
caminho, identificador de arquivo, variante ou conteúdo privado.

### Correlação exata, sem emprestar evidências

A nova pista só conta quando o O3D está referenciado por um CFG marcado,
que é referenciado pelo BUS da mesma variante do mesmo ZIP:

- o3dMatrixSectionHintCounts: contagens agregadas por categoria fechada.
- omsiBoundedMatrixHintLinkedVehicleFolderCount: variantes fictícias com
  BUS → CFG → O3D e indício positivo de matriz.
- omsiMeshLinkedWithoutBoundedMatrixHintFolderCount: variantes com
  vínculo M8, mas sem indício positivo da matriz.

**Sem alteração da classificação de jogo de M8.** O retorno mantém
meshFormatVerified:false, evidenceAuthenticated:false,
gameRecognized:false, realModInspected:false,
compatibilityVerified:false, installationEnabled:false e
realGameFilesTouched:false. Matriz de floats finitos **não** significa
transformação afim válida, modelo renderizável ou autenticidade.

### Orçamentos e regressões

- Reutiliza **o mesmo prefixo M12 limitado a 8.192 bytes por O3D**,
  sem novo buffer, sem ampliação dos limites globais do ZIP.
- Herda 1–32 vértices, 1–64 triângulos, 1–16 materiais como **limites
  artificiais da fixture, não limites reais do formato OMSI**.
- Novos testes: versões 1/3/4/5/7; índice 16/32 bits; flags 3 e bits
  desconhecidos; tag ausente, diferente ou deslocada; truncamento em
  múltiplos pontos; valores não finitos; valores finitos sem semântica;
  seção de materiais inválida; referência a O3D não vinculado;
  mistura OMSI/SII; privacidade; API inválida; caso-limite do orçamento.

**Nenhum mod real, filesystem, extração, pasta de jogo, rede, IPC,
instalação, desinstalação ou alteração de sandbox.** Ubuntu 24.04 X11
estrito permanece como bloqueio de homologação na issue #4.

## Referência técnica

A seção O3D documentada em openOMSI descreve tag 0x79 com 16 f32 e
relata peculiaridades em arquivos v7/flags 3. O laboratório **não**
se propõe a reproduzir o parser integral:

https://github.com/openOMSI-org/openOMSI/blob/main/docs/FORMATS.md
