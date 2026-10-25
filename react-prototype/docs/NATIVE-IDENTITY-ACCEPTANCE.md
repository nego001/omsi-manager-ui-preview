# OMSI Manager | Critérios para identidade nativa de processos e arquivos

**Estado:** arquitetura e ensaios exclusivos de teste. Nada desta etapa autoriza operações sobre mods ou pastas reais de jogos. O executável não inclui este laboratório, pois a pasta `scripts/` é excluída pelo empacotador.

## Objetivo

Evitar que uma autorização de leitura, um resultado de análise, um registro de journal ou um arquivo de reivindicação seja associado incorretamente a **outro processo, outro recurso ou outra geração**. Identificadores textuais e snapshots externos não são capacidades.

## Identidade de processo

Um PID pode ser reutilizado. Um par "PID + instante informado" pode ser falsificado ou tornar-se obsoleto. A leitura de um JSON não demonstra que um processo existe, tem autorização, abriu o recurso ou possui um lock.

Antes de qualquer recuperação nativa, o adaptador deverá:
1. Adquirir um **handle do SO** do processo relevante, apenas sob uma política explícita e privilégios mínimos, vinculando todas as consultas a esse mesmo handle. Não aceitar PID/horário fornecido pela interface como identidade.
2. No Windows, avaliar uso de `OpenProcess` com direitos mínimos e consultas por handle como `GetProcessId` e `GetProcessTimes`, sem concluir propriedade/segurança apenas desses campos. Para Linux, avaliar `pidfd` quando suportado, com política específica de plataforma.
3. Definir o que significa "processo terminou" e verificar os eventos de vida pelo próprio handle. Uma indicação de término **não permite excluir** arquivo órfão sem comprovação independente de identidade de recurso, ciclo da sessão e ausência de outros detentores.
4. Evitar enumeração global, sondagem de PIDs arbitrários ou obtenção de handles fora de um escopo autorizado; jamais enviar handles, caminhos privados ou tokens reais para o renderer.
5. Ter testes reais de corrida, reutilização de PID quando puder ser reproduzida com segurança, acesso negado, processo terminado entre consultas, reinicialização, detentor concorrente e tentativa de replay.

## Identidade de arquivo

Nomes, tamanhos, hashes e datas de modificação são atributos de observação, não prova suficiente de que dois acessos foram ao mesmo arquivo. Arquivos podem ser trocados, links redirecionados e o mesmo caminho recriado; os fenômenos TOCTOU e ABA precisam de tratamento nativo.

Um adaptador futuro deverá:
1. Trabalhar com diretório-base aberto sob escopo explícito e obter handle nativo de **leitura** antes da análise. Revalidar tipo, identidade do recurso e escopo no próprio handle, não somente por caminho.
2. No Windows, avaliar `CreateFileW` e `GetFileInformationByHandleEx(FileIdInfo)` (incluindo informação de volume) e uma política explícita contra reparse points e redirecionamentos. Os detalhes de compartilhamento e identidade em cada filesystem precisam de teste. Em Linux, avaliar `openat2` com resolução restrita e `fstat`.
3. Garantir que o conteúdo analisado seja o conteúdo realmente lido do handle autorizado e registrar revogação do parecer caso identidade, sessão ou bytes mudem. Comparar apenas SHA-256 não transforma a observação em atestado autenticado.
4. Definir limites de tamanho e tempo, proteção contra arquivos especiais e uma fronteira rigorosa entre diagnóstico de leitura e capacidade de modificação.
5. Testar substituição antes, durante e depois da abertura; links e reparse points; volumes alternativos; troca ABA; cópia idêntica em outro inode; metadados insuficientes; truncamento durante leitura; permissões negadas e handles antigos. Recusar quando faltar evidência.

## O que os testes de agora medem

`scripts/temp-recovery-identity.cjs` exercita operações reais do Node com **arquivos inventados e pequenos**, apenas no diretório temporário de testes: abertura de handle somente leitura, `lstat`, `FileHandle.stat`, leitura por posição com limite, detecção por SHA-256, fechamento e referência de subprocesso Node de teste via `ChildProcess`.

Os estados retornados são `observed-stable-untrusted`, `changed-or-unavailable` e `closed`. Mesmo quando a observação estável passa, o contrato fixa `nativeIdentityProven:false`, `atomicPathIdentityProven:false`, `durableDataProven:false`, `canRecover:false`, `canInstall:false` e `operationsEnabled:false`.

A referência de processo é emitida por `WeakMap`; cópias e relatos externos não substituem a referência ao subprocesso originalmente iniciado. Isso demonstra **vinculação em um harness Node**, não atestação nativa de processo de terceiros, nem proteção completa contra PID reciclado.

## Regras antes de liberar operações reais

- Nenhum laboratório isolado é executado por comando da UI nem fornecido como endpoint IPC.
- Uma implementação nativa deverá nascer numa PR independente, inicialmente **somente leitura**, com revisão de segurança e testes nos sistemas e filesystems suportados.
- A saída do adaptador não pode conceder, por si, autorização para instalar, atualizar, remover ou restaurar mods. Autorização, backup/rollback, persistência e operação efetiva exigem projetos e testes independentes.
- O programa deverá continuar conservador quando a identidade for incerta: relatar risco, não substituir o arquivo, não liberar journal e não apagar suposto órfão.
- Homologação física no Windows, assinaturas e liberação do instalador permanecem pendentes.

**A PR #1 continua DRAFT, sem merge.**


## Ensaio nativo Windows no laboratório temporário (não incorporado ao aplicativo)

`scripts/temp-native-file-id.ps1` chama `CreateFileW` (acesso `GENERIC_READ`, compartilhamento de leitura/escrita/exclusão e `FILE_FLAG_OPEN_REPARSE_POINT`) e `GetFileInformationByHandleEx(FileAttributeTagInfo/FileIdInfo)` por P/Invoke. Essa abordagem observa **volume serial e FileId de 128 bits por handle nativo do Windows**, sem depender apenas de PID, horário ou nome de arquivo. O conteúdo dos arquivos inventados é limitado a 4096 bytes; duas aberturas distintas produzem observações que são comparadas antes de retornar. A impressão digital enviada ao Node só vincula a sessão temporária às observações, sem conter caminho, FileId bruto ou bytes privados.

A PowerShell exige pasta temporária direta com prefixo de teste, verifica que ela não é um reparse point e exige o marcador aleatório antes de abrir o nome fixo `identity-target.bin`. O handle verifica o tipo de arquivo e rejeita atributos de reparse, diretório, arquivo vazio ou grande. Erros retornam apenas mensagem genérica.

São **10 testes novos exclusivamente de Windows**, integrados a `npm run test:recovery:fixture`, totalizando **78 cenários Node** em Windows e **68 cenários executados + 10 skips intencionais** em Linux. No Windows os testes exercitam uma troca entre observações; **não garantem resistência a substituições concorrentes exatamente durante a janela de abertura**.

A saída permite `nativeFileIdObserved:true`, pois um handle de teste realmente foi consultado. Isso **não** equivale a `identityAuthorizedForRealMods`, `atomicPathIdentityProven`, `directoryDurabilityProven` ou `operationsEnabled`, que continuam todos `false`. Implementação nativa de identidade de processos externos permanece pendente. Não é mecanismo instalado de leitura ou recuperação de arquivos reais.


## Ensaio de identidade nativa de processo Windows: subprocesso de teste, não serviço de produção

`scripts/temp-native-process-id.ps1` cria e controla um subprocesso que fica temporariamente dormindo. **Somente após iniciar esse subprocesso** o mesmo script chama `OpenProcess` com direitos mínimos de observação (`PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE`), conferindo `GetProcessId`, `GetProcessTimes` e `WaitForSingleObject` no **handle detido pelo teste**. Compara PID e data de criação da mesma referência, observa o estado vivo ou encerrado e libera o handle e o filho ao terminar, inclusive em erro.

Uma simulação local de PID diferente ou de horário de criação falsificado é rejeitada; nenhum valor de PID ou horário bruto sai no JSON do resultado. **Não houve reprodução real de reutilização de PID**, nem autorização para sondar processos externos ao laboratório. A checagem de horário não é considerada, isoladamente, identidade de processo autenticada de produção. A comprovação de propriedade de locks, o rastreio seguro de outros processos e a prevenção de TOCTOU hostil continuam pendentes.

**11 novos testes Windows**, total de **89 casos Node da suíte**, com 68 gerais e 21 Windows-only. Todos os testes de laboratório conservam `operationsEnabled:false`, `canInstall:false`, `canRecover:false` e `automaticCleanupAllowed:false`. A sonda não aceita PID arbitrário, não abre caminhos de jogos e não integra o executável. A aprovação da CI mede o laboratório, **não a prontidão para operações reais**.


## Concorrência Windows com dois processos e barreira no handle (laboratório)

`scripts/temp-native-file-race.ps1` mantém um handle aberto entre duas observações usando `CreateFileW`, `GetFileInformationByHandleEx(FileIdInfo)` e um protocolo de teste `READY`/`CONTINUE` via entrada e saída padrão, sem IPC do aplicativo. O teste Node executa tentativas confinadas ao arquivo artificial no mesmo diretório temporário. O segundo ciclo verifica o handle original e abre um **novo handle** para conferir a identidade do caminho. Comportamentos observáveis: `observed-stable-untrusted` ou `changed-or-unavailable`, sem estado "seguro para instalar".

Os **11 cenários novos** tentam alteração do mesmo tamanho, truncamento, crescimento, substituição por outro arquivo com bytes iguais, exclusão de pathname, adulteração de marcador, nonce e pasta inválidos, link simbólico, e encerramento do observador antes da segunda etapa. A disponibilidade de troca enquanto um handle está aberto depende das regras de compartilhamento e do filesystem Windows; **testes ignorados devem aparecer explicitamente nos logs**. O observador não modifica arquivos, e o processo de teste só escreve fixtures previamente criadas.

A execução agora tem **100 casos de laboratório no Windows** e **68 casos gerais + 32 skips Windows-only no Linux**. Nenhum desses experimentos demonstra atomicidade universal contra um atacante concorrente, ABA em todas as janelas, auditoria nativa de processo de terceiros ou segurança após pane elétrica. Nenhuma API de instalação, restauração, deleção real de mods ou journal de produção foi ativada.
