# OMSI Manager | M31 — Recomposição de SHA-256 em bytes sintéticos

**Branch:** `feat/ubuntu24-synthetic-binary-provenance-v1`  
**Base:** PR #35 / M30. **Draft, sem merge, release ou instalação.**

## O problema que o M30 deixou explícito

O M30 analisou até vinte pares de SHA-256 **declarados**. Dois valores
iguais não provam que os dados foram calculados sobre bytes reais, nem
que um revisor independente adquiriu o mesmo pacote.

O M31 acrescenta um mecanismo pequeno para testar a **computação
efetiva de SHA-256 de bytes recebidos em memória**, usando dois runtimes
distintos. O caso de teste é deliberadamente **artificial** e não
utiliza arquivos de OMSI, arquivos anexados, binários Electron reais,
perfil AppArmor, diretórios de jogos, rede ou privilégios administrativos.

## Implementação e fonte de bytes

`react-prototype/scripts/ubuntu24-synthetic-byte-provenance.mjs`

O algoritmo só aceita seis `Buffer` do Node em memória, na sequência
GNOME baseline / app-specific-pilot / rollback e depois KDE nas mesmas
três fases. Cada buffer tem um marcador rígido:

`OMSI_M31_SYNTHETIC_BYTES_V1|`

Entradas sem marcador ou com mais de 8192 bytes são recusadas. O
validador não aceita caminhos de arquivo ou URLs e não contém APIs de
leitura de arquivos.

Para cada amostra, o M31:

1. Confere o marcador, o limite de tamanho, o tipo Buffer e a fase.
2. Cria um snapshot dos bytes na memória.
3. Calcula o SHA-256 com `node:crypto`.
4. Envia **o mesmo snapshot por stdin** a um processo separado
   `python3 -I -S -B`, que usa `hashlib.sha256`.
5. Rejeita divergência entre as duas implementações, falha do processo,
   erro, texto inesperado ou digest inválido.
6. Compara cada SHA-256 realmente calculado com os valores de hash
   declarados pelo operador e por um suposto revisor.
7. Compara também **os bytes dos seis snapshots** (não só seus hashes)
   para indicar se os artefatos sintéticos são exatamente idênticos.

Não é executado `shell`. O processo Python não recebe caminho de
arquivo nem credenciais, somente os bytes artificiais pelo stdin.

## Estados possíveis

- `syntheticReportedDigestsMismatchComputedBytes`: algum texto
  declarado não corresponde ao SHA-256 calculado dos bytes artificiais.
- `syntheticByteDriftBetweenReportedPhases`: há diferenças nos
  bytes das seis fases, mesmo quando os hashes declarados concordam
  com cada amostra.
- `syntheticByteHashesRecomputedAuthenticationPending`: os dois
  runtimes concordaram com os SHA-256, as declarações acompanharam
  as amostras sintéticas e os bytes das seis fases são iguais.

**Nenhum desses resultados autentica pacote real.** Node e Python
recebem **a mesma fonte de bytes**; portanto, são duas implementações
de hash, **não duas aquisições independentes do artefato**. O nome do
campo `reviewerReportedSha256` continua sendo apenas uma declaração.

## Flags de segurança invariáveis

Independentemente do estado, o relatório informa sempre:

- `realPackageBytesEverAccessed=false`
- `realPackageBytesSha256Verified=false`
- `independentArtifactAcquisitionVerified=false`
- `independentReviewerIdentityVerified=false`
- `provenanceSourceAuthenticated=false`
- `m30HumanReceiptAuthenticityVerified=false`
- `hostIdentityIndependentlyVerified=false`
- `appSpecificAppArmorPolicyVerified=false`
- `rollbackIndependentlyVerified=false`
- `rendererSandboxIndependentlyVerified=false`
- `apparmorCausalityProven=false`
- `ubuntu24StrictNativeCIPassing=false`
- `branchProtectionSatisfied=false`
- `sandboxBypassApplied=false`
- `mergeAuthorized=false`
- `releaseAuthorized=false`
- `installationAuthorized=false`

A saída contém somente estados, categorias fixas e contagens; nunca
expõe os SHA-256, conteúdo dos buffers, diretórios ou identificadores
privados.

## CI e testes

O job `build` executa:

`node --test scripts/ubuntu24-synthetic-byte-provenance.test.mjs`

São **16 testes sintéticos**, incluindo hash real em dois runtimes,
bytes alterados com hash antigo, hashes declarados forjados, bytes
alterados com hashes recalculados, fases e etiquetas trocadas, entrada
realista sem marcador, buffers grandes, dados malformados e privacidade.

**Os testes da janela X11 nativa Ubuntu 24.04 permanecem independentes
e obrigatórios.** Não existe `continue-on-error`, `--no-sandbox`
nem ajuste no AppArmor/sysctl.

## Procedimento proposto, ainda não executado, para evidência real

Um eventual teste externo só poderá ser considerado após autorização
do administrador responsável por uma VM descartável. Para não cair
na armadilha de hashes copiados, será necessário:

- definir o artefato e sua origem por identificadores imutáveis;
- obter os bytes do artefato por **dois percursos de aquisição
  efetivamente distintos**, com identidade e acesso auditados;
- calcular SHA-256 diretamente em cada arquivo adquirido, não digitar
  hashes da tela;
- confrontar tamanho, SHA e identidade do artefato antes e depois de
  cada fase e preservar os registros sob controle do responsável;
- provar política AppArmor do **executável específico** e rollback,
  sem mudanças globais;
- confirmar o **isolamento dos renderizadores Chromium** com evidência
  independente, além do mapeamento das janelas;
- obter uma execução **Ubuntu 24.04 estrita realmente verde** sem
  dispensar o teste.

A integração real acima **não faz parte do M31**. Nenhum arquivo real
foi tocado. A [issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
permanece aberta e bloqueante.
