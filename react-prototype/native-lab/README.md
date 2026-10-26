# OMSI Manager | Laboratório nativo C# independente (não distribuído)

**Status:** experimento isolado. A prévia Electron ainda utiliza o contador Node de
metadados por `lstat/opendir` e permanece sem recursos de instalação,
desinstalação ou recuperação real de mods.

## Compilação Windows em CI

O job `Windows standalone native directory lab (test-only)` instala .NET 8,
compila este projeto como um executável Windows x64 e executa
`node --test native-lab/native-executable.test.cjs` apontando a variável
`OMSI_NATIVE_LAB_EXE` para o binário recém-compilado. **Nenhum artefato**
desse executável é disponibilizado ao usuário ou adicionado ao aplicativo.

```powershell
dotnet publish native-lab/OmsiNativeDirectoryLab.csproj -c Release -r win-x64 --self-contained false -o native-lab/out
$env:OMSI_NATIVE_LAB_EXE = (Resolve-Path native-lab/out/OmsiNativeDirectoryLab.exe).Path
node --test native-lab/native-executable.test.cjs
```

As chamadas aceitas pelo executável são somente:

```powershell
native-lab/out/OmsiNativeDirectoryLab.exe --root "<diretorio-descartavel>" --nonce "<32_hex_minusculos>"
```

A raiz precisa ser uma **pasta filha direta de `os.tmpdir()`**, com nome
`omsi-manager-recovery-fixture-...` e arquivo
`.omsi-test-fixture-marker` contendo exatamente os 32 dígitos do nonce.
O alvo é sempre a subpasta fixa `native-enum`. Não existe parâmetro para
escolher uma pasta de jogo arbitrária, passar um PID, executar um comando,
abrir um pacote ou autorizar escrita.

O observador chama APIs Win32 diretamente: `CreateFileW` para abrir **um
handle de diretório**, `GetFileInformationByHandleEx(FileIdInfo,
FileAttributeTagInfo, FileBasicInfo)` e
`FileIdBothDirectoryRestartInfo/FileIdBothDirectoryInfo` para percorrer
registros nativos por esse handle. O limite é **menos de 128 entradas**,
com até 16 páginas. Retorna contagens rasas e candidatos de extensão
`.scs/.zip`, sem nomes ou bytes de arquivo; rejeita alterações
observáveis de identidade/timestamps, diretórios reparse e resultados
incompletos. O erro de saída é uma mensagem fixa que não expõe caminho,
nome ou identificador nativo.

Os testes incluem recusa de 128 e 129 entradas, nonce errado, raiz
fora do escopo, alvo ausente/arquivo/link, isolamento e a conexão de
prova com o backend Node temporário, o executor e o grant de uso único.

## Limites de confiança

- Este binário **não elimina automaticamente TOCTOU ou ABA**. A raiz
  e o marcador são validados por pathname; a identidade não é uma
  capacidade transacional com contenção total contra um atacante concorrente.
- Um diagnóstico por handle de **pasta artificial** não prova integridade
  de diretórios reais de jogos, nem conteúdo de mods ou compatibilidade.
- Os testes não simulam desligamentos elétricos ou recuperação de transações.
- O backend não é chamado pelo `main.cjs` ou pelo renderer. A interface
  normal continua a informar `nativeDirectoryEnumeration: 'not-connected'`.
- A configuração de empacotamento ignora `native-lab/` e `scripts/`.
  O smoke do executável portátil verifica que ambos estão ausentes de
  `app.asar`.

**Não distribuir o executável nativo de laboratório como gerenciador de mods.**

## Teste de concorrência com handles nativos preservados

O executável agora mantém **o handle da raiz fictícia aberto por toda a
observação**, além do handle da subpasta `native-enum`. Compara `FileIdInfo`
e atributos temporais da raiz no início/fim, abre novamente seu pathname e
revalida o marcador/nonce **depois** de enumerar. Uma raiz substituída ou
um marcador adulterado que permaneça alterado são recusados.

Um modo exclusivo de laboratório, `--race-barrier`, sinaliza `READY` pelo
STDOUT com os dois handles abertos e aceita **apenas** a linha `CONTINUE`
no STDIN, com prazo de 20 segundos. Isso permite ao segundo processo Node
alterar de forma determinística apenas a fixture em `os.tmpdir()`. O modo
comum, sem flag, mantém a resposta JSON original e não exige STDIN.

Foram adicionados **8 casos Windows**, elevando a suíte nativa de 17 para
**25 testes** (24 Windows + 1 Linux-only): observação estável após barreira,
marcador alterado/removido, nova entrada no diretório durante a observação,
comando inválido e EOF, tentativa de substituir a subpasta e tentativa de
substituir a raiz. Nos dois casos de `rename`, o teste registra `skip` se
o Windows proibir a mutação enquanto o handle estiver aberto; não há
contorno artificial de bloqueios do sistema.

**Garantia limitada:** os checkpoints reduzem resultados enganadores e
recusam mudanças observadas. Eles **não** impedem mudanças transitórias
entre verificações, ABA restaurado, acesso paralelo de terceiros ou corridas
com arquivos reparse; tampouco provam contenção transacional. O laboratório
permanece ausente de `app.asar` e sem permissão sobre mods reais.


## Marcador com identidade nativa preservada

O observador mantém agora **três handles Win32** durante a operação:
`root`, `native-enum` e o próprio arquivo
`.omsi-test-fixture-marker`. O arquivo marcador é aberto com
`FILE_FLAG_OPEN_REPARSE_POINT` e permissões **somente leitura de bytes e
atributos**; links/reparse points e diretórios são recusados. O handle do
marcador preserva `FileIdInfo` e `FileBasicInfo` iniciais.

O nonce de 32 caracteres é validado com leitura por offset do handle
(`RandomAccess.Read`) usando um buffer de 33 bytes. Esse byte extra detecta
marcadores com sufixo não autorizado. No fim, com o handle original ainda
aberto, são comparados o FileId e tempos do próprio handle, a leitura do nonce
e a identidade de um **segundo handle reaberto pelo pathname**. Um arquivo
substituído por outro com os mesmos bytes não recebe a identidade antiga
quando a troca é observável. Continua sem garantia geral contra ABA.

A suíte de **30 casos** inclui cinco testes novos: anexo de byte adicional,
truncamento, troca por outro arquivo com nonce idêntico, symlink no marcador
e recusa sem vazamento de campos privados. Renomeação impedida pelo Windows
recebe skip explícito, sem afirmar que a troca foi exercitada. O console
experimental continua **fora do pacote Electron**, sem qualquer operação
de modificação de mods, jogos ou backups.


## Cadeia nativa de diretórios TEMP (nova etapa)

A execução Windows fixa agora também **cada componente do caminho de TEMP**,
desde a raiz do volume até a pasta temporária configurada. Cada componente
é aberto com `CreateFileW` (somente leitura/listagem e atributos,
`FILE_FLAG_OPEN_REPARSE_POINT`), e componentes com `FILE_ATTRIBUTE_REPARSE_POINT`
são recusados. Os handles permanecem abertos até o fim da observação;
`FileIdInfo` é comparado tanto nos handles originais como nas aberturas
novas por caminho antes de emitir o JSON. Não se verifica `LastWriteTime`
dos ancestrais: outras tarefas do sistema podem criar arquivos irmãos em
TEMP sem comprometer a identidade do diretório.

O teste aceita uma cadeia TEMP comum, recusa junction como pasta TEMP e
recusa junction em um **diretório acima dela**. Outro caso tenta renomear
a pasta TEMP durante a barreira com handles vivos; se o Windows impedir
a operação, o teste registra `skip`, sem contar o ataque como exercitado.

**Limites:** são checkpoints de identidade, não travessia atômica relativa a
um handle raiz, prova geral de ausência de ABA ou permissão para inspecionar
pastas reais. Ambientes cujo TEMP usa junctions/reparse points podem ter
a observação experimental recusada por segurança. O contrato JSON
permanece com 21 campos, e todas as operações de escrita continuam desativadas.


## Abertura relativa por handle, sem confiar na resolução completa do pathname

A etapa seguinte usa `NtOpenFile` com `OBJECT_ATTRIBUTES.RootDirectory`
para abrir cada componente de TEMP a partir do **handle nativo do diretório pai**.
A raiz do volume é aberta inicialmente com `CreateFileW`; cada filho da
cadeia é aberto isoladamente. O próprio diretório da fixture, o arquivo
marcador e a subpasta fixa `native-enum` também são abertos relativamente
aos handles já preservados.

As opções `FILE_OPEN_REPARSE_POINT` e a verificação subsequente de atributos
recusam junctions e symlinks, incluindo folhas com conteúdo/marcador
aparentemente corretos. A abertura distingue arquivos de diretórios e
solicita apenas acesso de leitura/listagem/atributos. As identidades da
cadeia são confrontadas novamente tanto por handles relativos quanto
pela abertura independente dos pathnames. Os testes Windows mantêm
a barreira de concorrência e acrescentam a tentativa de falsificar o
próprio diretório de fixture com junction, nonce correto e pacote .scs
fictício em seu destino.

**Limites importantes:** a segunda abertura por pathname é apenas um
checkpoint de consistência, não uma autorização; a consulta e validação
legadas por caminho ainda existem como verificações suplementares.
A implementação não promete ausência geral de ABA, contenção atômica,
suporte a caminhos arbitrários nem resistência a adversários com
acesso para modificar componentes previamente inspecionados. O contrato
do JSON continua inalterado e nega explicitamente essas garantias.
Nenhum binário nativo é incorporado ao Electron.


## Experimentos ABA e eliminação de leitura de marcador por pathname

A validação nativa não usa mais `File.ReadAllText` e não aceita
`FileInfo/DirectoryInfo` sobre um pathname como evidência suficiente da
autorização. O nonce é lido exclusivamente de um `SafeFileHandle`
aberto por `NtOpenFile` relativo à raiz sintética já fixada. Uma
reabertura por pathname continua permitida **somente para comparar FileId**,
nunca para ler conteúdo de um caminho redirecionável. A enumeração de
`native-enum` já usa o handle filho relativo.

Novos ensaios Windows usam a barreira `READY/CONTINUE` para:
1. alterar o nonce, restaurar exatamente os 32 bytes originais antes de
   continuar e observar se os checkpoints de metadados detectam a mutação;
2. criar um arquivo `.scs` de teste em `native-enum` e removê-lo antes
   de continuar, simulando uma alteração temporária de diretório.

Esses testes **não afirmam que toda alteração ABA é detectada**.
Uma execução pode ser recusada se o sistema registrar a mudança em
`ChangeTime/LastWriteTime`, mas um resultado de observação continua
obrigatoriamente `observed-bounded-untrusted` e nega capacidade real
de instalação, recuperação ou exclusão, independentemente de detectar
a mutação. O laboratório usa apenas notificações temporárias de alterações em
pastas fictícias; não instala serviço persistente, não abre mods reais,
não concede autorização e não elimina ataques ABA.


## Laboratório Win32: barreira de notificações de alteração

O observador experimental registra agora `FindFirstChangeNotificationW`
para a raiz sintética autorizada e para `native-enum`, **antes** da
barreira `READY/CONTINUE`. Cada registro compara o pathname aberto
com a identidade do diretório fixado. Depois da enumeração e antes de
publicar o JSON, `WaitForSingleObject(...,0)` consulta se houve sinal.

A notificação é propositalmente **one-shot/sticky**: não é rearmada,
pois qualquer mudança observada invalida toda a inspeção.
O filtro observa **somente criação, remoção e renomeação de nomes de
arquivos e diretórios**. Filtros de conteúdo, atributos, tamanho e
última escrita foram excluídos após reproduzir falsos positivos de
metadados pendentes de fixtures recém-criadas. A integridade dos bytes
do marcador é conferida separadamente pelo handle nativo. Nenhum
nome de arquivo, caminho ou conteúdo de pacotes é retornado. Se a criação da notificação, a comparação de
identidades ou a leitura do evento falhar, o programa recusa o
relatório. A interface Electron permanece desligada deste laboratório.

Os testes Windows inserem mutações entre `READY` e `CONTINUE`:
reescrita/restauração do nonce (checagens próprias do marcador),
criação/remoção de um `.scs` fictício e criação/remoção de uma subpasta
fictícia (notificações estruturais). Todos precisam resultar em recusa. Um quarto cenário proíbe o vazamento de nomes
ou caminhos quando o evento invalida a observação.

**Limitação:** `FindFirstChangeNotificationW` é um evento do Win32,
não um journal durável nem `ReadDirectoryChangesW` com controle
de overflow. A associação ao pathname não é atômica, e notificações
podem ser perdidas, não disponibilizadas por certos filesystems
ou ocorrer depois do último checkpoint. Passar nos testes não prova
ausência geral de ABA. `guaranteesNoABA:false`,
`atomicPathContainmentProven:false` e
`operationsEnabled:false` continuam obrigatórios.


## Experimento isolado `ReadDirectoryChangesW` com I/O sobreposto

Foi adicionado **somente no executável C# de laboratório** o modo
`--rdcw-probe`, opcional e limitado a fixtures artificiais. Com
`--race-barrier --rdcw-probe`, os dois observadores são armados
**antes** do protocolo `READY/CONTINUE`. Sem essa opção, a observação
existente continua usando os dois sinais `FindFirstChangeNotificationW`.

- Cada observador abre um handle de diretório `FILE_FLAG_OVERLAPPED`,
  consulta `FileIdInfo` e rejeita um alvo reparse ou com identidade
  diferente do diretório nativo previamente fixado.
- É registrada exatamente **uma** leitura assíncrona
  `ReadDirectoryChangesW`, apenas para criação/remoção/renomeação de
  nomes, sem acompanhar subpastas recursivamente. O buffer é
  intencionalmente limitado a **4 KiB**, em memória não gerenciada.
- O programa não analisa nem emite nomes do buffer. Qualquer
  conclusão/sinal, retorno inesperado ou operação não suportada
  invalida a observação. Não há rearme nem caminho de autorização.
- O término solicita `CancelIoEx` e espera no máximo dois segundos
  pela conclusão sinalizada, antes de liberar buffer/OVERLAPPED.
  Se não puder confirmar que o kernel terminou, o processo mantém
  intencionalmente os pequenos buffers alocados até sair em vez de
  arriscar desalocação com I/O pendente.

Testes de laboratório abrangem pasta quieta, barreira quieta,
criação/remoção ABA, renomeação/restauração, alterações estruturais
na raiz, rajada de **96 pares** de criações/remoções, EOF e
comando inválido. A rajada exige **recusa**, mas não demonstra
que o filesystem gerou ou notificou overflow real. Não existe
`ReadDirectoryChangesW` no aplicativo Electron distribuído.

**Garantias proibidas:** o watcher é associado a um pathname,
não atomicamente ao handle; pode haver notificações perdidas,
limitações de filesystem, eventos anteriores à inscrição e
eventos posteriores ao último checkpoint. Nem `FindFirstChangeNotificationW`
nem `ReadDirectoryChangesW` são um journal durável. O relatório
continua `observed-bounded-untrusted`; os campos
`guaranteesNoABA:false`, `atomicPathContainmentProven:false`,
`supportsRealGameInspection:false` e `operationsEnabled:false`
continuam obrigatórios.


## Confirmação de término do I/O assíncrono antes de liberar memória

O laboratório Win32 ganhou verificação explícita do estado da
operação `OVERLAPPED` através de `GetOverlappedResult`, sem nunca
interpretar nomes do buffer. Qualquer conclusão observada por
`WaitForSingleObject` leva à recusa; isso inclui resultado normal,
`ERROR_NOTIFY_ENUM_DIR` (1022), `ERROR_MORE_DATA` (234),
`ERROR_OPERATION_ABORTED` (995), retorno de zero bytes ou outro erro.
Não se afirma que a CI tenha reproduzido os códigos 1022 e 234
emitidos por um filesystem real.

Na limpeza, `CancelIoEx` solicita a interrupção e uma espera de até
2 segundos verifica o evento de conclusão. Somente após essa
verificação e uma consulta a `GetOverlappedResult` o código libera
o buffer de 4096 bytes, o `OVERLAPPED` e os handles. Se o kernel
ainda declarar `ERROR_IO_INCOMPLETE` ou o evento não concluir no
prazo, os recursos e os handles permanecem referenciados até o
término do processo sintético, evitando liberar memória usada por
I/O pendente. Essa retenção intencional é aceitável apenas no helper
descartável, não em um serviço persistente.

O comando estritamente de teste `--rdcw-probe
--test-cancel-pending-io` pede um **cancelamento real no kernel**
de um watcher armado, verifica a recusa e mantém o contrato genérico
sem nomes ou paths. Ele não é um teste de overflow e não habilita
operações reais. Flags extras ou esse comando sem `--rdcw-probe`
são recusados.

Ainda faltam ensaios de erro `ERROR_NOTIFY_ENUM_DIR` produzido
realmente pelo filesystem, estresse de buffer com comprovação do
estado de conclusão, volumes de rede/NTFS/ReFS e verificação física
do executável no PC pessoal. Nenhuma dessas lacunas autoriza leitura
ou escrita de mods reais.


## Evidência de status 995 no kernel (25/10/2026)

Um diagnóstico estritamente de teste foi acrescentado:
`--rdcw-probe --test-attest-cancel-995`. Ele só aceita uma pasta
sintética marcada dentro da TEMP do processo, arma um
`ReadDirectoryChangesW` assíncrono, pede `CancelIoEx` e
**confere `GetOverlappedResult` com a operação exata** depois
de receber o evento de conclusão.

Somente o código nativo `ERROR_OPERATION_ABORTED` (**995**),
recebido com retorno de falha da consulta de conclusão, produz o
código de saída **4**, reservado à atestação sintética. Outros
resultados, incluindo expiração da espera, retorno de sucesso e
erro diverso, continuam recusados com saída **3**. A mensagem
de erro permanece idêntica e genérica, sem nonce, caminho,
nome de arquivo ou conteúdo; stdout é vazio em ambos os casos.
O novo sinal não é retorno de sucesso, nem uma autorização.

Uma suíte Windows cria apenas fixtures descartáveis, valida a
atestação de 995 e a repete cinco vezes preservando o marcador
e os bytes de um `.scs` artificial. A CI nativa aprovou esses
testes. O evento 995 é **cancelamento real da I/O pendente**,
não `ERROR_NOTIFY_ENUM_DIR` (**1022**) e não uma prova de
overflow do buffer. Também não confirma que todas as
alterações futuras do filesystem serão notificadas.

Referências oficiais da API:
- https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw
- https://learn.microsoft.com/en-us/windows/win32/api/ioapiset/nf-ioapiset-cancelioex

O laboratório não é distribuído no Electron; contrato positivo
segue com 21 chaves e `guaranteesNoABA:false`,
`atomicPathContainmentProven:false`,
`supportsRealGameInspection:false` e
`operationsEnabled:false`.


## Win32: ensaio de buffer insuficiente com evidência do sistema operacional

O helper de laboratório oferece o modo estritamente sintético
`--rdcw-probe --test-small-buffer-loss`: somente neste teste, a
subpasta `native-enum` é observada por `ReadDirectoryChangesW`
assíncrono com buffer de **64 bytes** (o modo normal permanece em
**4096 bytes**). O processo imprime apenas a palavra `READY` e
recebe `CONTINUE` depois que o teste externo cria um **único arquivo
fictício** com nome longo, que não cabe em uma estrutura completa
`FILE_NOTIFY_INFORMATION` de 64 bytes.

A consulta real de `GetOverlappedResult` distingue:

- Saída **5**: falha nativa `ERROR_NOTIFY_ENUM_DIR` (**1022**),
  indicativa de notificações não integralmente entregues.
- Saída **6**: conclusão nativa bem-sucedida, mas com **zero bytes**
  de detalhes; a documentação do Windows trata esse resultado como
  insuficiência de buffer/informação, sem provar sozinho qual evento
  interno ocorreu.
- Saída **3**: nenhuma das evidências foi demonstrada, ou ocorreu
  outro problema; o teste que exige evidência deve falhar, sem
  declarar overflow comprovado.

**Nenhuma dessas saídas é sucesso nem permissão.** O stderr contém
somente a recusa genérica; stdout contém apenas `READY`, sem nomes,
paths ou bytes de arquivos. Os testes Windows exigem 5 ou 6, relatam
em diagnóstico apenas a classe observada, verificam a integridade
do arquivo fictício e rejeitam flags de operação inesperadas.

**A diferença importa:** nome maior que um buffer minúsculo
demonstra insuficiência de espaço para os detalhes da notificação,
não necessariamente overflow por fila de milhares de alterações.
A prova independente de overflow *acumulado* com perda de
notificações, em NTFS/ReFS/SMB, permanece aberta. Não é um journal,
não garante entrega completa e não atesta proteção universal ABA.
O diagnóstico não lê jogos, mods, perfis ou backups reais.


**Evidência observada na CI Windows em 25/10/2026:** o ensaio de
buffer de 64 bytes retornou **conclusão com ZERO bytes de detalhes**
(saída 6), como registrado na linha de diagnóstico sanitizada do
runner. Isso comprova o retorno sem detalhes nessa execução, mas
**não** comprova que ocorreu o erro 1022 ou que uma fila acumulada
estourou. A distinção é obrigatória para não inflar garantias.


## Ensaio de overflow **acumulado** de notificações Win32

Foi adicionado um segundo diagnóstico estritamente descartável:
`--rdcw-probe --test-queued-overflow`. Ao contrário do ensaio
anterior com um único nome maior que 64 bytes, aqui o tamanho do
buffer do `ReadDirectoryChangesW` é o **normal de 4096 bytes**.

O protocolo é deliberadamente dividido em dois checkpoints:

1. O processo filho arma a leitura `OVERLAPPED` e envia `READY`.
   A fixture gera um único arquivo fictício e responde
   `TRIGGER_DONE`. O filho **exige que a primeira leitura termine
   normalmente com mais de zero bytes** e só então publica
   `STORM_READY`.
2. O observador **não rearma** essa leitura durante 900 ciclos de
   renomeação de um `.scs` fictício (ida e volta, sem trocar
   conteúdo). Ao receber `STORM_DONE`, rearma
   `ReadDirectoryChangesW` no **mesmo handle de diretório**,
   consulta `GetOverlappedResult` e recusa a operação.

Os códigos de saída são somente testemunhos de teste: **7**
indica `ERROR_NOTIFY_ENUM_DIR (1022)`; **8** indica uma
**conclusão bem-sucedida com zero bytes de detalhes**, após uma
primeira leitura comprovadamente normal e uma fila grande de
renomeações; **3** significa que nenhum desses sinais foi
comprovado. Todos devolvem a mesma recusa genérica, sem nomes,
nonce ou caminhos, e **nenhum é autorização**.

A CI Windows **observou o código 8, não o 7** no cenário de
900 ciclos. Um controle negativo faz apenas **um ciclo de
renomeação e exige saída 3**, de modo que uma leitura comum
com poucos eventos não seja classificada erroneamente como
overflow. A suíte conserva a verificação do arquivo fictício
intacto e dos 21 campos do contrato do modo normal.

Essa é evidência de **perda de detalhes após eventos acumulados
entre duas leituras no mesmo handle**, nas condições do runner
Windows testado. Não se identificou nem testou separadamente o
tipo de volume (NTFS/ReFS/SMB), e não se provou a entrega
completa de eventos nos demais sistemas de arquivos. O
watcher experimental ainda é aberto por pathname e não elimina
todas as corridas/ABA. A API não fornece garantia de
journal durável. Conforme a Microsoft, quando há buffer
insuficiente para todas as mudanças, uma leitura pode concluir
com zero bytes, exigindo reconciliação por enumeração.

Documentação oficial:
https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw

**Sem impacto em produção:** o código só roda no helper C#
isolado, fora de Electron e sem acesso a jogos, mods e backups
reais; `observed-bounded-untrusted`,
`guaranteesNoABA:false`, `atomicPathContainmentProven:false`,
`supportsRealGameInspection:false` e
`operationsEnabled:false` são preservados.


## Classificação do volume fixado e reenumeração após perda (25/10/2026)

O diagnóstico isolado `--rdcw-probe --test-queued-overflow`
passou a identificar a **família do sistema de arquivos** a
partir do mesmo handle Win32 fixado, usando
`GetVolumeInformationByHandleW`. Somente uma das quatro
categorias `NTFS`, `ReFS`, `Other` ou `Unavailable` é
emitida como `VOLUME_KIND=...` entre os sinais `READY` e
`STORM_READY`. Não são consultados ou publicados número
de série, rótulo do volume, letra de unidade, UNC nem
nomes de sistemas de arquivos desconhecidos. A API pode
não estar disponível em compartilhamentos de rede: nesses
casos a categoria é `Unavailable`, sem inventar um tipo.

**Evidência da CI Windows:** o runner reportou **NTFS** pelo
handle associado à pasta temporária sintética. Isso
identifica o sistema dos testes executados, **não** comprova
equivalência ou cobertura em ReFS, SMB ou outros volumes.

Quando o segundo `GetOverlappedResult` comprova perda
de detalhes após 900 ciclos de renomeações, o laboratório
executa uma **reenumeração limitada e somente leitura** por
handles relativos com `Inspect`, para obter um *snapshot*
das duas entradas sintéticas esperadas. Também confere
novamente identidades de diretórios, nonce do marcador
através do handle retido e os ancestrais temporários.
Somente depois dessas verificações emite `SCAN_ONLY`,
**nunca** o contrato JSON de 21 campos, e mantém
obrigatoriamente o encerramento com recusa, código 7 ou 8.
Se a reenumeração estiver incompleta, exceder limites ou
divergir da fixture, encerra com recusa genérica 3,
sem `SCAN_ONLY`.

O controle negativo com poucas renomeações recusa com
código 3 e **não** emite `SCAN_ONLY`, porque não houve
comprovação de perda a reconciliar. Uma reenumeração
de arquivos atuais **não** recupera histórico de eventos,
não exclui ataques ABA e não constitui autorização para
inspecionar pastas reais. A associação do monitor ao
pathname permanece sem garantia transacional.
`guaranteesNoABA:false`, `atomicPathContainmentProven:false`,
`supportsRealGameInspection:false` e
`operationsEnabled:false` permanecem inalterados.

Referências de API:
https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-getvolumeinformationbyhandlew
https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-readdirectorychangesw


## Ensaios de divergência na reenumeração após perda de notificações

O caminho estritamente de laboratório `--rdcw-probe --test-queued-overflow`
passou a coletar, **em memória e sem emitir nomes**, duas fotografias
limitadas de `native-enum`: uma depois da primeira leitura válida
`ReadDirectoryChangesW` e outra após a segunda leitura demonstrar
perda de detalhes no buffer de 4096 bytes.

Além de comparar as cinco contagens (total, diretórios, arquivos,
links e candidatos a pacote), o helper compara os **nomes completos
ordenados com comparação ordinal**, obtidos pela enumeração de diretório
com handles nativos fixados. Assim, trocar um `.scs` por outro com
a mesma extensão e a mesma quantidade de arquivos **não** produz
`SCAN_ONLY`. Nenhum nome sai em stdout/stderr nem entra no JSON
normal. Nenhum arquivo `.scs` é lido pelo helper.

A suíte Windows executa 900 ciclos de renomeação de um pacote
**fictício** enquanto a leitura está desarmada e depois injeta quatro
divergências entre a linha de base e o snapshot final: acrescentar um
`.zip` inesperado, remover o `.scs` esperado, substituí-lo por um
nome diferente **sem mudar as contagens** e adulterar os 32 bytes
do marcador artificial. Os quatro cenários devem recusar com saída
**3**, sem `SCAN_ONLY`, sem contrato de sucesso e sem revelar caminhos
ou nonces. A versão com pastas inalteradas, por contraste, preserva
`SCAN_ONLY` seguido da **recusa** com código 7 ou 8 quando o kernel
efetivamente comprova perda de informações.

**Limitações:** comparar nomes e contagens não equivale a provar a
identidade de cada arquivo no decorrer do tempo. Uma sequência ABA
que termina nos mesmos nomes e contagens pode continuar invisível,
e as informações históricas dos eventos perdidos não podem ser
recriadas pela nova enumeração. Não se autoriza recuperar, instalar
ou excluir dados reais. Os campos
`guaranteesNoABA:false`, `atomicPathContainmentProven:false`,
`supportsRealGameInspection:false` e
`operationsEnabled:false` permanecem obrigatórios.


## Identidade nativa dos filhos entre snapshots (25/10/2026)

O caminho opt-in estritamente sintético de perda acumulada foi
endurecido: além de contagens e nomes, a enumeração `Inspect` pode
obter `FILE_ID_INFO` individual de **cada arquivo fictício**.
O handle do arquivo é aberto por `NtOpenFile` **relativamente ao
diretório já fixado**, com `FILE_READ_ATTRIBUTES` e
`SYNCHRONIZE`, sem `FILE_READ_DATA`. O identificador completo
de 128 bits e o identificador de volume ficam exclusivamente na
memória do processo; nenhum é incluído em JSON, stdout ou stderr.

A comparação entre a linha de base e o snapshot posterior à perda
de notificações exige agora **contagens, nomes ordenados e FileId
de cada entrada iguais**. Entradas reparse/diretórios inesperados,
duplicidades, problemas ao obter metadados e divergências são
recusados. Uma divergência comprovada especificamente no FileId
de um nome ainda igual gera **código de saída de teste 9**,
sempre com a mesma mensagem genérica de recusa, sem `SCAN_ONLY`
nem JSON de sucesso. Outros tipos de divergência continuam
recusados com código 3.

O cenário Windows executa 900 ciclos de renomeação de um `.scs`
**totalmente fictício**, guarda a identidade inicial, renomeia
o arquivo antigo temporariamente, cria outro com **exatamente o
mesmo nome e os mesmos bytes**, remove o antigo e consulta o
snapshot posterior. Isso garante que o segundo arquivo existiu
simultaneamente ao primeiro sob outro nome durante a troca;
a suíte exige **recusa 9**, não apenas alguma recusa incidental.
Foram adicionados testes de verificação dos acessos metadata-only,
da comparação de IDs e do código de recusa exclusivo.

**Restrições:** comparar FileId melhora a detecção de substituição
entre os dois instantes, mas não garante ausência de ABA entre
checkpoints, não prova que o caminho e o handle estejam associados
atomicamente e não recupera a cronologia dos eventos perdidos.
Ainda não existe prova para todas as peculiaridades ReFS/SMB
ou identidade persistente em todos os tipos de filesystem.
`guaranteesNoABA:false`, `atomicPathContainmentProven:false`,
`supportsRealGameInspection:false`, `operationsEnabled:false`
permanecem. O helper não integra o Electron distribuído e não
inspeciona arquivos de jogos reais.


## Metadados nativos como testemunhos limitados de ABA em conteúdo (25/10/2026)

O modo **estritamente sintético** `--rdcw-probe
--test-inplace-aba` requer um `metadata-probe.scs`
fictício na pasta TEMP previamente autenticada com nonce.
O helper abre o filho por `NtOpenFile` relativo ao diretório
fixado usando somente `FILE_READ_ATTRIBUTES` e
`SYNCHRONIZE`, **sem `FILE_READ_DATA`**. Guarda o
`FILE_ID_INFO` e os atributos básicos retornados por
`GetFileInformationByHandleEx` (`FileBasicInfo`) antes
da barreira `READY/CONTINUE`; reabre o mesmo nome e
consulta o handle retido depois. Não lê bytes do `.scs`,
não expõe caminho, conteúdo, ID ou datas.

O teste externo cria o arquivo fictício e regrava seus
bytes temporariamente, depois restaura o conteúdo original.
Se o `FileId` mudou, o laboratório **recusa com 9**;
se a identidade é a mesma mas pelo menos um entre
`CreationTime`, `LastWriteTime`, `ChangeTime`
ou os atributos mudou, **recusa com 10**.
Um controle sem mutação **recusa com 3**, sem inventar
testemunho de modificação. Nunca há autorização,
`SCAN_ONLY` nem JSON de sucesso nessa modalidade.

Há um segundo ensaio, com data de última escrita
estabelecida de antemão e restaurada após regravação de
bytes. Se o `FileId`, `CreationTime`,
`LastWriteTime` e atributos continuam iguais
mas **`ChangeTime` é diferente**, o helper devolve
**recusa com código 11**. O runner Windows da CI,
identificado previamente como NTFS, **observou o código
11** nesse teste. Este é um testemunho do comportamento
da API nativa na fixture testada; não demonstra leitura de
conteúdo pelo helper nem detecção universal de alterações.

**Limitações obrigatórias:** os sinais são metadados de
checkpoints, não registros duráveis de todas as alterações.
Algumas operações podem não alterar os campos conferidos;
os tempos podem ser restaurados e sistemas ReFS/SMB
podem se comportar diferentemente. Os ensaios de conteúdo
são independentes do experimento de overflow acumulado:
renomear o próprio arquivo 900 vezes também modificaria
metadados e impediria atribuir a mudança apenas à
regravação de bytes. Portanto, **não se declara defesa
ABA garantida**, nem associação transacional de handle
e pathname. Os 21 campos normais continuam com
`guaranteesNoABA:false`, `atomicPathContainmentProven:false`,
`supportsRealGameInspection:false` e
`operationsEnabled:false`.


## USN atual por arquivo, sem percorrer o diário NTFS (25/10/2026)

Um diagnóstico adicional, **exclusivamente sintético**, aceita
`--rdcw-probe --test-usn-checkpoint` somente em fixture direta
de TEMP autenticada por nonce. A consulta usa
`DeviceIoControl(FSCTL_READ_FILE_USN_DATA)` no handle do
`metadata-probe.scs`, aberto **relativamente ao diretório
fixado, com acesso apenas a atributos**. Não abre o volume
`\\.\X:`, não usa `FSCTL_READ_USN_JOURNAL`,
`FSCTL_ENUM_USN_DATA` nem cria/modifica o journal.
A leitura é de um único registro corrente do arquivo,
validado para `USN_RECORD_V2` ou `USN_RECORD_V3`;
somente o número USN é interpretado, sem expor nome,
metadados identificáveis ou bytes de arquivo.

Em Windows/NTFS, o runner cria um arquivo fictício e
registra seu USN e FileId; outro processo regrava o
conteúdo com bytes temporários e restaura o conteúdo
original e `LastWriteTime`; a segunda consulta, no
**mesmo handle**, confirma que o USN **aumentou**
apesar da restauração. Somente essa condição produz
**código 12**, que ainda é **RECUSA**, com stderr
genérico e stdout restrito a `READY`. Um controle
sem alterações recusa com **3** e substituição por
outro FileId recusa com **9**. Na primeira CI nativa
Windows dessa implementação, os cinco testes USN
passaram, e a suíte teve 82 casos: 79 aprovados,
3 ignorados, zero falhas.

Se o journal estiver desativado/indisponível, o retorno
for inesperado, o volume não for NTFS ou a leitura
falhar, o helper recusa, **sem** assumir que o
filesystem é seguro ou que o número USN é confiável.
Não há tentativa de habilitar/criar o journal.
A leitura do último USN é **mais um sinal de alteração
entre checkpoints**, não uma cronologia completa,
nem prova de ausência de eventos ocultos. O experimento
**não restaura ChangeTime** para demonstrar
independência de todos os atributos modificáveis.
O journal também pode ser truncado/recriado e
ReFS/SMB não foram validados. Não foi estabelecida
garantia universal anti-ABA ou TOCTOU.
`guaranteesNoABA:false`,
`atomicPathContainmentProven:false`,
`supportsRealGameInspection:false`,
`operationsEnabled:false` permanecem.

API oficial:
https://learn.microsoft.com/en-us/windows/win32/api/winioctl/ni-winioctl-fsctl_read_file_usn_data


## Experimento de restauração dos quatro timestamps + USN (25/10/2026)

Foi incluído um mutador **separado e de uso exclusivo da suíte
Windows**, `restore-basic-times.synthetic.ps1`. Ele não é
importado, instalado ou empacotado com o aplicativo Electron.
Antes de tocar o arquivo, exige a raiz como **filha direta de
TEMP**, prefixo fixo de fixture artificial, nonce hexadecimal
de 32 caracteres igual ao marcador e ausência de entradas
reparse na raiz, subpasta, marcador e arquivo específico
`native-enum/metadata-probe.scs`. Exige que o arquivo tenha
**um único hardlink**. Qualquer condição diferente aborta.

O script usa `GetFileInformationByHandleEx(FileBasicInfo)`
para obter `CreationTime`, `LastAccessTime`,
`LastWriteTime`, `ChangeTime` e os atributos. Grava
**somente bytes fictícios** sobre a entrada sintética,
restaura os bytes originais e chama
`SetFileInformationByHandle(FileBasicInfo)` para recuperar
os metadados de base. Compara os campos **antes da
liberação do handle e após fechá-lo e reabri-lo**. Só
retorna o token fixo `RESTORATION_PERFORMED` quando
essas comparações passam.

Simultaneamente, o helper principal C# permanece
**somente leitura**: fixa o handle metadata-only e
obtém `FSCTL_READ_FILE_USN_DATA` antes e depois.
Na CI Windows/NTFS, o USN desse mesmo `FileId`
**aumentou**, mesmo com bytes e todos os timestamps
restaurados. Esse é o testemunho de **recusa 12**, sem
nomes, caminhos, IDs, datas ou dados do arquivo no
relatório. Controle de nonce inválido demonstrou recusa
sem modificar bytes.

**Interpretação responsável:** o USN pode ter avançado
por uma ou várias operações do ensaio, inclusive a
própria restauração dos metadados, não necessariamente
apenas pela gravação temporária do conteúdo. O
experimento não isolou causalmente cada evento.
Também não demonstra que USN seja monotônico de forma
universal após reinício, truncamento ou desativação
do journal; não foi executado em ReFS/SMB, nem indica
histórico completo ou resistência geral ABA/TOCTOU.
Mesmo se um checkpoint USN repetir, **nunca** será
tratado como prova de que o arquivo não mudou.
`guaranteesNoABA:false`, `atomicPathContainmentProven:false`,
`supportsRealGameInspection:false` e
`operationsEnabled:false` mantidos.

O Windows PowerShell 5.1 requer sintaxe C# legada
no `Add-Type`, e `BY_HANDLE_FILE_INFORMATION` exige
alinhamento de 4 bytes para a verificação correta de
`NumberOfLinks`; ambos foram corrigidos e validados
nos testes Windows. Fonte oficial de `FILE_BASIC_INFO`:
https://learn.microsoft.com/en-us/windows/win32/api/winbase/ns-winbase-file_basic_info


## Verificação estrita de buffers USN V2/V3 (25–26/10/2026)

O parser do `FSCTL_READ_FILE_USN_DATA` recebeu uma
etapa **fail-closed** antes de aceitar qualquer número USN.
Ele exige resposta com exatamente um registro, tamanho
declarado igual aos bytes retornados, alinhamento de 8 bytes,
versão principal **2 ou 3**, versão secundária **0**, cabeçalho
completo, USN positivo e comprimentos/offsets do campo
de nome válidos dentro do buffer. O nome **não é decodificado,
impresso ou incluído em nenhum relatório**; esses metadados
só servem para rejeitar registros malformados. Versões futuras,
dados truncados, respostas de erro ou registro de tamanho
inesperado são recusados em vez de inferir segurança.

O modo de teste `--rdcw-probe --test-usn-record-guards`
verifica essa **mesma função de validação** com dois registros
fictícios bem formados (USN_RECORD_V2 e V3) e **26 variantes
malformadas**. Apenas se ambos os positivos forem aceitos e
todos os negativos recusados, encerra com código **13**,
que ainda representa **recusa genérica**, stdout vazio e
nenhuma autorização. A fixture deve possuir marcador
nonce válido na raiz filha direta da TEMP; flags extras,
ausência de opt-in e nonce inválido sempre recusam.
Nenhum journal é percorrido, criado, restaurado ou removido
nessa prova de parser, que é totalmente em memória.

O teste não reproduz uma desativação real do USN Journal,
reinício de geração ou transbordamento do journal; essas
condições continuam **sem comprovação operacional**. A
validação do buffer também **não** prova ausência de ABA
ou sequência completa de eventos. Mantidos
`guaranteesNoABA:false`,
`atomicPathContainmentProven:false`,
`supportsRealGameInspection:false`,
`operationsEnabled:false`.

Documentação de estruturas:
https://learn.microsoft.com/en-us/windows/win32/api/winioctl/ns-winioctl-usn_record_v2
https://learn.microsoft.com/en-us/windows/win32/api/winioctl/ns-winioctl-usn_record_v3

## Endurecimento de TOCTOU do mutador descartável (26/10/2026)

O script de laboratório `restore-basic-times.synthetic.ps1` **não é distribuído no Electron**. Antes, depois de validar a fixture por pathname, chamava `File.ReadAllBytes`/`File.WriteAllBytes` novamente pelo nome. Isso permitia que uma substituição do caminho entre a verificação e o uso atingisse outra entrada.

A nova implementação exige um **conteúdo de teste conhecido e exato**, além do nome `metadata-probe.scs`, um único arquivo na pasta `native-enum`, nonce e localização TEMP válidos. Ela fixa handles Win32 para raiz, subpasta, marcador e arquivo com `FILE_FLAG_OPEN_REPARSE_POINT`; consulta atributos, identidade e `NumberOfLinks == 1`; e mantém compartilhamento somente de leitura (`FILE_SHARE_READ`) nos handles principais. As duas gravações fictícias e a restauração dos quatro timestamps são feitas **pelo mesmo handle fixado**, nunca reabrindo o pathname para escrever. Uma segunda abertura apenas de leitura, enquanto o primeiro handle ainda está vivo, compara o FileId e o FILE_BASIC_INFO.

Um modo `-HoldAfterPin`, que só existe no script de teste e exige exatamente `CONTINUE`, permite provas concorrentes reprodutíveis: outro processo tenta gravar e renomear o arquivo, diretórios e marcador durante a retenção dos handles. A suíte exige recusa dessas tentativas e preservação dos bytes inventados. Respostas inválidas não alteram os arquivos e retornam apenas um erro genérico, sem dados privados.

**Limite de garantia:** este isolamento estreita a janela de substituição entre validação e uso no runner Windows comum, mas não prova ausência universal de TOCTOU, ABA, acesso privilegiado no host, troca de ancestrais fora do escopo, resistência a hardlinks de adversários privilegiados nem durabilidade após pane. Arquivos reais continuam fora do escopo. O leitor C# principal permanece somente leitura e o contrato conserva `guaranteesNoABA:false`, `supportsRealGameInspection:false` e `operationsEnabled:false`.

## Redução adicional da reinterpretação de caminhos (26/10/2026)

O mutador de testes fixava o diretório e o arquivo, mas ainda chamava `CreateFileW` usando **pathnames completos** para abrir `native-enum`, o marcador e `metadata-probe.scs`. Agora a raiz TEMP é fixada primeiro; em seguida, cada filho é aberto com `NtOpenFile` e `OBJECT_ATTRIBUTES.RootDirectory` referenciando o handle do pai já aberto. Somente três nomes de filho fixos são permitidos. A checagem recusa entradas de nomes diferentes em maiúsculas/minúsculas, reparse points, tipo errado e alvo com mais de um hardlink. O arquivo de teste é escrito e verificado exclusivamente por handles nativos; não é aberto por pathname para escrita.

O Windows de CI executa controles para diretório/marcador com grafia alterada, alvo hardlinked e testes de tentativa de renomeação/sobrescrita após o bloqueio dos handles. Os testes seguem isolados da interface Electron, sem leitura ou escrita de mods reais.

**Isto não fornece contenção atômica comprovada de toda a cadeia de ancestrais da TEMP**. A primeira abertura do caminho raiz continua sendo por pathname, e a pré-validação ainda usa atributos/leituras por nome antes da abertura. Também não cobre adversários privilegiados, alterações no kernel, hosts comprometidos ou durabilidade após desligamento. Não se deve converter evidência do laboratório em autorização para instalar/remover mods. O contrato do produto continua `atomicPathContainmentProven:false`, `guaranteesNoABA:false` e `operationsEnabled:false`.
