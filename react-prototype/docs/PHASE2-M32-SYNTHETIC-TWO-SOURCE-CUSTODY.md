# OMSI Manager | M32 — Duas fontes artificiais e cadeia de custódia dos bytes

**Branch:** `feat/ubuntu24-two-source-custody-simulation-v1`  
**Base:** PR #36/M31. **Draft, sem merge e sem instalação.**

## Objetivo

O M31 calculou SHA-256 dos seis buffers sintéticos com duas
implementações, Node e Python, mas ambos os processos receberam o
**mesmo conjunto de bytes**. Isso não equivale a duas aquisições
independentes do pacote.

O M32 acrescenta um laboratório com **dois canais explicitamente
simulados** de aquisição, identificados como `fixture-source-A` e
`fixture-source-B`. Cada canal informa seis fases em ordem:

1. GNOME: `baseline`, `app-specific-pilot`, `rollback`;
2. KDE: `baseline`, `app-specific-pilot`, `rollback`.

Em cada fase há três snapshots de bytes, recebidos **em memória**:
`acquired`, `handoff` e `received`. Logo, o modelo valida
**36 snapshots artificiais** (2 fontes × 6 fases × 3 etapas).
Os buffers devem conter o marcador `OMSI_M31_SYNTHETIC_BYTES_V1|`
e não podem ultrapassar 8192 bytes.

## Quais comparações realmente ocorrem?

O arquivo
`react-prototype/scripts/ubuntu24-two-source-custody.mjs`:

- Valida os identificadores, a sequência, os tipos e o tamanho dos
  buffers. Não aceita caminhos, URLs ou campos extras.
- Cria snapshots dos bytes e calcula SHA-256 real com Node para **cada
  uma das 36 amostras**.
- Compara os bytes de `acquired`, `handoff` e `received` para
  detectar mudanças dentro de uma cadeia sintética.
- Reutiliza o M31 para **12 aquisições artificiais** (seis por canal),
  recalculando SHA-256 com Node e Python em processo isolado.
- Compara **os bytes de aquisição A e B** em todas as fases, não apenas
  os hashes informados.
- Compara os bytes entre as fases de cada canal, para apontar mudanças
  que inviabilizem a alegação de um mesmo artefato.
- Confere os hashes declarados contra o SHA-256 calculado do
  snapshot de aquisição.

## Classificações

O primeiro problema relevante determina o status:

- `syntheticCustodyHopMutationObserved`: houve alteração de bytes
  entre aquisição, transferência e recebimento.
- `syntheticSourcesDisagreeOnBytes`: as duas fontes artificiais
  receberam bytes diferentes na mesma fase.
- `syntheticAcquisitionClaimMismatch`: um SHA declarado não
  corresponde ao conteúdo adquirido.
- `syntheticPhaseByteDriftObserved`: os bytes mudaram entre fases,
  mesmo quando as fontes A/B concordaram.
- `syntheticDualSourceBytesConsistentProvenanceUnverified`: os bytes
  artificiais concordam nos dois canais e em todas as fases.

**Mesmo o melhor resultado não prova que dois arquivos reais foram
obtidos independentemente.** Os dois canais são apenas buffers criados
pelo mesmo laboratório; nomes diferentes e objetos de memória
diferentes não verificam identidade do fornecedor, origem ou responsável.
Os dois processos de hash também continuam lendo bytes fornecidos
pelo próprio teste.

## Invariantes de segurança

Todos os resultados mantêm:

- `independentArtifactAcquisitionAuthenticated=false`
- `independentHostIdentitiesVerified=false`
- `acquisitionSourceOwnershipVerified=false`
- `independentHumanReviewerAuthenticated=false`
- `realPackageBytesAccessed=false`
- `realPackageSha256Verified=false`
- `realPackageProvenanceVerified=false`
- `m30EvidenceReceiptsAuthenticated=false`
- `realPolicyRestorationVerified=false`
- `realRendererConfinementVerified=false`
- `apparmorCausalityProven=false`
- `strictUbuntu24CIPassed=false`
- `hostSecurityPolicyChanged=false`
- `strictSandboxBypassApplied=false`
- `branchProtectionSatisfied=false`
- `requiredChecksApproved=false`
- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `installationAuthorized=false`

Nenhum hash calculado, byte, diretório pessoal ou identidade de
operador é incluído no resultado: apenas categorias, estados e
contagens.

## Testes e CI

`node --test scripts/ubuntu24-two-source-custody.test.mjs`

A suíte contém **18 testes adversariais**, abrangendo alterações
durante o transporte ou recebimento, divergência real entre fontes,
drift entre fases, hashes falsos, memória compartilhada como se fossem
dois buffers, ausência de fases, ordem trocada, fontes duplicadas,
dados excessivos, supostos arquivos reais sem marcador, campos
externos e vazamento de informações.

O passo foi inserido no `build`, depois do teste M31; **não altera**
a matriz de Ubuntu 22.04/24.04, Playwright, Windows, Arch nem o
comparador de regressões.

## O que ainda falta para proveniência independente real?

Somente em um **piloto externo, autorizado pelo administrador**:

1. Registrar a origem legítima do artefato e seu identificador imutável.
2. Realizar duas aquisições por cadeias realmente independentes,
   com responsáveis autenticados, registros de acesso e ambientes
   separados sob controle do administrador.
3. Calcular SHA-256 diretamente dos bytes reais em ambos os lados,
   conferir comprimento, assinatura/origem quando aplicável e
   controlar cada transferência em etapas verificáveis.
4. Repetir as verificações antes e depois do piloto e do rollback.
5. Auditar a política AppArmor específica e o confinamento dos
   renderizadores, e obter Ubuntu 24.04 estrito **realmente verde**.

O M32 **não executa** qualquer dessas ações e não introduz suporte
a leitura ou instalação de mods. Sem comprovação externa, a
[issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
permanece aberta e bloqueante. Toda PR continua Draft.
