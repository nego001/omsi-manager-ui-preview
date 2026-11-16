# OMSI Manager | M29 — Handoff de evidência A/B/A em duas etiquetas, sem intervenção

**Branch:** `feat/ubuntu24-two-desktop-aba-evidence-gate-v1`  
**Base:** PR #33/M28. **Draft: sem merge, release ou instalação.**

## Situação real

O Ubuntu 24.04 com sandbox estrito segue falhando antes de mapear janelas
Electron em Xvfb. O Ubuntu 22.04 abre janelas nativas; no 24.04, a tentativa
independente de `unshare --user` retorna `permission-denied`, com indicador
de restrição AppArmor habilitado, e o launcher e Electron direto encerram
com `SIGTRAP`. O controle básico `xmessage` funciona.

O M28 confirmou **a repetição histórica do gate falho em três execuções**,
mas isso não isola a causa. O próximo ensaio causal segue fora da CI,
dependendo de aprovação de administrador de uma VM descartável.

## O problema adicional que o M29 resolve

O contrato anterior `ubuntu24-controlled-pilot-aba.mjs` compara somente
**uma** etiqueta de sessão de cada vez. Seria fácil enviar uma sequência
GNOME e outra KDE com pacotes ou identificadores de VM distintos e depois
descrever o conjunto como se fosse um único experimento A/B/A.

O M29 acrescenta
`react-prototype/scripts/ubuntu24-two-desktop-aba-evidence.mjs`:
um comparador **puramente funcional** de dois blocos A/B/A, um GNOME e
um KDE, com seis registros de fase no total. A CI não coleta nem envia
provas externas; usa apenas objetos fictícios gerados pelos testes.

### Contrato de entrada (para um futuro ensaio autorizado)

- Um envelope com escopo fixo `human-supplied-disposable-host-categories-only`.
- Dois grupos **na ordem GNOME, KDE**, com três fases cada:
  `baseline`, `app-specific-pilot`, `rollback`.
- Cada bloco reutiliza o validador V1 anterior, mantendo o requisito de
  `ubuntu-24.04`, módulo e restrição AppArmor ativados, aprovação
  administrativa **declarada**, caminho estável **declarado**, nenhum
  bypass do sandbox, nenhuma execução root ou mudança de política global.
- Os seis registros devem informar o **mesmo SHA-256 do artefato** e
  o **mesmo identificador opaco de sessão descartável**.
- A etiqueta GNOME/KDE deve coincidir com cada uma das três observações
  do grupo. Processos sem identidade confirmada, janelas mapeadas sem
  proprietário, sinais conflitantes, fase fora de ordem e alterações de
  política global são recusados.
- Os valores são **informados por quem forneceu os registros**; o
  comparador não autentica a VM, os hashes dos bytes nem quem aprovou.

### Resultados possíveis

- `two-labels-reversible-correlation-reported`: ambos os blocos
  *relatam* baseline com namespace negado e SIGTRAP duplo, piloto com
  namespace permitido e janelas Auto/Electron mapeadas, e rollback com
  a falha original reproduzida.
- `two-label-evidence-incomplete-needs-independent-review`: uma etiqueta
  não reproduz todas as condições. A revisão independente permanece
  pendente, sem inferir causalidade.

Mesmo a primeira classificação significa **somente correlação relatada**,
nunca compatibilidade Ubuntu 24.04 ou homologação de segurança.

## Fatos que não podem ser certificados pelo M29

O relatório declara sempre:

- `independentAdminAuthorizationVerified=false`
- `independentHostIdentityVerified=false`
- `packageBytesIndependentlyVerified=false`
- `appSpecificPolicyIndependentlyVerified=false`
- `policyRollbackIndependentlyVerified=false`
- `chromiumRendererSandboxCertified=false`
- `apparmorCausalityProven=false`
- `realGnomeKdeDesktopCertified=false` (GNOME/KDE são etiquetas Xvfb)
- `pilotActuallyExecutedByComparator=false`
- `hostPolicyChangedByComparator=false`
- `sandboxBypassApplied=false`
- `ubuntu24StrictCIPassing=false`
- `nativeCIGateWaived=false`
- `mergeAuthorized=false`
- `installationAuthorized=false`

Não há nomes de operadores, IDs de VM, caminhos privados, argumentos de
processos, stderr bruto, SHA informado ou identificador de sessão na saída.
A entrada só existe na memória de testes sintéticos. A falha de formato
usa texto constante `UBUNTU24_TWO_DESKTOP_ABA_REFUSED`.

## Integração CI

O job **build** executa:
`node --test scripts/ubuntu24-two-desktop-aba-evidence.test.mjs`,
imediatamente após os contratos A/B/A anteriores. Os novos testes
adversariais cobrem sessões e hashes divergentes, duas etiquetas trocadas,
fases ausentes, ausência de posse da janela, `SIGTRAP` sem identificação
de processo, mudança de política, execução root, escopo de produção e
privacidade.

**O job obrigatório `native_auto_x11` e a matriz Ubuntu 22.04/24.04 não
foram alterados.** Uma suíte de dados fictícios verde não pode suprir uma
janela real com sandbox validado.

## Piloto real continua pendente

Antes de qualquer ensaio efetivo, o responsável pelo host deverá
autorizar uma VM Ubuntu 24.04 descartável, revisar um binário de caminho
absoluto estável, verificar independentemente bytes e SHA-256 antes e
depois, avaliar uma política AppArmor **específica** sem concessões
globais, testar launcher e Electron direto, **verificar isolamento real dos
renderizadores** e comprovar rollback A/B/A. Isso envolve decisões e
ferramentas administrativas **não implementadas no M29**.

Sem consentimento e essa comprovação, a [issue #4](https://github.com/nego001/omsi-manager-ui-preview/issues/4)
permanece aberta, CI estrita vermelha e PR Draft. Nenhuma leitura de
mods reais, instalação, alteração da Biblioteca, root, `--no-sandbox`,
`continue-on-error` ou liberação de merge.
