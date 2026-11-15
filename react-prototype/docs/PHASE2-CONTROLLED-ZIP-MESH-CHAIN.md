# Fase 2 / M8 | Correlação sintética BUS → CFG → O3D

**Ramo:** `feat/controlled-zip-mesh-chain-v1`, empilhado na PR #11/M7, sem alterar a Biblioteca v1.

## Nova regra

O M7 permitia a pista `omsi-fixture-candidate` quando o conteúdo fictício de um arquivo `.bus` declarava `[model]` apontando para um `.cfg` do mesmo veículo, presente e com marcador simples. O M8 acrescenta outra etapa: **o CFG vinculado precisa declarar `[mesh]` apontando para um `.o3d` presente no índice do mesmo ZIP e da mesma variante `Vehicles/<variante>`**.

O código reaproveita `inspect_fixture_references()` para as duas verificações, usando listas de alvos restritas à variante atual. Não introduz novo parser de O3D, não abre arquivos externos, não realiza acesso ao disco e não extrai ZIP.

A saída preserva contagens legadas e acrescenta somente `omsiMeshLinkedVehicleFolderCount` e `omsiLinkedWithoutMeshFolderCount`. Os caminhos temporários, nomes completos e bytes de modelos **não** são publicados.

- BUS → CFG → O3D resolvidos: `omsi-fixture-candidate` (ainda não verificado).
- BUS → CFG resolvidos, mas O3D ausente, inválido ou fora da variante: `omsi-model-mesh-unconfirmed`; nenhum candidato.
- BUS/CFG apenas na mesma pasta, sem declaração `[model]`: `unlinked-omsi-fixture-markers`.
- Marcadores SII de caminhão misturados com pistas OMSI: `mixed-markers-ambiguous`.
- `[texture]` ou `[sound]` não substituem a declaração explícita `[mesh]`. `../` é inválido.

Este é **um teste de relações textuais entre entradas fictícias**, não um validador real dos formatos `.bus`, `.cfg` ou `.o3d`. A presença de bytes `.o3d` não prova que a malha seja válida, e texto/nomes podem ser falsificados. O resultado continua `gameRecognized:false`, `evidenceAuthenticated:false`, `realModInspected:false`, `compatibilityVerified:false`, `installationEnabled:false`, `realGameFilesTouched:false`.

## Testes e bloqueios

Os testes de regressão positivos do M7 foram atualizados com entradas O3D de fixture, e foram adicionados cenários negativos de O3D ausente, outra variante, contexto incorreto, traversal, CFG não vinculado, casefold/barra invertida, duplicação de pistas, misturas OMSI/SII e proteção de dados privados. Todos os ZIPs são construídos em memória com as regras de CRC, tamanho, compressão, entradas e caminhos do leitor anterior.

PR Draft, sem merge ou release. Ubuntu 24.04 X11 sandbox estrito continua bloqueando a homologação pela issue #4. Nenhum mod real foi lido ou instalado, nenhuma permissão de segurança foi reduzida.
