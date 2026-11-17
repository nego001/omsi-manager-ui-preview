# OMSI Manager — M36 | Decodificação restrita dos nomes de capacidades Linux

**Base:** M35 / PR #40. **Escopo:** CI do Ubuntu 24.04, diagnóstico de leitura, sem alterações no host.

## Observação real que motivou a etapa

A CI [#44013001526](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44013001526)
concluiu com **18/19 jobs aprovados**. O único job reprovado
permanece `Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)`.
O job de diagnóstico do pacote Electron real passou e publicou:

- `kernelLastCapabilityIndex=40`, vindo da leitura pública de `/proc/sys/kernel/cap_last_cap`;
- 12 chamadas `PR_CAPBSET_READ`, com 8 respostas `EINVAL`;
- 0 argumentos numéricos decodificados pelo M35;
- 12 argumentos de capacidades simbólicos ou não reconhecidos, incluindo
  os 8 `EINVAL`, sem prova do índice correspondente.

Não é correto converter automaticamente esses 8 `EINVAL` em
negação do AppArmor, nem inferir que estão acima da capacidade 40.

## O que muda no M36

`react-prototype/scripts/auto-x11-symbolic-capabilities.mjs`
usa **a mesma observação limitada** do M33/M34/M35. A referência
estática é a sequência de **41 capacidades UAPI do Linux (0 a 40)**
descritas em `include/uapi/linux/capability.h` do kernel:
`CAP_CHOWN` é 0, `CAP_SYS_ADMIN` é 21,
`CAP_BPF` é 39 e `CAP_CHECKPOINT_RESTORE` é 40.

Ele reaproveita a validação do M35 sobre os traces e o limite
do kernel, sem abrir arquivos de aplicativos ou executar processos
adicionais. Para cada chamada completa, identifica apenas o nome
literal `CAP_*` **quando pertence à tabela fechada**.

- Para um nome conhecido: compara o índice UAPI com o limite do kernel
  e registra os totais de sucesso ou `EINVAL` dentro/fora do limite.
- Para `CAP_???`, nomes futuros não conhecidos, anotações de
  `strace` ou argumentos ambíguos: mantém a categoria **desconhecido**.
- Para números que o M35 já conseguiu decodificar: não realiza
  uma segunda atribuição de índice.
- Exige a igualdade das contagens simbólicas e dos `EINVAL` com
  o relatório M35. Discrepâncias recusam a observação.
- Não publica nomes individuais de capacidades, PIDs, flags,
  linhas de rastreamento, diretórios ou tokens: somente contagens
  e um status padronizado.

Possíveis estados:

1. `knownSymbolicCapabilityWithinBoundReturnedEINVAL`;
2. `unknownSymbolicCapabilityEINVALStillInconclusive`;
3. `knownSymbolicCapabilityAboveBoundReturnedEINVAL`;
4. `noSymbolicCapabilityEINVALObserved`.

Um status compatível com índice fora de faixa **não prova a causa
da falha nativa**; o Electron segue instrumentado por `ptrace`.

## Evidências adicionais e testes

O script de observação real agora emite `M36_SYMBOLIC_CAPABILITIES`
logo após `M33_SYSCALL_CATEGORIES`, `M34_PRCTL_CONTEXT`
e `M35_CAPABILITY_BOUNDARY`, a partir do **mesmo pacote e trace**.

Adicionamos **16 testes adversariais** ao job rápido e ao diagnóstico
real: nomes reconhecidos e desconhecidos, limite inclusivo,
`CAP_???`, índices numéricos, anotações, argumentos truncados,
privacidade, contagens contraditórias e falsos sinais de aprovação.
Um teste verde confirma a lógica do classificador, não o sandbox.

## Bloqueios de segurança

Todo relatório M36 preserva:
`recognizedNameImpliesCapabilityGranted=false`,
`unknownSymbolicIsProofAboveKernelBound=false`,
`capabilityRangeCausesSIGTRAPProven=false`,
`apparmorDenialFromPRCTLProven=false`,
`apparmorCausesSIGTRAPProven=false`,
`chromiumRendererSandboxCertified=false`,
`strictUbuntu24NativeGatePassed=false`,
`nativeGateWaived=false`,
`hostPolicyChanged=false`,
`sandboxBypassApplied=false`,
`mergeAuthorized=false`, `releaseAuthorized=false` e
`installationAuthorized=false`.

Não há alteração de AppArmor, `sysctl`, privilégios, configuração
do Electron, teste X11 estrito, proteção da `main` ou qualquer
arquivo real de OMSI. Nenhuma PR mesclada e nenhuma instalação ou
release autorizados. A
[issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
continua aberta e bloqueante.

Referências públicas técnicas para a tabela e a semântica:
- https://github.com/torvalds/linux/blob/master/include/uapi/linux/capability.h
- https://man7.org/linux/man-pages/man7/capabilities.7.html
- https://manpages.ubuntu.com/manpages/noble/man2/prctl.2.html
