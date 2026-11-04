# Ubuntu 24.04 | Análise administrativa do AppArmor (sem instalação)

## Status das evidências

O `OMSI-Manager-Auto` e o Electron empacotado diretamente encerraram com `SIGTRAP` no runner Ubuntu 24.04, sem uma janela X11 mapeada. A janela neutra `xmessage` abriu no mesmo Xvfb. A sondagem não privilegiada de `user namespace` retornou `permission-denied`, e o indicador do AppArmor estava ativo. Ubuntu 22.04 passou. Isto **sugere uma incompatibilidade com a política de namespace do host**, mas **não comprova que AppArmor seja a causa**.

As notas oficiais do Ubuntu 24.04 descrevem a restrição e a possibilidade de conceder `userns,` através de um perfil específico para aplicativo. Fontes:
- https://documentation.ubuntu.com/release-notes/24.04/#unprivileged-user-namespace-restrictions
- https://documentation.ubuntu.com/security/security-features/privilege-restriction/apparmor/

## Antes de qualquer intervenção

O pacote atual é uma prévia Linux **portátil, não assinada**; o caminho do binário muda se a pasta for movida. Uma regra AppArmor correspondente ao executável deve ser restrita a **um caminho absoluto aprovado e estável**, jamais a um diretório de downloads genérico, pasta temporária ou padrão curinga. O executável de interesse é `OMSI-Manager-Preview`, não o wrapper `OMSI-Manager-Auto`. É obrigatório revisar a identidade e procedência do pacote, versões, caminhos, permissões, integridade e possíveis executáveis auxiliares.

O administrador deve avaliar se um perfil por executável com a permissão `userns,` é apropriado, inclusive o risco adicional de permitir namespaces. O modo AppArmor `flags=(unconfined)` do exemplo da documentação Ubuntu **não equivale a um perfil restritivo completo**, e precisa de uma decisão explícita. Não entregamos política pronta, arquivo em `/etc/apparmor.d`, script de instalação ou comando para aplicá-la.

## Critérios para um piloto autorizado

1. Usar apenas uma VM ou runner descartável com aprovação do administrador e política de mudanças documentada. O ensaio deve ter plano de restauração do estado original.
2. Conferir a política específica de um **único binário de caminho absoluto**, sem concessões globais de namespace, sem setuid e sem executar como root.
3. Comparar o mesmo artefato de CI por SHA-256, com o mesmo modo X11 e o mesmo teste real de janela do `OMSI-Manager-Auto`; exigir que a janela exista, esteja mapeada e pertença ao processo esperado.
4. Verificar **separadamente** que o sandbox do Electron continua ativo. Uma janela aberta ou mensagem de perfil carregado não é certificação do isolamento.
5. Registrar somente categorias e conclusões, jamais caminhos privados, nomes de usuários, dados de jogos ou logs brutos no GitHub.
6. Reverter qualquer configuração de teste ao final do piloto e registrar o resultado. Se falhar, manter a PR em rascunho e a CI vermelha.

## O que não fazer

Não desativar a restrição global do kernel, não usar `--no-sandbox`, não marcar o job como opcional, não elevar permissões do processo, não copiar perfis genéricos sobre binários móveis e não operar em instalação real de jogo. O OMSI Manager não precisa de permissão para instalar ou remover mods nesta etapa.

## Estado automático da triagem

O módulo `scripts/ubuntu24-app-profile-review.mjs` combina categorias de kernel e evidências X11 em uma decisão limitada:

- `request-administrator-review-of-app-specific-userns-policy`: há **indícios suficientes para solicitar avaliação humana**, jamais para autorizar aplicação.
- `investigate-startup-without-obvious-apparmor-namespace-restriction`: ambos falharam, mas o indicador não aponta restrição de namespace.
- `native-window-observed-no-policy-change-indicated`: janela nativa observada, sem motivo para pedir mudança com base nesses dados.
- `insufficient-evidence`: nenhum parecer de política deve ser inferido.

Todas as respostas incluem `apparmorCausalityProven:false`, `actualElectronSandboxCertified:false`, `profileLoaded:false` e `hostPolicyChanged:false`. Os testes sintéticos não substituem o ensaio real autorizado e não tornam a CI verde.

## Endurecimento da integração CI

O contrato de admissão `native-x11-workflow-admission.mjs` também exige o teste de classificação AppArmor no job de compilação e na matriz Ubuntu 22.04/24.04, antes de observar a janela. Mutações sintéticas verificam que não é possível retirar esse teste ou deslocá-lo para depois da coleta de evidências sem tornar a CI vermelha.

O classificador recusa parâmetros malformados e combinações contraditórias de janela/sinal para impedir parecer positivo. Mesmo que todos os contratos passem, **a falha da janela nativa Ubuntu 24.04 permanece bloqueante**. Nenhum teste aplica perfil, altera a política do host ou certifica o sandbox Electron.

## Comprovação independente da negativa do namespace

A triagem agora exige também uma tentativa **não privilegiada e limitada a 2,5 segundos** de criar um namespace temporário, sem montagem, alteração de política ou acesso a jogos. O resultado bruto e o `stderr` são descartados; somente `permission-denied`, `allowed`, `unavailable` ou `unknown` são aceitos. Essa tentativa é realizada somente quando a prova X11 real falha; uma janela aprovada não depende dela.

Com o indicador do AppArmor ativado, só se pede revisão administrativa de política específica quando **ambos** os caminhos Electron falham com `SIGTRAP`, a janela neutra X11 abre e a tentativa independente do namespace retorna `permission-denied`. Se o namespace for permitido, o diagnóstico muda para `investigate-startup-with-userns-probe-allowed`, sem recomendar intervenção AppArmor; se não houver evidência conclusiva, mantém `insufficient-evidence`.

O novo resultado é uma **correlação mais restrita**, não prova causal, e não modifica a obrigação de teste X11 nem o sandbox. Testes sintéticos cobrem negativas, permissões, valores ausentes e entradas maliciosas.

## Indicador independente do módulo AppArmor

A emissão de `request-administrator-review-of-app-specific-userns-policy` exige agora quatro evidências, todas simultâneas: módulo AppArmor com `enabled` observado em `/sys/module/apparmor/parameters/enabled`, restrição de namespace do kernel ativa, negativa da tentativa não privilegiada de namespace e duas falhas independentes do Electron após a janela neutra X11 ter funcionado.

Uma leitura ausente, desativada ou malformada do módulo deixa o resultado em `insufficient-evidence`; nunca é permitida uma recomendação baseada apenas no indicador do kernel. O teste registra exclusivamente uma categoria enumerada, não o conteúdo do arquivo nem caminhos privados. A CI ainda requer que a janela real do Electron seja comprovada com sandbox preservado.

## Evidência portátil e sanitizada por runner (CI)

A matriz Ubuntu 22.04/24.04 publica agora um arquivo JSON por runner, mesmo quando o teste nativo reprova. O registro é gerado somente pelo script de CI após as tentativas GNOME e KDE, usando categorias fixas: política AppArmor observada, resultado do teste não privilegiado de namespace, classe da falha de inicialização e existência/posse da janela X11. Não contém PID, caminho, nome de usuário, stderr, nomes de mods, valor bruto de sysfs nem conteúdo do jogo. O script rejeita entradas fora do vocabulário previsto, e o upload tem retenção limitada.

Os artefatos `native-x11-evidence-ubuntu-22.04` e `native-x11-evidence-ubuntu-24.04` permitem comparar o **mesmo pacote** sem editar o host. O resultado `allNativeWindowsVerified` diz respeito exclusivamente à janela mapeada e ao processo esperado, não comprova isolamento de renderizadores, compositor GNOME/KDE real ou causalidade do AppArmor. A aprovação do script de registro jamais transforma uma falha de janela em sucesso: `verifyNativeDesktopResults` continua bloqueante depois de escrever a evidência. Esse é um registro para auditoria e eventual revisão administrativa, não um instalador de política.

## Comparação automática de evidências entre os dois runners

Um job de **comparação somente leitura**, separado da matriz e com `needs: [build, native_auto_x11]`, executa mesmo quando o teste Ubuntu 24.04 falha. Ele baixa **os dois relatórios da mesma execução CI**, com caminhos fixos, valida um esquema estrito, rejeita arquivos fora do vocabulário e produz apenas o arquivo sanitizado `native-x11-cross-runner-comparison`. Nenhum log bruto, PID, caminho privado, nome de usuário ou dado dos mods entra na comparação.

A categoria `namespace-restriction-correlated-with-startup-failure` exige duas janelas X11 válidas no Ubuntu 22.04, namespace permitido nesse runner, restrição AppArmor habilitada no 24.04, namespace negado e falha de inicialização nas duas etiquetas de ambiente. **Correlação não é causalidade**. O relatório sempre mantém `apparmorCausalityProven:false` e `electronSandboxCertified:false`, mesmo quando ambas as janelas abrem. Se faltar qualquer artefato, a comparação reprova. Os testes da matriz Ubuntu permanecem obrigatórios, com resultado próprio, sem `continue-on-error` ou desativação de sandbox.


## Contrato A/B para um futuro piloto administrativo descartável

O módulo puramente funcional `scripts/ubuntu24-controlled-pilot-compare.mjs` e seus testes
`ubuntu24-controlled-pilot-compare.test.mjs` permitem comparar categorias relatadas
**antes** e **depois** de uma intervenção executada por administrador autorizado, em VM
descartável. Este código não cria, carrega, desativa nem sugere comandos prontos de perfil.
O workflow público executa **apenas testes sintéticos** do comparador.

A entrada `UBUNTU24_CONTROLLED_PILOT_INPUT_V1` exige exatamente duas observações,
na ordem `baseline` e `app-specific-policy-pilot`, referentes ao Ubuntu 24.04 e ao
**mesmo SHA-256 relatado** do pacote portátil. Cada observação registra só categorias:
módulo AppArmor e restrição global ativos, categoria da tentativa não privilegiada de
namespace, X11 neutro, resultado das janelas do launcher e Electron direto, modo do
perfil e declarações de que não houve alteração global, bypass do sandbox ou Electron
executado como root. O caminho absoluto do binário é revisado por humano, **não gravado**.
Relatos fora do vocabulário, pacotes divergentes e resultados contraditórios são recusados.

O resultado `candidate-for-independent-runtime-and-sandbox-review` só aparece se a
falha original foi reproduzida com `SIGTRAP` e namespace negado nos dois caminhos,
seguida por namespace permitido e **duas janelas mapeadas e pertencentes aos processos
esperados** durante o piloto. Outros resultados são `baseline-not-reproduced` e
`pilot-did-not-demonstrate-full-recovery`.

Isso **não** autentica o administrador, o host, o hash realmente executado ou a política
aplicada, **não comprova causalidade** e **não certifica o sandbox de renderização**. Os
campos de certificação continuam sempre falsos; a homologação requer comprovação
independente da política, isolamento, rollback e o job nativo Ubuntu 24.04 realmente
aprovado sob sandbox estrito. Mesmo um piloto aparentemente bem-sucedido **não remove
o bloqueio da CI nem autoriza merge ou lançamento**.

## Comparação A-B-A e reversão administrativa (sem ações no host)

O módulo scripts/ubuntu24-controlled-pilot-aba.mjs compara apenas três observações
categóricas declaradas por um administrador: **baseline** (falha anterior), 
**app-specific-pilot** (ensaio autorizado) e **rollback** (retorno ao estado inicial).
A CI executa apenas dez testes sintéticos; nenhum perfil AppArmor é gerado ou aplicado.

As três observações precisam usar exatamente o mesmo SHA-256 informado, o mesmo
identificador aleatório opaco de sessão descartável (64 hex) e a mesma etiqueta
GNOME ou KDE. A regra exige módulo AppArmor e restrição global ativados nos três
momentos, pacote portátil em caminho estável revisado, ausência de elevação root,
ausência de bypass do sandbox e nenhuma mudança de política global.

A categoria **reversible-namespace-correlation-observed** exige:
1. Primeiro: namespace negado e dois caminhos Electron falhando com SIGTRAP.
2. Piloto: namespace permitido e janelas realmente mapeadas e atribuídas aos dois processos.
3. Reversão: namespace negado e ambas as falhas SIGTRAP novamente observadas.

Qualquer lacuna ou contradição impede essa conclusão. Observações incompatíveis
de processo, pacote, sessão, desktop, aprovação ou segurança são recusadas.
A comparação **não autentica** o host, a política carregada, o hash executado
ou a remoção de perfil. Mesmo o padrão completo continua sendo somente correlação
reversível, nunca prova causal, certificação do isolamento Electron ou aprovação
de distribuição. Não alterar a falha obrigatória do Ubuntu 24.04 nem o Draft da PR.

A documentação oficial descreve perfis específicos com permissão userns para
aplicativos que necessitam namespaces, mas também ressalta que uma permissão
não é uma certificação do sandbox do Chromium. Qualquer piloto permanece
dependente de autorização humana e de prova independente do confinamento.
Referências: https://documentation.ubuntu.com/release-notes/24.04/
e https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md
