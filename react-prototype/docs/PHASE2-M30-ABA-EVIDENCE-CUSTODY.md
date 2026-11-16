# OMSI Manager | M30 — Conferência de custódia de evidências A/B/A

**Branch:** `feat/ubuntu24-aba-evidence-custody-v1`  
**Base:** PR #34 (M29). **Draft, não mesclar, sem release.**

## Por que essa etapa existe

Os comparadores M28/M29 confirmaram a recorrência da falha histórica
Ubuntu 24.04 e definiram como reunir três fases A/B/A para GNOME e
KDE. Porém, **um conjunto de resultados categóricos de piloto não
substitui evidência independente** de bytes executados, política
AppArmor realmente aplicada/restaurada ou sandbox dos renderizadores.

O M30 cria um contrato de **conferência de recibos de evidência**, que
detecta ausências e divergências entre duas informações SHA-256
*declaradas* para a mesma categoria. Nenhum código do M30 executa um
piloto, lê um binário real, verifica um arquivo de pacote, carrega
perfil AppArmor, consulta a VM ou autentica a identidade de pessoas.

## O que o contrato aceita

`react-prototype/scripts/ubuntu24-aba-evidence-custody.mjs` aceita
apenas um envelope offline com escopo fixo e:

1. O mesmo conjunto sintético M29: GNOME e KDE, cada um com
   baseline, app-specific-pilot e rollback.
2. **Seis recibos na mesma ordem** (3 fases GNOME, 3 fases KDE).
3. Em cada fase, até três categorias de evidência: 
   `artifactBytes`, `appPolicyState` e `rendererEvidence`.
4. Nas **duas fases de rollback**, uma quarta categoria
   `rollbackRestoration`. Nos demais momentos, esse campo deve
   ser `null`.
5. Cada recibo de categoria presente inclui dois hashes
   SHA-256 relatados: `operatorReportedSha256` e
   `reviewerReportedSha256`. O primeiro hash de `artifactBytes`
   deve coincidir exatamente com o SHA do artefato declarado no
   contrato de observações M29, em todas as seis fases.

Isso corresponde a **20 pares aplicáveis**: 6 de pacote, 6 de estado
da política, 6 de evidência do renderizador e 2 de restauração.

A função verifica somente formato, ordem, integridade lógica e
igualdade dos valores *recebidos*. Se faltar uma categoria opcional,
registra sua classe; se dois hashes declarados divergirem, registra
discrepância sem esconder a diferença. Se o próprio formato ou vínculo
ao pacote declarado estiver errado, recusa todo o envelope.

## Classificações seguras

- `reportedDigestMismatchNeedsInvestigation`: há discrepância entre
  hashes informados, que requer investigação.
- `missingEvidenceReceiptsNeedsReview`: faltam recibos de evidência.
- `aBaObservationsIncompleteNeedsReview`: a própria observação A/B/A
  não demonstra todas as fases na forma relatada.
- `pairedReportedDigestsConsistentAuthenticationPending`: todos os
  valores informados concordam, mas **nenhuma identidade nem bytes
  foram autenticados independentemente**.

O relatório expõe apenas categorias fixas e contagens. Não imprime
hashes, nomes de administradores, caminhos, tokens ou logs brutos.

Mesmo o último estado sempre inclui, entre outros:

- `checkActuallyComputedPackageBytesSha256=false`
- `separatelyAuthenticatedReviewerDigest=false`
- `hashMatchEstablishesAuthenticity=false`
- `independentAdminAuthorizationVerified=false`
- `independentHostIdentityVerified=false`
- `appSpecificPolicyIndependentlyVerified=false`
- `rollbackIndependentlyVerified=false`
- `rendererSandboxIndependentlyVerified=false`
- `apparmorCausalityProven=false`
- `nativeUbuntu24StrictCIPassed=false`
- `releaseAuthorized=false`
- `mergeAuthorized=false`
- `installationAuthorized=false`

**Atenção:** o nome de campo `reviewerReportedSha256` não prova que
um revisor externo existiu ou que inspecionou os bytes. Um invasor
pode copiar o mesmo hash nos dois campos. Sem uma fonte de confiança
e uma verificação de bytes real, *igualdade não é autenticidade*.

## Testes e CI

O job `build` passa a executar
`node --test scripts/ubuntu24-aba-evidence-custody.test.mjs`,
após os contratos A/B/A anteriores. Há **17 testes adversariais**
que cobrem hashes divergentes, campos ausentes, alteração da política
de host, falsas aprovações, categorias fora da fase correta,
identidade de processos, dados privados e tentativa de elevar
um pacote incompleto a prova definitiva.

A matriz nativa Ubuntu 22.04/24.04 continua independente e
obrigatória. Um teste de recibos em memória não substitui a
janela Electron real nem verifica isolamento de renderer.

## O que ainda precisa acontecer fora da CI

Uma investigação administrativa autorizada deverá comprovar,
**por fontes externas confiáveis**:

- procedência e **SHA-256 calculado diretamente dos bytes** do mesmo
  artefato nas três fases, não apenas hashes copiados;
- identidade e autorização do administrador da VM descartável;
- estado do perfil do executável e prova de restauração após rollback;
- processos e janelas Auto/Electron reais;
- confinamento **efetivo** dos renderizadores e ausência de bypass;
- passagem efetiva do teste Ubuntu 24.04 com sandbox estrito.

Até isso acontecer, a [issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
permanece bloqueante. **Nenhum teste real em host, alteração AppArmor,
instalação de mods, extração, autorização de merge ou release faz parte
do M30.**
