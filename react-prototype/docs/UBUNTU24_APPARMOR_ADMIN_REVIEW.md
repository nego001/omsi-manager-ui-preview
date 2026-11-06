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


## SHA-256 do pacote efetivamente lido pelos runners Ubuntu

O diagnóstico X11 lê novamente o pacote `OMSI-Manager-Preview-Linux-x64.tar.gz`
antes de abrir Electron e calcula SHA-256 **a partir dos bytes reais**, não apenas
da declaração do arquivo .sha256. O leitor recusa link simbólico, arquivo não regular,
sidecar malformado, nome inesperado, tamanho fora do limite e hash divergente.
Não registra conteúdo do pacote nem dados pessoais.

O esquema de evidências muda para `AUTO_X11_HOST_EVIDENCE_V2` e inclui
`archiveSha256`. A comparação `AUTO_X11_CROSS_RUNNER_COMPARISON_V2`
recusa divergência entre os dois hashes e registra somente o hash comum e os
resultados sanitizados. Os contratos sintéticos rodam na compilação e em ambos
os jobs Ubuntu. A verificação real só acontece quando cada runner lê o pacote
baixado do artifact da **mesma CI**.

O SHA-256 verifica igualdade de bytes nos jobs e consistência com o sidecar;
**não é assinatura digital**, não autentica um emissor externo, não certifica
sandbox, não prova causalidade do AppArmor e não muda o status de falha X11.

## Evidência de restrições do processo real de renderização

O teste do Linux portátil passou a consultar o PID do renderizador por meio da
API `webContents.getOSProcessId()` do processo principal do Electron.
Uma sonda **somente leitura** inspeciona `/proc/<pid>/status` e `cmdline`,
confirma o tipo `--type=renderer` do executável empacotado e exige as categorias
`Seccomp: 2` (filtro) e `NoNewPrivs: 1`. A identidade do PID é consultada
novamente depois da leitura, recusando troca durante a inspeção. A verificação
é repetida nas etiquetas X11 GNOME e KDE do teste existente.

A saída é apenas categórica: nenhum PID, UID, token, caminho, argumento bruto,
nome de arquivo privado ou conteúdo de jogo é registrado. Contratos unitários
recusam estado `/proc` duplicado/contraditório, parâmetros de bypass e processo
sem papel renderer. O teste do aplicativo real falha se as restrições esperadas
não forem observadas.

**Limite:** observar Seccomp e `NoNewPrivs` é mais forte que verificar apenas
`sandbox: true` no código, mas **não certifica por si só** os namespaces do
Chromium, a eficácia completa do sandbox, o AppArmor ou a compatibilidade Ubuntu
24.04. O Ubuntu 24.04 continua sujeito à sua prova nativa X11 estrita e
reprovada quando houver `SIGTRAP`, sem alterar o host.


## Triagem limitada da sonda do renderizador

O commit que introduziu a leitura do processo real reprovou no smoke do pacote
Linux, com erro genérico `ELECTRON_RENDERER_KERNEL_EVIDENCE_REFUSED`.
**Isso não é prova de sandbox desativado**; a versão anterior misturava erro de
identificação do processo, formato /proc e falha de leitura em uma única exceção.

A triagem agora reporta **somente uma categoria estática**:
`invalid-probe-context`, `invalid-process-id`, `proc-read-unavailable`,
`invalid-proc-status`, `invalid-proc-command-line`, `unexpected-executable`,
`renderer-role-unverified`, `sandbox-bypass-switch`,
`invalid-seccomp-field` ou `invalid-no-new-privileges-field`.
Nenhum PID, argumento bruto, caminho ou exceção de sistema é publicado.
Se Seccomp/NoNewPrivs forem insuficientes, mostra apenas os indicadores já
categorizados e mantém a CI vermelha. Isso é diagnóstico, **não relaxamento**
do requisito e nem certificação de sandbox.

O comparador Ubuntu continua exigindo os dois artefatos; a falha dependente
de download após um build vermelho não deve ser interpretada como nova
evidência sobre o AppArmor.


## Conferência do papel real do renderizador com métricas do Electron

Após a primeira falha `renderer-role-unverified`, a inspeção passou a correlacionar
`webContents.getOSProcessId()` com um **único** registro `type: Tab` de
`app.getAppMetrics()`, incluindo timestamp de criação válido. A API oficial
confirma que `getOSProcessId()` fornece o PID do renderizador e a estrutura
`ProcessMetric` diferencia `Tab`, `Browser`, `Utility` e outros processos.

O argumento `--type=renderer` continua válido quando presente; mas algumas
invocações reais podem não exibir esse argumento em `/proc/cmdline`.
Nesses casos, o papel só é aceito mediante **prova cruzada do processo principal**,
nunca por uma opção booleana fornecida ao classificador.
Papel explícito contraditório, PID divergente, métrica duplicada, ausência de
timestamp ou parâmetros de bypass continuam bloqueantes.

Essa mudança não altera `Seccomp=2` nem `NoNewPrivs=1`, não imprime PID ou
argumentos, não modifica AppArmor e não confere certificação de sandbox.
Fontes: https://www.electronjs.org/docs/latest/api/web-contents e
https://www.electronjs.org/docs/latest/api/structures/process-metric


## Categorias para divergência do papel Chromium (sem publicar a linha de comando)

A validação da CI do commit `91671a6` continuou recusando a categoria
`renderer-role-unverified` mesmo com a confirmação `type: Tab` por métricas do Electron.
A sonda foi endurecida para distinguir **argumento de tipo duplicado**,
**papel contraditório GPU**, **Utility**, **Zygote** e **outro tipo desconhecido**.
A ausência de `--type=` com métrica autenticada continua elegível; papel
explicitamente divergente, mesmo com `Tab`, continua bloqueado.

São apenas categorias prefixadas `renderer-role-` e nomes fixos, sem logar
PID, argumentos originais, conteúdo privado, valores desconhecidos ou caminhos.
Esta etapa identifica a divergência observada, sem declarar isolamento ativo,
sem modificar sandbox/AppArmor e sem retirar qualquer falha obrigatória.


## Renderizadores Linux originados de Zygote: correção de falso negativo

A CI do commit `8543fc4` confirmou a categoria
`renderer-role-conflicting-zygote` no processo cuja identidade também foi
correlacionada com uma métrica Electron `type: Tab`. A documentação oficial do
Chromium descreve o modelo de inicialização Linux: renderizadores são criados
por `fork()` do processo Zygote; a linha de comando de origem pode continuar
marcada `--type=zygote` após o fork. Assim, esse argumento **não basta**
para classificar o processo como Zygote em execução.

A sonda agora aceita **somente** essa aparente divergência quando:
- o PID do `webContents` coincide com exatamente uma métrica `type: Tab`
  e timestamp válido obtidos pelo processo principal do Electron;
- o executável do `/proc/cmdline` é o esperado;
- não existem switches `--type=` duplicados;
- não há `--no-sandbox`, `--disable-setuid-sandbox`,
  `--disable-seccomp-filter-sandbox`, `--no-zygote` ou `--single-process`;
- o processo continua exigindo `Seccomp=2` e `NoNewPrivs=1`.

GPU, Utility, tipo desconhecido e Zygote sem métrica Tab válida são recusados.
O resultado fica classificado como `electron-tab-metric-and-zygote-fork-cmdline`,
sem registrar PID ou argumentos. A exceção é restrita à identificação Linux:
**não certifica todo o sandbox Chromium**, não altera políticas do kernel/AppArmor
e não modifica o bloqueio obrigatório Ubuntu 24.04.

Referência técnica:
https://chromium.googlesource.com/chromium/src/+/474020269055c03ca1386e931d918e47656608a2/docs/linux_zygote.md


## Playwright Electron não é sandbox estrito por padrão

Foi identificada a origem do `sandbox-bypass-switch` no smoke Linux
empacotado: o teste chamava `_electron.launch()` sem
`chromiumSandbox:true`. **O padrão documentado do Playwright é false**,
diferente do navegador Electron iniciado diretamente. Isso significa que o
smoke anterior de interface não era comprovação de sandbox nativo.

Ambos os lançamentos da prévia no smoke (inicial e os ambientes rotulados
GNOME/KDE) agora passam **`chromiumSandbox:true`** explicitamente.
O requisito mínimo de Playwright passou a 1.59, versão que documenta
essa opção. Um teste de fonte verifica todas as invocações e recusa omissões
ou `chromiumSandbox:false`.

A sondagem de runtime **continua** a exigir renderer identificado e
`Seccomp=2` com `NoNewPrivs=1`; flags `--no-sandbox` continuam proibidas.
Se a imagem Ubuntu do job de compilação impedir user namespaces, o teste
estrito deve **reprovar**, registrando o bloqueio de ambiente; não aplicar
mudança global de AppArmor, não habilitar setuid, não desativar sandbox.

O teste com Xvfb não equivale a GNOME/KDE real. A matriz X11 nativa
Ubuntu 22.04/24.04 e a revisão administrativa continuam exigências
separadas. A documentação oficial:
https://playwright.dev/docs/api/class-electron
https://www.electronjs.org/docs/latest/tutorial/sandbox


## Weston Wayland: corrigir defaults de sandbox no Playwright

O lançamento da prévia Linux no Weston headless também usava
`_electron.launch()` sem solicitar `chromiumSandbox:true`, enquanto
o Playwright usa `false` por padrão. Os **três locais de lançamento**
(Wayland explícito, seleção automática e etiquetas GNOME/KDE simuladas)
passaram a exigir `chromiumSandbox:true`, sem modificar o executável
distribuído ou a política AppArmor do host.

O contrato de fonte no teste de renderizador verifica todos os locais de
lançamento e recusa omissão ou `chromiumSandbox:false`.
A validação de janela Weston só comprova o uso do socket Wayland e a
interface em ambiente headless, e não compatibilidade real com
Hyprland, Mutter ou KWin, nem isolamento Chromium integral.

A suíte de segurança também foi sincronizada com a decisão anterior sobre
Zygote: o argumento `--type=zygote` é permitido **apenas** quando a
identidade `Tab` do processo já foi confirmada; argumentos de tipo
duplicados continuam rejeitados. O teste antigo que classificava todo
Zygote como divergente foi corrigido. A prova de Seccomp e NoNewPrivs
continua obrigatória e o gate Ubuntu 24.04 segue bloqueante.


## Separação explícita de ambientes: build estrito em Ubuntu 22.04

As CI `41961311007` e `41961315825` terminaram com **839/839
Playwright, 20/20 contratos da sonda e os dois jobs Windows aprovados**,
mas o smoke Linux empacotado com `chromiumSandbox:true` falhou antes
de abrir janela: `Process failed to launch!`. Isso **não certifica**
sandbox quebrado no aplicativo, apenas demonstra que o lançamento estrito
não funcionou no job `ubuntu-latest` utilizado na época.

O job de build agora roda **explicitamente no Ubuntu 22.04**, imagem
em que a matriz nativa anterior conseguia iniciar o mesmo aplicativo
sem desativar o sandbox. Isso permite testar o artefato Linux com
Playwright `chromiumSandbox:true` e, se passar, publicar o pacote
para a matriz de verificação. Um contrato de workflow impede retorno
silencioso para `ubuntu-latest` ou troca por `ubuntu-24.04`,
e exige os dois smokes de Linux empacotado (X11 e Weston).

**Crucial:** o Ubuntu 24.04 permanece obrigatório e bloqueante na
matriz `native_auto_x11`. A mudança do build **não é prova de
compatibilidade Ubuntu 24.04**; é a separação entre ambiente de
construção conhecido e ambiente restritivo sob investigação. Não foram
alterados AppArmor, kernel, perfis setuid, flags ou políticas de host.
Se o Ubuntu 22.04 com sandbox estrito também falhar, manter o build
vermelho e investigar a evidência, sem bypass.

## Weston 9 headless: sintaxe de renderizador compatível

Na CI [41972033016](https://github.com/nego001/omsi-manager-ui-preview/actions/runs/41972033016),
o smoke Linux empacotado com sandbox estrito observou `Seccomp=2` e
`NoNewPrivs=1` no renderizador e passou. O build falhou depois,
no teste Wayland: o Weston 9 do Ubuntu 22.04 encerrou com
`fatal: unhandled option: --renderer=pixman`, antes da criação do socket.

O laboratório usa agora `--use-pixman`, sintaxe documentada
para o Weston 9, conservando o compositor headless de software.
Um contrato determinístico recusa nomes de socket com injeção de
argumentos, exige os argumentos permitidos e impede a regressão
para a opção de Weston mais recente. O workflow executa esse
contrato antes do smoke Wayland e seu guard de CI impede omissão.
Isso não modifica flags do Electron, AppArmor ou permissões do host.
O teste Wayland ainda não comprova GNOME, KDE ou Hyprland reais.

Referência da versão 9:
https://pq.pages.freedesktop.org/weston/toc/running-weston.html

## Rastreabilidade de PID nos comparadores de falha SIGTRAP

Os comparadores categóricos A/B e A-B-A agora só tratam `SIGTRAP`
como falha nativa reproduzida quando **cada** caminho de execução também
relata `nativeProcessObserved:true`. Sinal isolado sem processo observado
é insuficiente para atribuir o problema ao Electron; baseline ou rollback
permanecem não demonstrados.

A triagem X11 ao vivo também exige `nativeProcess:true` para
`OMSI-Manager-Auto` e para o Electron direto antes de classificar a dupla
falha como suspeita de restrição do sandbox. O diagnóstico envia à triagem
somente esse booleano já coletado, sem PID, cmdline nem caminho privado.
Os novos testes cobrem sinal sem processo, janela não autenticada e
rollback sem reprodução. Isso reduz falsos positivos, **não resolve
o SIGTRAP** do Ubuntu 24.04, não comprova AppArmor e não autoriza merge.

## Prova de posse da janela e encerramento nos diagnósticos X11

A triagem X11 agora só chama uma janela nativa de verificada quando
**três condições** são verdadeiras no mesmo resultado: estado mapeado,
processo nativo observado e propriedade X11 confirmada por
`_NET_WM_PID`. A prova de propriedade já era exigida na execução real;
ela também passou a ser obrigatória na interface do classificador.
O código de diagnóstico recebe apenas o booleano `windowOwned`,
nunca o PID ou a resposta original do X11.

O diagnóstico de dupla falha `SIGTRAP` exige, além das evidências de
processo e dos dois sinais, a observação dos eventos de encerramento de
**ambos** os controles. Isso impede que valores sintéticos inconsistentes
sejam interpretados como falha real confirmada.

O teste Ubuntu 24.04 permanece estritamente bloqueante. As etiquetas
GNOME/KDE rodam em Xvfb, não em compositores de desktop reais. Nada
disso instala perfil AppArmor, altera o host, confirma causalidade ou
certifica o sandbox Electron.

## Rótulo AppArmor do renderizador em execução (sem modificar política)

Uma sonda adicional somente leitura consulta o arquivo do processo
`/proc/<pid>/attr/current`, usando o mesmo PID do renderizador já
confirmado pelo processo principal do Electron. O arquivo pode conter
o **nome do perfil AppArmor e até caminhos privados**; por isso, o
conteúdo bruto nunca aparece no log, no relatório nem em exceções.

O resultado contém apenas `apparmorRendererLabelCategory`:
`unconfined`, `enforce-label-observed`,
`complain-label-observed`, `kill-label-observed`,
`unknown` ou `unavailable`. Se o arquivo não puder ser lido,
a sondagem categoriza como `unavailable`, sem alterar a verificação
obrigatória de `Seccomp=2` e `NoNewPrivs=1`.

**Limitação:** mesmo `enforce-label-observed` não prova que o
perfil correto foi aplicado, que contém a regra `userns`, nem que
o sandbox Chromium está íntegro. Uma política pode estar ativa e
não corresponder ao executável autorizado. O piloto administrativo
necessita da revisão independente do perfil carregado e seu rollback.
Nenhum perfil é criado, carregado ou modificado por esta sonda.

Referência: documentação de diagnósticos AppArmor
https://apparmor-documentation-c38b15.gitlab.io/documentation/getting-started/troubleshooting/

## Testemunho de inicialização de processos curtos, sem falsa prova de execução

Os controles X11 agora registram o evento `spawn` de `child_process`
como um **booleano separado** da prova de identidade do executável via
`/proc/<pid>/cmdline`. Se o processo terminar com `SIGTRAP` antes de
ser possível ler sua linha de comando, o diagnóstico distinguirá:

- `spawn-event-only`: o sistema confirmou a criação do subprocesso,
  mas **não** confirmou qual imagem executável chegou a rodar;
- `proc-command-line-observed`: a identidade do processo foi confirmada
  pela leitura restrita de `/proc`;
- `not-observed`: nenhuma dessas evidências foi obtida.

Essas categorias são registradas em `autoStartupWitness` e
`directStartupWitness`. O marcador
`spawnEventProvesExecutedImage:false` é sempre falso: criar um filho
não comprova que o Electron chegou à inicialização do sandbox.

Assim, o resultado `shared-native-electron-startup-undetermined`
permanece **inconclusivo** quando falta prova da imagem, mesmo com
um evento de `spawn` e encerramento `SIGTRAP`.
Não é diagnóstico causal, não é perfil AppArmor, não altera nenhuma
política, nem dispensa o teste de janela Ubuntu 24.04.

## Retrato inicial do kernel dos processos principais (sem prova do renderizador)

No laboratório X11, quando a linha de comando do processo nativo já
foi identificada, fazemos uma leitura não privilegiada e de curta
duração de `/proc/<pid>/status` e `/proc/<pid>/attr/current`, antes
de procurar a janela X11. O resultado contém **somente categorias**:
`Seccomp` (`off`, `strict`, `filter`, `unknown`);
`NoNewPrivs` (`enabled`, `disabled`, `unknown`);
e modo do rótulo AppArmor, sem nome nem caminho privado.

Um processo que termina antes da leitura recebe categorias `unknown`
ou `unavailable`: ausência de observação não prova ausência de proteção.
Esta amostragem é do **processo principal logo no início**, não do
renderizador depois de inicializado. Também não identifica de maneira
independente a política carregada ou a identidade final do processo
durante toda a leitura. Por isso traz sempre
`fullElectronSandboxCertified:false` e
`processIdentityIndependentAttestation:false`.

A CI executa contratos sintéticos desse parser no build e nos dois
runners X11. Não há alteração de AppArmor, sysctl, sandbox ou privilégios.
O Ubuntu 24.04 continua bloqueante e sujeito ao piloto administrador.

## Artefato X11 V3: comparação persistente do estado inicial do processo principal

O relatório público sanitizado `AUTO_X11_HOST_EVIDENCE_V3` agora contém,
para cada etiqueta GNOME/KDE simulada no Xvfb, o retrato inicial
`earlyNativeKernel` do processo principal (apenas as categorias
`Seccomp`, `NoNewPrivs` e modo de rótulo AppArmor). Não publica PID,
nomes reais de perfis, argumentos ou conteúdo de `/proc`.

O parser canônico da comparação recusa registros falsificados, estados
contraditórios com a ausência de identidade de processo, rótulos privados,
campos de certificação positivos e hashes diferentes. O resultado
`AUTO_X11_CROSS_RUNNER_COMPARISON_V3` inclui
`earlyMainKernelComparison`:
- `matched-observed`: as **duas** etiquetas têm estados completos e iguais;
- `different-observed`: as **duas** etiquetas têm estados completos, com
  divergência em pelo menos um indicador;
- `insufficient-data`: alguma observação está ausente ou desconhecida.

Esse comparador **não interpreta o estado inicial do processo principal
como sandbox do renderizador** (`earlyMainKernelIsRendererProof:false`)
e não altera a classificação de causalidade AppArmor. A mesma compilação
Linux e o mesmo hash SHA-256 continuam obrigatórios nos dois runners.
O Ubuntu 24.04 continua bloqueante mesmo que as categorias coincidam.

## Comparação V4 por etiqueta X11: evidência parcial sem falso PASS

O resultado de comparação passa a
`AUTO_X11_CROSS_RUNNER_COMPARISON_V4`.
Além do resumo estrito `earlyMainKernelComparison`, agora emite
`earlyMainKernelByDesktop`, sempre na ordem `GNOME`, `KDE`,
com `comparison` limitado a
`matched-observed`, `different-observed` ou
`insufficient-data`.

Isso evita perder uma observação confirmada de um dos dois testes
Xvfb quando o processo do outro morre com `SIGTRAP` antes de ser
identificado. O **resumo global continua `insufficient-data`**
quando qualquer etiqueta tiver dados ausentes; nem uma igualdade
parcial nem uma diferença parcial alteram a classificação de causa,
a prova do sandbox ou o resultado bloqueante do Ubuntu 24.04.

Esses nomes GNOME/KDE são **etiquetas simuladas em Xvfb**, não testes
em compositores GNOME ou KDE reais. Nenhum PID, caminho ou perfil
AppArmor bruto entra no novo campo.

## Observação imediata em `spawn` para subprocessos Electron muito curtos

O teste X11 agora tenta ler imediatamente o `/proc/<pid>/cmdline` no
callback `spawn` (apenas no runner Linux descartável), antes das
consultas de janela X11. A prova de identidade exige o comando exato do
executável Electron com `--ozone-platform=x11`. Se o callback encontrar
o wrapper anterior ao `exec`, PID desaparecido ou parâmetro inesperado,
a observação é recusada, sem log bruto; o laço assíncrono antigo continua
tentando depois. Se o comando for verificado, a mesma amostragem
sanitizada de `Seccomp`, `NoNewPrivs` e AppArmor é feita antes da busca
por janela. Erros de leitura do kernel retornam `unknown` ou
`unavailable`, nunca estados positivos inventados.

Esta é uma mitigação de **corrida de observação**, não uma correção do
`SIGTRAP` nem prova de causalidade ou de sandbox. Um `spawn`
sozinho não identifica a imagem executada. Não há mudança de AppArmor,
configuração de kernel, privilégios ou flags de sandbox. A janela real
continua exigida nos dois rótulos Xvfb e Ubuntu 24.04 segue bloqueante.

## Origem da observação de identidade no X11

O teste registra `identityCaptureSource` como categoria fixa:
`spawn-callback`, `polling` ou `unobserved`. O callback só atribui
`spawn-callback` se a linha de comando for verificada; o laço atribui
`polling` somente após a mesma verificação. Se ambos observarem o
mesmo processo, prevalece a **primeira confirmação**. Isso distingue
a eficácia da sonda antecipada de uma observação posterior sem coletar
horário individual, PID, argumentos ou caminhos.

A origem vai para o log sanitizado de diagnóstico X11, sem alterar
a prova de janela, a classificação de causalidade, o artefato de
integridade ou o requisito de sandbox estrito. O evento `spawn`
sozinho continua sem valor probatório de identidade.

## Fonte de identidade em artefatos sanitizados, não apenas nos logs

A versão `AUTO_X11_HOST_EVIDENCE_V4` armazena
`identityCaptureSource` por etiqueta X11, nos valores fechados
`spawn-callback`, `polling` ou `unobserved`. Valores positivos
exigem identidade nativa observada e uma categoria `unobserved`
é incompatível com identidade confirmada. Isso registra a origem
da prova sem divulgar PIDs, nomes de perfis ou caminhos.

A comparação `AUTO_X11_CROSS_RUNNER_COMPARISON_V5` agora traz
`identityCaptureByDesktop`, com fontes de ambos os runners em
cada etiqueta simulada. O campo `identityCaptureSourceProvesSandbox`
continua sempre falso: fonte de observação não é prova de sandbox.
Ambos os rótulos GNOME/KDE são ambientes simulados Xvfb, não
sessões gráficas reais. A falha Ubuntu 24.04 permanece bloqueante.

## Evidência do controle direto separada do Auto (V5/V6)

A versão `AUTO_X11_HOST_EVIDENCE_V5` agora preserva a categoria
`directControlCategory`, derivada do controle Electron direto
quando o launcher Auto falha. Valores aceitos:
`not-run`, `unavailable`, `sigtrap-cmdline-spawn`,
`sigtrap-cmdline-polling`, `sigtrap-no-cmdline` e
`other-result`. Essas categorias distinguem a falha direta com
identidade verificada da ausência de observação, sem divulgar
PIDs, perfil, stderr ou argumentos privados.

A comparação `AUTO_X11_CROSS_RUNNER_COMPARISON_V6` inclui
`ubuntu24DirectControlByDesktop`. O campo invariável
`directControlProvesSandbox:false` evita confundir o controle
direto com certificação do Chromium ou aprovação da janela Auto.
`other-result` não significa sucesso; significa somente que
o controle não retornou as categorias SIGTRAP previstas.

A falha no Ubuntu 24.04 continua bloqueante. Não há alterações
nas políticas AppArmor, namespaces do host ou sandbox Electron.

## Entrega de revisão administrativa no CI (relatório V1, sem aprovação)

O job de comparação X11 gera, além de `host-comparison.json`,
um artefato separado `admin-handoff.json` sob o nome
`native-x11-administrator-handoff`. O gerador
`auto-x11-admin-handoff.mjs` consome somente a comparação
sanitizada V6, com validação de schemas, enums, hashes e
marcadores obrigatórios de **não certificação**. A saída registra:

- se a janela X11 no Ubuntu 24.04 continua bloqueada;
- qual etiqueta Xvfb tem dados de identidade insuficientes;
- se ambos os controles diretos apresentam `SIGTRAP` com identidade observada;
- o próximo passo de revisão independente em host descartável autorizado.

O relatório **nunca** declara versão pronta:
`fullReleaseAuthorized:false`, `rendererSandboxCertified:false`,
`apparmorCausalityProven:false` e `nativeCIWaived:false` são
invariantes. Evidência correlacionada não demonstra causalidade.
A exportação é somente leitura e não modifica sistema, AppArmor,
política global, permissões ou sandbox.
