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


## Substituição após fechar o handle e limitação ABA

O teste `temp-native-file-race.ps1` mantém o modo `held` (handle nativo aberto durante a tentativa de escrita), mas adiciona o modo `released`: captura inicialmente `FileIdInfo` e conteúdo do arquivo de teste e então libera o handle antes de emitir a barreira `READY`. O processo Node pode mover o arquivo inicial para outro nome, criar outro arquivo no pathname original e mandar `CONTINUE`. A sonda revalida o marcador e compara o ID/bytes do novo handle contra o snapshot anterior. Isso exercita **de fato** uma substituição que o Windows costuma bloquear enquanto o handle antigo permanece aberto.

A identidade conservada após fechamento não é uma capability ou bloqueio: a troca `ABA` é testada devolvendo o arquivo original ao pathname. Como o ID e os bytes podem voltar a coincidir, o resultado `observed-stable-untrusted` **não significa que o pathname esteve imutável**. `abaRuledOut:false` permanece fixo, assim como `nativeIdentityApprovedForRealMods:false`, `cleanupAllowed:false` e `operationsEnabled:false`.

Foram incorporados 7 cenários Windows-only, **107 testes no total**, sendo 68 gerais (Linux também) e 39 exclusivos Windows. Os 2 cenários antigos que tentam trocar um pathname com handle aberto ainda podem sofrer `skip`, sem invalidar o novo experimento separado. Nenhuma API real de modificar mods é adicionada.


## Ciclo de vida e revogação explícita de evidências do laboratório

A API `scripts/temp-evidence-lifecycle.cjs` fornece quatro operações **somente no laboratório Node**: abrir sessão temporária, registrar observação em handle de leitura, consultar um recibo de observação e encerrar a sessão. Os objetos de sessão/recibo são imutáveis e seus significados dependem exclusivamente de `WeakMap`, não de campos copiados, string de ID, PID ou conteúdo JSON. Recibos de outras sessões ou de outros processos são recusados.

Sessões possuem um estado interno `open`, `releasing`, `released` ou `revoked`. Uma nova observação invalida recibos anteriores da mesma sessão; `release` marca a revogação **sincronamente** antes do fechamento assíncrono do handle, bloqueando reutilização mesmo diante de leituras concorrentes. Se o conteúdo observado mudou, a checagem falhou ou o marcador foi adulterado, o estado vira `revoked` e não pode retornar para `open`. Se o arquivo original retornar ao mesmo caminho após uma troca ABA, somente uma sessão nova pode ser aberta, com recibos novos; recibos da sessão anterior continuam inutilizáveis.

**19 casos novos**, total alvo de **126 testes de laboratório**: 87 Node multiplataforma + 39 específicos de Windows. Eles não representam monitoramento contínuo real de pathname/volume, nem prova de ausência de ABA, nem autenticidade durável após reinício. Estados `latest-observation-untrusted` e `observed-stable-untrusted` identificam apenas uma **observação passada**, nunca a ausência de trocas entre amostras. Todos os retornos mantêm `observationIsAuthorization:false`, `continuityAcrossReleaseProven:false`, `abaRuledOut:false`, `canInstall:false`, `canRecover:false`, `operationsEnabled:false`.

A experiência não altera renderer, preload, IPC, empacotamento ou pastas dos jogos. Para um gerenciamento real seguro ainda seriam necessários handles de diretório, política de sessão nativa, tratamento de reparse/TOCTOU, auditoria de concorrência por filesystem, consentimento e transações recuperáveis independentes.


## Primeiro protótipo nativo de enumeração Windows por handle (somente fixture)

`scripts/temp-native-directory-enum.ps1` usa `CreateFileW` em um diretório filho fixo `native-enum` de uma pasta descartável, com flag `FILE_FLAG_OPEN_REPARSE_POINT`, exigência de diretório sem reparse, `GetFileInformationByHandleEx(FileIdInfo/FileBasicInfo)` e enumeração real `FileIdBothDirectoryRestartInfo(11)`/`FileIdBothDirectoryInfo(10)` **no mesmo handle**. Os registros `FILE_ID_BOTH_DIR_INFO` são percorridos com offsets e comprimentos estritos, layout C# validado, limite de menos de 128 entradas e 16 páginas, e contagem superficial de nomes sem leitura de arquivos. Um segundo handle no pathname compara FileId ao final.

**12 testes novos somente Windows**, integrados à suíte agregada de **138 testes de laboratório**: diretório vazio, estrutura rasa, sufixos, várias entradas, excesso de orçamento, marcador adulterado, pasta fora do escopo, alvo ausente ou do tipo arquivo, links/junctions quando possíveis e sentinela externa intacta. No Linux, são **87 aprováveis + 51 skips intencionais Windows-only**.

O retorno `nativeDirectoryHandleUsed:true` e `nativeDirectoryEnumerationByHandle:true` descreve apenas o que a fixture Windows observou. **`nativeIdentityAuthorizedForGameFolders:false`, `guaranteesNoABA:false`, `atomicPathContainmentProven:false`, `supportsRealGameInspection:false`, `canInstall:false`, `canRecover:false` e `operationsEnabled:false`** continuam fixos. Essa sonda permanece fora de Electron/IPC e do pacote distribuído. Ainda não é um adaptador de diretório por handle para o aplicativo real, tampouco demonstra que qualquer estado de disco está imutável entre duas leituras.

A primeira CI desta sonda revelou que uma fixture com 129 arquivos foi reportada com 128 entradas. A regra foi reforçada para **recusar o próprio limite de 128**, sem aceitar a contagem truncada como completa, e foi adicionado um teste de fronteira com exatamente 128 itens. Nenhuma operação real foi habilitada.


## Ponte de teste Node → Win32 por handle → executor somente leitura

A etapa cria `scripts/temp-main-native-directory-backend.cjs`, que não integra o pacote Electron ou o IPC. Essa ponte **consome uma única autorização local** e confere `checkedRoot` e a subpasta `native-enum`, ambos temporários e descartáveis, antes de chamar `temp-native-directory-enum.ps1` via `execFile` (sem shell, com timeout de 15 segundos e limite de saída de 4 KiB). A sonda abre o diretório artificial por handle nativo; a ponte valida **21 campos** da saída e reduz a evidência a quatro valores constantes, sem dados de caminhos, FileIds ou conteúdo.

A função resultante implementa, exclusivamente em teste, a assinatura `nativeProbe(selectedRoot,game)` esperada pelo executor `electron/inspection-executor.cjs`. O laboratório testa a integração com `createInspectionExecutor({requireNative:true,platform:'win32'})` e `createInspectionGrantGate`, inclusive com subprocesso Win32 real. Como o `main.cjs` de produção **não injeta a ponte**, a interface normal informa `nativeDirectoryEnumeration:'not-connected'`.

**22 testes novos**, abrangendo vínculo de pasta e jogo, consumo único, chamadas paralelas, marker inválido, reparse/junction, falha/sanitização de `stderr`, orçamento JSON, relatório falsificado, backend faltante, saída malformada e integração completa com grant e contador read-only. Meta agregada: **161 testes de laboratório** (105 gerais, 56 Windows-only), além de 62 Node segurança e 744 Playwright.

A prova **não transporta consentimento real de usuário**, não demonstra ausência de ABA/TOCTOU entre checkpoints, não abre diretórios de jogos, não habilita escrita e não autoriza recuperação. O próximo requisito para integração de produção será um backend nativo separado do laboratório, distribuição e autenticação auditadas, e testes de seleção/pasta reais sem vazamento de dados.


## Console nativo .NET 8 Windows x64 isolado da distribuição

`native-lab/OmsiNativeDirectoryLab.csproj` contém a primeira sonda C# nativa compilada como processo independente, sem `Add-Type` no PowerShell. O job `windows_native_lab` usa .NET 8, mantém o executável apenas no workspace da CI e executa seus testes sobre **fixtures descartáveis**. O programa aceita somente `--root` (filho imediato nomeado de `os.tmpdir()`) e `--nonce` (marcador 32 hex), e abre exclusivamente `native-enum` por handle. O relatório retorna somente as 21 chaves conservadoras compatíveis com `checkResult`, usando `FileIdInfo` e enumeração Win32 por handle, sem nomes de arquivo na saída.

A CI testa a recusa no limite de entradas, diretórios ausentes e reparse, nonce adverso, outras opções de CLI e integração pelo backend Node temporário e grant. **Não publica o binário** e proíbe a presença de `native-lab/` no aplicativo empacotado. Não existe validação Windows física pessoal ou backend integrado às pastas reais dos jogos. Não há novas operações de modificação.
