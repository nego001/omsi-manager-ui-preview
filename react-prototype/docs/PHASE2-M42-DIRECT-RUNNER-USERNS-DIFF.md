# OMSI Manager | M42 — estados de user namespaces na execução direta 22.04 × 24.04

**Branch:** `feat/ubuntu22-24-userns-readonly-diff-v1`  
**Base:** PR #46 / M41. **Draft, sem merge, instalação ou alteração de política.**

## Evidência real consolidada até M41

A [CI M41 #44149253407](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/44149253407)
concluiu com **21/22 jobs aprovados**. A única reprovação foi o
`Native Auto X11 real-window check (ubuntu-24.04, strict sandbox)`.
A verificação histórica de PRs, anteriormente recusada, também passou.

Os dois jobs diretos (22.04 e 24.04) usaram o **mesmo artefato Linux
não assinado produzido pela CI**, verificado por SHA-256 e pelo guard
de extração, sem `strace`, sem `--no-sandbox` e sem instalar mods.

| Evidência direta, no mesmo processo M40/M41 | 22.04 | 24.04 |
|---|---|---|
| Linha de comando nativa correta | confirmada | confirmada |
| Título esperado e `_NET_WM_PID` correspondente | confirmados | não observados |
| Janela X11 `IsViewable`, geometria >=800×500 | confirmada | não observada |
| Resultado do processo | timeout controlado | SIGTRAP, sem timeout |

O comparador real emitiu
`ubuntu22OwnedMappedDirectWindowWhileUbuntu24SIGTRAPNoMappedWindow`.
**Isso estabelece uma diferença funcional reproduzível, mas ainda não
demonstra causa AppArmor, userns, capacidade Linux ou seccomp.**
A propriedade X11 de PID não é criptograficamente autenticada;
o sandbox do Chromium/renderer continua sem certificação independente.

## O que M42 mede, sem alterar o host

O M42 aproveita **os mesmos dois jobs explícitos do M41**, sem
nova matriz nem nova máquina, e coleta os seguintes dados antes
da instalação das dependências X11:

- Presença do módulo AppArmor (`enabled`, `disabled`,
  `unknown`, `unavailable`).
- Categoria do controle
  `/proc/sys/kernel/apparmor_restrict_unprivileged_userns`.
- Categoria de `/proc/sys/kernel/unprivileged_userns_clone`.
- Se `/proc/sys/user/max_user_namespaces` é zero ou positivo.
- Categoria do perfil AppArmor **do processo Node observador**,
  sem revelar nome, caminho ou conteúdo bruto.
- Resultado de uma tentativa **não privilegiada** de
  `unshare --user --map-root-user true` em processo filho
  descartável, com timeout de 2,5 s e classificação sanitizada
  (permitido, permission-denied, unsupported ou indisponível).

**Não há `sudo` no teste de namespaces nem gravação de AppArmor
ou sysctl.** O unshare cria, no máximo, um namespace temporário
não privilegiado no próprio processo filho e termina imediatamente.
A observação do processo Node **não prova diretamente** a política
final aplicada ao processo Electron ou ao renderer.

`auto-x11-direct-userns-observation.mjs` só funciona nos dois
runners autorizados, não root e em GitHub Actions, e emite
`m42-userns-ubuntu-22.04.json` e
`m42-userns-ubuntu-24.04.json` (dados de categoria apenas).

## Comparação com janela e sinais reais

O novo `auto-x11-direct-userns-compare.mjs` lê:

- Dois relatórios M40 de saída direta.
- Dois relatórios M41 de janela X11 atribuída ao próprio processo.
- Dois relatórios M42 de restrições de namespaces do host.

Ele revalida os **contratos M40/M41**, exige exatamente dois
relatórios M42 com runner e campos fixos, recalcula as categorias
e recusa valores privados, falsos sinais de sandbox e documentos
incompletos. Uma falha de coleta torna a comparação **vermelha**,
não aprovada por exceção.

Um contraste entre Ubuntu 22.04/24.04 pode orientar uma
investigação de política AppArmor, mas **não comprova causalidade**.
Também é possível os dois sistemas negarem `unshare`, o que
restringiria a hipótese de que só a recusa desse comando explica
a diferença gráfica.

Há **13 testes adversariais** sobre valores inconsistentes,
logs falsificados, comparações de runner, ambiente de execução
fora da CI, recusa de alterações e integridade do cruzamento.

## Portas de segurança mantidas

- `policyDifferenceProvesSIGTRAPCause=false`
- `usernsDeniedIsProofOfApparmorCause=false`
- `NodeHostProbeProvesElectronRendererConfinement=false`
- `nativeUbuntu24X11GatePassed=false`
- `nativeUbuntu24GateWaived=false`
- `apparmorPolicyChanged=false`
- `sysctlChanged=false`
- `sandboxBypassApplied=false`
- `realModRead=false`
- `mergeAuthorized=false`
- `releaseAuthorized=false`
- `installationAuthorized=false`

O gate original de janela X11 estrita em 22.04 e 24.04 **não foi alterado**.
A [issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
permanece aberta e bloqueante. Um experimento causal de AppArmor
ainda depende de um administrador autorizado, VM descartável,
perfil específico, restauração auditada e isolamento independente
dos renderizadores. Não faz parte do M42.
