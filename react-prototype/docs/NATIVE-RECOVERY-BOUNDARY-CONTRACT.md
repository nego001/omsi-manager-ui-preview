# OMSI Manager | Contrato para futura recuperação nativa

> **Estado: contrato executável apenas com fixtures em memória, não implementação nativa.**
> O protótipo mantém todos os botões de instalação, remoção, edição e atualização desabilitados.
> Nenhum arquivo de OMSI 2/ETS2/ATS, ZIP, SCS ou backup particular é acessado.

## O que este contrato impede

O fluxo de recuperação não pode equiparar `"salvo"`, uma declaração JSON válida ou um resumo aparentemente íntegro à recuperação segura de um arquivo. Um futuro adaptador nativo deverá distinguir **identidade do recurso**, **durabilidade do registro**, **reanálise independente dos bytes** e **autorização específica da pessoa usuária**. Um único sinal não pode substituir os outros três. O escopo não inclui instalação de mods nesta etapa.

## Quatro gates independentes

| Gate | Evidência nativa que falta | Rejeição obrigatória |
| --- | --- | --- |
| Identidade do arquivo | Root permitido, handle nativo, identidade estável e verificação contra links/reparse/TOCTOU antes e após I/O | Arquivo trocado, link redirecionado, pasta fora de escopo, handle reciclado |
| Durabilidade do journal | Commit em área privada, ordenação de escrita, confirmação real no filesystem, falha tratada e recuperação após reinício | Só intenção de commit, rename não confirmado, gravação parcial, falta de garantia de flush |
| Reanálise dos bytes | Nova abertura sob escopo permitido, novos dados e execução completa de verificadores independentes | Resultado de cache, hash inventado, análise parcial ou análise de outra revisão |
| Consentimento específico | Ato explícito, ação/escopo identificados e limite temporal, somente depois de verificação independente | Consentimento antigo, genérico, implícito ou fora de contexto |

Uma eventual aprovação de diagnóstico **não autoriza instalação automaticamente**. Até existir um projeto de escrita e rollback homologado separadamente, o aplicativo deve continuar com operações desabilitadas.

## Fronteira de confiança proposta

1. **Renderer:** exibe prévias, alertas e decisões, mas não possui APIs genéricas de filesystem, shell, IPC ou instalação.
2. **Preload isolado:** deverá expor apenas métodos específicos e validados, nunca encaminhamento irrestrito de IPC.
3. **Processo nativo privilegiado:** deverá validar, por si só, escopo/usuário/versão/identidade do arquivo; jamais confiar em flags do renderer.
4. **Persistência privativa:** futuro journal deverá ter diretório próprio separado do jogo, versão de esquema, limites de tamanho, integridade autenticada e garantias de durabilidade definidas por plataforma. Nenhuma gravação será feita nos diretórios reais antes de homologação separada.
5. **Coordenador de recuperação:** deverá tratar processos e sessões concorrentes, impedir replay e invalidar toda prova quando o recurso mudar.
6. **Validador independente:** deverá reabrir arquivos sob autorização de leitura e comprovar as evidências necessárias sem aceitar resumos salvos como se fossem bytes atuais.
7. **Autorizador de operações:** uma área separada, inicialmente inexistente e bloqueada, exigiria permissões explícitas por operação e proteção contra reutilização. Não inferir permissão da aprovação dos gates anteriores.

## Regras fail-closed obrigatórias

- Um registro com propriedades extras, getters, versão não suportada, ordinais inconsistentes, campos de autorização forjados ou estrutura desconhecida é rejeitado.
- Mesmo um registro serializado impecável continua não autenticado até uma verificação nativa independente; nenhum token obtido de JSON concede acesso.
- Uma nova sessão, alteração de geração ou mutação da matriz invalida a revisão que já estava aberta.
- Um erro de `fsync`, I/O, espaço, corrupção, perda de handle, shutdown ou concorrência não deve produzir 'recuperado' nem 'instalável'.
- Retenção limitada não mascara perdas: histórico omitido precisa ser explicitado e impedir deduções de continuidade.
- Uma revisão no laboratório não retira a quarentena de um recurso físico. Somente um procedimento real auditável poderá definir o destino desse recurso.
- Relatórios de arquivo não carregam paths completos, hashes privados ou conteúdo sensível para o renderer; exposição e logging devem ser mínimos.

## Fixtures integradas nesta PR

`src/synthetic-native-recovery-boundary.ts` oferece uma análise **somente de alegações**. A estrutura aceita unicamente `schemaVersion:1`, `source:'synthetic-fixture'`, `capturedEpoch` numérico e os quatro estados `'declared'|'missing'`. O objeto deve ser plano, sem getters ou propriedades extras.

Uma alegação estruturalmente válida nunca é transformada em comprovação. Os resultados incluem `nativeFileIdentityVerified:false`, `nativeJournalDurabilityVerified:false`, `freshNativeByteAnalysisVerified:false`, `explicitNativeAuthorizationVerified:false`, `durableRecoveryProven:false` e `operationsEnabled:false` **em todos os caminhos**, inclusive os cenários com os quatro campos declarados.

A UI `SyntheticNativeRecoveryBoundaryPreview.tsx` utiliza apenas o mesmo incidente fictício já presente na aba Histórico e apresenta cenários controlados. Não cria arquivos, não consulta o Windows e não chama serviços.

## Critérios antes de qualquer código nativo

1. Revisar o modelo de ameaças: execução de processo concorrente, reparse points, privilégios insuficientes, volume desconectado, queda entre sync/rename, truncamento de journal, mutação entre conferência e uso.
2. Construir primeiro um adaptador de testes em **diretório temporário descartável**, com arquivos fabricados e sem endpoints de jogos reais.
3. Medir o comportamento de durabilidade nos filesystems Windows relevantes e formalizar que garantias são efetivamente possíveis; não supor que renomear um arquivo seja, sozinho, transação durável.
4. Fazer testes de falha injetada após cada etapa, reiniciando o processo de verdade, verificando identidade e conteúdo após o restart.
5. Demonstrar que rejeição, abortos e timeouts deixam o aplicativo em somente leitura, sem resíduos perigosos.
6. Revisar a superfície IPC e a política de logs antes de permitir seleção manual de recursos sob escopo controlado.
7. Homologar no Windows físico, sem privilégios de administrador, com fixture, hashes conferidos e inspeção de alterações no diretório temporário.
8. Requerer decisão explícita, revisão de segurança e PR independente antes de considerar qualquer função de escrita em mods reais.

**Esta PR é draft, não substitui o OMSI Manager original e não deve ser mesclada com a main sem homologação.**
