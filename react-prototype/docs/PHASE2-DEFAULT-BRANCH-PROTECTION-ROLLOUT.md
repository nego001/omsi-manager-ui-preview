# OMSI Manager | Fase 2 / M23 — Plano seguro de proteção da branch principal

**Branch de trabalho:** feat/github-default-branch-safety-rollout-v1  
**Base:** PR #26 (M22). **Somente proposta, Draft, sem merge.**

## Evidência real observada

O repositório usa a branch padrão **main**. No inventário inicial do
GitHub, a branch **main não estava marcada como protegida**. Também não
foi encontrado CODEOWNERS nos locais reconhecidos (.github/, raiz, docs/).
O M22 examinou a base imediata da PR #26, não a main: a constatação
anterior sobre essa branch empilhada não deve ser extrapolada para todas
as branches sem consulta própria.

Não foi possível confirmar todos os detalhes de proteções clássicas
pela consulta externa inicial. O **job M23** usa um token oficial
somente leitura para buscar dados atuais da main e consultar regras
ativas aplicáveis à branch, sem fingir que ausência de um ruleset
verifica todas as proteções possíveis.

## Plano em seis fases (todas manuais até decisão do responsável)

1. **Inventário atualizado:** conferir a branch padrão, o status de
   proteção, rulesets aplicáveis e CODEOWNERS no commit atual da main.
   O job M23 registra apenas categorias e contagens.
2. **Revisor realmente independente:** convidar e obter o aceite de
   alguém de confiança com permissão apropriada. Um proprietário sozinho
   não pode cumprir uma exigência de aprovação externa revisando o seu
   próprio PR. Não inventar logins nem configurar CODEOWNERS antes disso.
3. **Proposta de CODEOWNERS fora dos locais ativos:** revisar quais
   arquivos precisam de um responsável. Exemplo meramente ilustrativo
   para uma **futura** configuração, depois de confirmar um revisor:

       # EXEMPLO — não colocar em .github/CODEOWNERS sem revisor válido
       /react-prototype/  @REVISOR-INDEPENDENTE-CONFIRMADO
       /.github/workflows/  @REVISOR-INDEPENDENTE-CONFIRMADO
       /react-prototype/scripts/  @REVISOR-INDEPENDENTE-CONFIRMADO

   Esse marcador **não é uma conta verificada**. A revisão final deve
   checar precedência das regras, acesso do revisor, arquivos críticos
   e o funcionamento real do GitHub CODEOWNERS na branch de destino.
4. **Checagens obrigatórias candidatas:** inventariar os **nomes
   exatos** dos checks efetivamente executados nos PRs de main,
   seus eventos e estabilidade após o código chegar à branch principal.
   Não publicar nomes hipotéticos como status checks obrigatórios;
   não usar o simples nome de um job como prova de contexto correto.
5. **Sandbox Ubuntu 24.04:** resolver a falha de janela nativa X11
   em ambiente estrito, com evidências e revisão da issue #4.
   Não eliminar a etapa, mudar permissões do host, acrescentar
   continue-on-error, falsear um check ou marcar a falha como aprovada.
   Ativar uma regra de CI obrigatório enquanto esse job falha pode
   impedir todos os merges: programar a adoção somente após correção.
6. **Ativação manual, gradual e reversível:** somente com revisor
   confirmado, checks conhecidos e gates funcionando, testar regras
   em cenário de não bloqueio, verificar a possibilidade de reversão,
   e então permitir que o mantenedor habilite as regras de main pelo
   GitHub. Este projeto não executa essas mudanças automaticamente.
   Revisar também admins, bypasses, exigências de aprovações,
   force pushes, exclusões, permissões e rulesets organizacionais.

## M23: contrato técnico

O script controlled_default_branch_rollout.py (CI-only) consulta por
GET o repositório, sua branch padrão, os rulesets ativos e CODEOWNERS
fixados ao commit atual daquela branch. A saída contém apenas:

- Nome público da branch padrão;
- Contagens de regras ativas de PR, status e revisão CODEOWNERS;
- Indicador de proteção e categoria de presença do CODEOWNERS;
- Estado consultivo e IDs fixos das seis fases.

A saída mantém explicitamente:

- selectedRequiredCheckContexts: lista vazia;
- independentReviewerLoginProposed: false;
- reviewerIdentityVerified: false;
- proposedCodeownersActivated: false;
- requiredChecksConfigured: false;
- branchProtectionEnforcedByThisPlan: false;
- branchProtectionSatisfied: false;
- requiredStatusChecksSatisfied: false;
- codeownerApprovalSatisfied: false;
- mergeAllowed: false;
- ubuntu24StrictSandboxWaived: false;
- realModValidated: false;
- installationAuthorized: false.

Uma CI verde no M23 significa somente **inventário efetuado com
sucesso**, não aprovação de mudança, proteção ativa ou liberação.

## Limites de segurança

- Token restrito a contents:read e pull-requests:read.
- Checkouts GitHub sem persistência de credenciais.
- API REST oficial, HTTPS sem redirecionamentos (componente herdado M22).
- Erros de API, ref movida, dados malformados, CODEOWNERS inválido ou
  contagem fora dos limites geram recusa com texto fixo, sem vazar tokens.
- Nenhum CODEOWNERS é escrito em um dos locais ativos.
- Nenhum ruleset, branch protection, reviewer, PR ou merge é alterado.
- Nenhuma leitura de mods reais, pasta do OMSI, extração de arquivos,
  instalação, alteração de sandbox ou Biblioteca.
- A issue #4 Ubuntu 24.04 continua bloqueando homologação. PR Draft.

**Próxima decisão humana:** definir um revisor independente e concluir
a investigação Ubuntu 24.04 antes de habilitar proteções capazes de
bloquear merges.

Referências:
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
