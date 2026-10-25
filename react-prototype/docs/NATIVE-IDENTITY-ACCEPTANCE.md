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


## Handle da raiz durante a enumeração e barreira determinística Windows

O executável experimental `native-lab/Program.cs` agora abre e conserva um
`SafeFileHandle` para a **raiz da fixture** durante toda a operação e outro
para a subpasta `native-enum`. `FileIdInfo` e timestamps nativos são
comparados antes/depois, a raiz é reaberta pelo mesmo pathname e a validação
do marcador/nonce é repetida antes de entregar o JSON.

A suíte nativa `native-lab/native-executable.test.cjs` adicionou **8
cenários de dois processos** via barreira `READY`/`CONTINUE` sobre
pastas sintéticas. Alterações persistentes no marcador ou na subpasta devem
causar recusa genérica. Substituições de diretório com handle aberto só
contam como exercitadas se o Windows realmente permitir `rename`: caso
contrário os testes são ignorados com motivo explícito.

Esse contrato não implica autorização de acesso a diretórios reais,
prevenção geral de ABA/TOCTOU ou direitos de modificar mods e backups.


## Fixação da identidade do marcador temporário

O executável experimental mantém a referência nativa ao arquivo
`.omsi-test-fixture-marker` aberta desde o início da enumeração, junto
aos handles da raiz e de `native-enum`. Usa `CreateFileW` sem seguir
o componente final reparse, `FileIdInfo`, `FileBasicInfo` e leitura
de no máximo 33 bytes pelo handle. Reabre o pathname com novo handle
ao final para comparar a identidade e validar o nonce mesmo se um arquivo
alternativo tiver os mesmos 32 bytes. A nova suíte (30 testes) tenta
modificação do tamanho, troca com conteúdo idêntico e link no marcador,
com skip se o Windows proibir a ação necessária.

A política é **fail closed quando a divergência é observada**, mas
não certifica ausência de troca ABA transitória, nem protege recursos
de terceiros ou aprova acesso real a mods.


## Laboratório Windows: ancestrais do caminho TEMP

A revisão seguinte à identidade nativa do marcador introduz `AncestorPins`
no executável C# **isolado**. A cadeia lexical de diretórios que leva à
pasta temporária de processo é aberta do volume para o TEMP; cada
componente precisa ser diretório não-reparse, com identidade nativa disponível.
Handles originais são mantidos e as identidades revalidadas por pathname
antes de publicar a observação. Rejeita junctions em componentes intermediários,
inclusive quando o diretório TEMP final não é um link.

Testes Windows com TEMP substituído apenas no processo de laboratório
cobrem caminho aninhado comum, junction no TEMP, junction no ancestral
e tentativa de substituição durante a barreira de concorrência.
Sem evidência de substituição efetiva quando `rename` é negado pelo OS,
o cenário deve ser informado como ignorado, nunca como aprovado.

O caminho completo ainda não é percorrido atomicamente com handles
relativos de diretórios, portanto `atomicPathContainmentProven:false`
e `guaranteesNoABA:false` continuam obrigatórios. Nenhuma autorização
para mods reais, instalação, restauração ou exclusão é produzida.


## Abertura de componentes relativos ao handle pai (Windows, somente fixture)

Agora `AncestorPins` usa `NtOpenFile` com `RootDirectory` para abrir
componentes de TEMP sem reavaliar o caminho completo em cada etapa.
O marcador, a raiz da fixture e `native-enum` são abertos de forma
relativa a diretórios já fixados. As referências permanecem abertas,
e o resultado só é entregue depois de checagens de identidade tanto
relativas quanto por pathname. Um teste de junction falsificando a
própria raiz da fixture usa um destino com nonce idêntico e arquivo
`.scs` fictício, exigindo recusa sem leitura do conteúdo.

A utilização da API NT elimina parte da resolução ambígua de
componentes intermediários, mas não faz atestação transacional. Os
campos `atomicPathContainmentProven:false`,
`guaranteesNoABA:false`, `supportsRealGameInspection:false` e
`operationsEnabled:false` continuam obrigatórios. A revisão de
segurança, os testes físicos e a política de acesso a diretórios reais
permanecem etapas futuras independentes.


## Verificações ABA e conteúdo estritamente por handle

A última revisão remove a leitura `File.ReadAllText(markerPath)` da
validação por pathname. O marcador agora é lido **somente** através de
um handle nativo relativo ao diretório temporário sintético. Abre-se
o pathname separado apenas para conferir a identidade com `FileIdInfo`,
não para consumir bytes. Os handles do alvo e dos ancestrais continuam
fixados durante a enumeração.

Os testes de concorrência simulam dois casos transitórios: alteração e
restauração dos mesmos 32 bytes do nonce, e criação/remoção imediata de
um `.scs` inventado em `native-enum`. Em ambos os cenários, se houver
mudança observável, o helper pode recusar; mesmo se um ABA não deixar
sinais detectáveis nos checkpoints, a resposta é necessariamente
`observed-bounded-untrusted` e todas as permissões de escrita e inspeção
real permanecem negadas. **Esses casos não demonstram garantia de
ausência de ABA.**

Critério para elevar a confiança futuramente: especificar eventos
observáveis de alteração e perda de eventos, testar limites de
filesystem/concorrência e projetar política de recusa quando não for
possível demonstrar identidade atômica. Não usar apenas timestamps,
hash de conteúdo ou `FileIdInfo` como autenticação transacional.


## Ensaio de sinais de mudança Win32 em pastas sintéticas

O laboratório incorpora uma *barreira de alteração* independente,
usando `FindFirstChangeNotificationW` e `WaitForSingleObject`
para a raiz da fixture e `native-enum`. O evento fica armado sem
rearme; qualquer alteração estrutural observável (criação, remoção ou
renomeação de nome) bloqueia o relatório. O filtro não promete detectar
reescrita ou mutação de conteúdo em arquivos existentes. A
abertura do watcher por pathname é confrontada com o FileId do
handle de diretório retido, mas essa checagem **não estabelece
associação atômica entre o watcher e o handle**.

Testes determinísticos criam e removem entradas fictícias e
reescrevem/restauram o marcador durante a janela da barreira.
O marcador usa verificações independentes pelo handle nativo; o
watcher, por sua vez, só observa mudanças de nomes. É esperado negar
todas essas observações, mesmo quando os diretórios
voltam à aparência inicial. Notificações perdidas, registros não
suportados, temporização após a última consulta e modificações
externas à pasta observada continuam fora da cobertura comprovada.

Nenhuma notificação Win32, por si só, autoriza leitura de jogos
reais, modificação de mods ou operação de recuperação.
`observed-bounded-untrusted` é o máximo estado de sucesso
permitido nesta fase e o esquema de 21 campos permanece intacto.


## Probe Win32 opt-in com buffer limitado (`ReadDirectoryChangesW`)

O console C# isolado aceita `--rdcw-probe` ou
`--race-barrier --rdcw-probe` **somente** com nonce e diretório de teste
filho direto da TEMP de processo. A observação de eventos da raiz
e de `native-enum` é feita por `ReadDirectoryChangesW`
assíncrono, com um buffer de **4096 bytes** e `OVERLAPPED`
retido até cancelamento e término do I/O.

Toda conclusão de notificação, incluindo erro ou falha do buffer,
leva à **recusa genérica**, sem leitura, publicação nem parsing
dos nomes dos eventos. Nenhuma notificação é reconhecida/rearmada.
O código não promove observações a autorização e não modifica
conteúdo de jogos ou mods.

Critérios de ensaio: um diretório não alterado retorna apenas o
contrato existente de 21 chaves, sempre com operações proibidas;
eventos sintéticos de criação/exclusão, renomeação/restauração,
alteração estrutural na raiz, rajada de eventos, EOF e comandos
inesperados falham fechados. O caso de rajada não prova overflow
do buffer no Windows: seria preciso evidência adicional de driver,
volumes e condições de carga.

A origem do watcher ainda depende de um pathname confrontado com
um handle, não de contenção transacional. Mudanças pós-checkpoint,
perda de notificação, diferenças entre NTFS/ReFS/network shares e
desligamentos abruptos continuam fora das garantias comprovadas.
O laboratório e todas as opções de teste ficam excluídos do
pacote distribuído.


## Fase de limpeza segura de notificações OVERLAPPED

`GetOverlappedResult` confirma a conclusão de uma operação
`ReadDirectoryChangesW` em vez de inferi-la apenas da chamada
`CancelIoEx`. Evento sinalizado é tratado como invalidação
independentemente de quantidade de bytes ou código de erro.
O retorno `ERROR_IO_INCOMPLETE` após tentativa de cancelamento
bloqueia a liberação do buffer e do `OVERLAPPED`; os handles
também ficam retidos até a saída do processo de teste para evitar
uso de memória já desalocada.

Há um cenário de **cancelamento real no Windows** através do argumento
estritamente de teste `--rdcw-probe --test-cancel-pending-io`,
incluindo validação da recusa genérica e ausência de exposição de
nomes, nonce e caminhos. Esse cenário não comprova overflow real
nem entrega transacional dos eventos. O probe permanece limitado
a pasta temporária sintética, não distribuído no Electron e sem
habilitar instalação, remoção, recuperação ou inspeção de jogos.


## Atestação de cancelamento de I/O por status Win32 995

O modo sintético `--rdcw-probe --test-attest-cancel-995`
aprimora a evidência de testes de `CancelIoEx`. Depois de
iniciar `ReadDirectoryChangesW` com `OVERLAPPED`, ele
requer a sinalização do evento e o resultado específico de
`GetOverlappedResult` = **falha com 995
(`ERROR_OPERATION_ABORTED`)**. Só essa condição gera o
código de saída reservado **4**. Mensagem de recusa permanece
genérica e stdout vazio; qualquer caminho que não prove 995
recusa com código **3**. Nem código 4 nem 3 são permissões.

A CI Windows executa esse processo com nonce artificial,
repete a prova cinco vezes, compara os bytes do marcador e
de um arquivo `.scs` fictício sem modificá-los, e rejeita
pedidos sem a flag de laboratório ou com parâmetros extras.
Essa é evidência **direta de cancelamento**, não de perda de
eventos em NTFS, ReFS ou SMB, nem teste de overflow real de
notificações de diretório. A proteção contra ABA continua
parcial e não transacional; o componente não tem integração
com jogos reais nem com o Electron distribuído.


## Evidência de buffer Win32 insuficiente, sem confundir com overflow acumulado

Um modo de teste opt-in usa `ReadDirectoryChangesW` com buffer
de **64 bytes** para `native-enum`, mantendo 4 KiB no observador
convencional. Um processo de teste cria **um** nome fictício longo
depois da inscrição e só então libera a barreira `READY/CONTINUE`.

O diagnóstico exige prova nativa obtida por
`GetOverlappedResult`: erro **1022** significa notificação não
integralmente entregue (saída 5); sucesso com **zero bytes**
significa falta de detalhes no buffer (saída 6). A saída 3 indica
que esses sinais não foram comprovados; a suíte rejeita esse caso.
As três saídas permanecem recusas sem capacidades de escrita.
A CI exibe apenas a categoria do retorno, jamais nomes, caminhos
ou o nonce.

O experimento demonstra insuficiência em buffer pequeno. **Não
demostra, por si só, uma fila de eventos estourando sob carga**,
nem equivalência entre retorno zero e erro 1022. Não habilitar
inspeção real, nem concluir ausência de ABA/TOCTOU a partir desse
resultado. Testes de overflow acumulado e filesystems distintos
continuam pendentes.


**Evidência observada na CI Windows em 25/10/2026:** o ensaio de
buffer de 64 bytes retornou **conclusão com ZERO bytes de detalhes**
(saída 6), como registrado na linha de diagnóstico sanitizada do
runner. Isso comprova o retorno sem detalhes nessa execução, mas
**não** comprova que ocorreu o erro 1022 ou que uma fila acumulada
estourou. A distinção é obrigatória para não inflar garantias.


## Evidência de perda acumulada entre leituras (`ReadDirectoryChangesW`)

A fixture Windows dispõe de `--rdcw-probe
--test-queued-overflow`, que mantém um **mesmo handle Win32**
e buffer **4096 bytes** ao longo de uma sequência em duas fases:

- Primeiro, uma alteração sintética gera resposta
  `GetOverlappedResult` **com bytes maior que zero** e sinaliza
  `STORM_READY`, garantindo que aquela leitura terminou.
- Depois, durante **900 pares de renomeações** de um `.scs`
  **fictício**, não há nova chamada a `ReadDirectoryChangesW`.
  A próxima leitura, já com eventos acumulados, precisa
  sinalizar perda de detalhes: saída **7** quando o kernel
  devolve `ERROR_NOTIFY_ENUM_DIR=1022` ou **8**
  quando termina com **zero bytes**. A saída **3**
  invalida a prova.
- Um **controle negativo** de uma só renomeação e restauração
  exige saída **3**, pois uma fila pequena não deve parecer
  overflow. Todos os caminhos recusam com stderr genérico,
  sem conteúdo de nomes, e o arquivo original fica intacto.

**Observação de CI:** foi confirmada **saída 8** após a fila
de 900 pares, **não erro 1022**. O controle pequeno não
apresentou esse sinal. Isso reforça a caracterização de perda
por eventos acumulados no filesystem do runner testado;
não atesta NTFS, ReFS, SMB ou qualquer outro filesystem
específico. Tampouco demonstra ausência de alterações não
detectadas após o último checkpoint ou atomicidade de
pathname/handle. Os 21 campos de relatório e todas as
restrições de acesso real permanecem inalterados.
