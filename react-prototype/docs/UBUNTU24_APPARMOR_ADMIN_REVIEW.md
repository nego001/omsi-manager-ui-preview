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
