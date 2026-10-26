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

## TEMP ancestral fixada pelo mutador sintético (26/10/2026)

A etapa anterior já fixava a raiz da fixture, o diretório `native-enum`, o marcador e o arquivo fictício por handles nativos relativos. A abertura inicial **da raiz da fixture**, porém, ainda usava um caminho absoluto. O mutador de testes agora abre primeiro o diretório `TEMP` via `CreateFileW` com `FILE_FLAG_OPEN_REPARSE_POINT`, verifica que é diretório real (não um reparse point) e mantém o handle aberto. A raiz `omsi-manager-recovery-fixture-...` é aberta por `NtOpenFile` **relativamente ao handle dessa TEMP**, usando um nome de filho limitado e regex estrita. O handle da raiz é comparado com uma segunda abertura de metadados do mesmo caminho, sem autorizar qualquer gravação pelo nome.

No teste Windows, uma TEMP **artificial, privada e descartável** é fornecida a um subprocesso por `TMP`/`TEMP`. A tentativa de renomear essa TEMP enquanto seus handles estão retidos deve falhar. Um segundo teste cria uma **junction exclusivamente sintética** para a TEMP e exige recusa antes da alteração de `metadata-probe.scs`. Um teste estático verifica o encadeamento por `RootDirectory` e a ausência de escrita por caminho. O ensaio de restauração dos quatro timestamps, as verificações de USN e as negativas anteriores continuam habilitados. Não se renomeia a TEMP verdadeira do usuário ou do runner.

**Limites essenciais:** esta mudança ancora o pai imediato da fixture, mas **não fixa toda a cadeia de ancestrais acima da TEMP** no mutador PowerShell. A abertura inicial da própria TEMP ainda é feita por pathname; as variáveis `TMP` e `TEMP` fazem parte do ambiente do processo e **não devem ser tratadas como autoridade de segurança confiável** fora do harness controlado. A cadeia completa de ancestrais tem verificações experimentais separadas no observador C# somente leitura, sem equivaler a proteção universal contra TOCTOU/ABA. O script PowerShell permanece **exclusivo dos testes**, não é empacotado no aplicativo e não permite atuar em jogos, mods nem backups reais.

`guaranteesNoABA:false`, `atomicPathContainmentProven:false`, `supportsRealGameInspection:false` e `operationsEnabled:false` permanecem obrigatoriamente inalterados. Homologação física, revisão de segurança de uma arquitetura real de escrita, consentimento e backup/rollback seguem pendentes.

## Handles de toda a ancestralidade local TEMP (26/10/2026)

O mutador PowerShell **continua estritamente sintético**, fora do pacote Electron. A implantação experimental agora fixa uma cadeia de handles Win32 desde a **raiz de um volume local** até o diretório `TEMP`. Abre apenas a raiz do volume por caminho absoluto; os componentes seguintes usam `NtOpenFile` com `OBJECT_ATTRIBUTES.RootDirectory` apontando para o handle de diretório já fixado. Cada componente deve ser diretório real, não reparse point, com nome de segmento simples (sem `..`, separadores, fluxo alternativo ou sufixos ambíguos). A identidade volume/índice de arquivo é comparada a reaberturas de metadados por caminho absoluto e pelo pai relativo. Todos os handles são retidos durante a gravação fictícia e liberados em ordem inversa.

**Evidência do runner Windows:** um teste tenta renomear uma pasta sintética **avó da TEMP** após a barreira `HANDLE_HELD` e exige recusa; outro insere uma **junction artificial em um ancestral acima da TEMP**, exigindo erro genérico e bytes fictícios intactos. Um terceiro teste verifica por análise de código que a raiz da fixture vem do último handle da cadeia. A matriz incluiu 119 testes: **116 aprovados, zero falhas, três ignorados** no commit `2fd6041b17989809ba1b1e1e1d9e0d28b00097fd`. A CI completa de interface e empacotamento é verificada separadamente.

**Limites:** esta é uma prova limitada em uma fixture descartável, **não** uma garantia de contenção atômica de caminhos ou de ausência de TOCTOU/ABA. Apenas volumes locais de formato `X:\\` são admitidos no mutador experimental (UNC e namespaces de dispositivo são recusados). `TMP`/`TEMP` vêm do ambiente do processo; a validação de isolamento depende da execução controlada dos testes. Não foram simulados adversários privilegiados, mecanismos de kernel, falhas de energia, operações em bibliotecas OMSI reais ou distribuição para usuário final. O observador principal permanece **somente leitura** e independente deste mutador. Permanecem `guaranteesNoABA:false`, `atomicPathContainmentProven:false`, `supportsRealGameInspection:false` e `operationsEnabled:false`.

## Revalidação em torno da escrita sintética (26/10/2026)

O mutador isolado `restore-basic-times.synthetic.ps1` mantém os handles do volume, dos ancestrais TEMP e de todos os componentes da fixture. Além da primeira autenticação, executa `CheckPinnedFixture` **depois da barreira concorrente e imediatamente antes de qualquer escrita**; após escrever e restaurar os quatro timestamps, repete a checagem enquanto todos os handles permanecem abertos. A cada checkpoint verifica, de forma conservadora:

- identidade (volume + índice) da raiz sintética, diretório filho, marcador de nonce e arquivo fixado; atributos de arquivo regular e contagem de hardlinks igual a 1 para marcador e alvo;
- `AncestorPins.Verify()`, abrindo novamente cada ancestral por pathname para comparação apenas de identidade, nunca para escrita;
- único arquivo `metadata-probe.scs` no diretório filho, grafia correta dos nomes esperados na raiz, nonce exato de 32 bytes lido pelo **handle já aberto**, e `FILE_BASIC_INFO` do alvo sem alteração inesperada;
- nova abertura de cada filho **relativa ao handle já fixado de seu pai**, com comparação de identidade. O alvo é modificado e restaurado apenas pelo `FileStream` associado ao handle original.

Três testes do Windows usam a barreira `HANDLE_HELD` para tentar adicionar um irmão sintético após a verificação inicial, alterar o timestamp do arquivo fictício e inspecionar estaticamente a ordem das verificações. Quando a operação externa é permitida pelo Windows e a alteração ocorre, o mutador deve falhar; quando o compartilhamento nativo impede a própria alteração, a fixture conhecida pode concluir. Essa distinção evita considerar indevidamente uma alteração **tentada, mas negada pelo sistema operacional**, como prova de mutação bem-sucedida. Na CI #40273730139, o laboratório teve **119 testes aprovados, zero falhas e três ignorados**.

**Não é uma operação transacional:** uma modificação de concorrente entre dois checkpoints ainda pode passar despercebida, um evento ABA pode recompor identidade/estado aparente e uma recusa após a escrita não desfaz automaticamente o que já foi feito. Portanto, isto não comprova contenção atômica, recuperação após pane, integridade de dados reais nem resistência a adversário privilegiado. O script continua **somente para fixtures descartáveis**, não empacotado no Electron. Permanecem `atomicPathContainmentProven:false`, `guaranteesNoABA:false`, `supportsRealGameInspection:false` e `operationsEnabled:false`.

## Atestação dos bytes restaurados em handles fixados (26/10/2026)

A verificação de identidade e os quatro `FILE_BASIC_INFO` timestamps não bastam para afirmar que os bytes do arquivo fictício foram restaurados. O mutador passou a usar `VerifyExact(FileStream, byte[])` para comparar o **comprimento exato e cada byte** da sequência sintética fixa, sem hashes aproximados nem abertura por pathname. O fluxo positivo exige: bytes originais antes e depois da barreira, bytes intermediários escritos e relidos pelo mesmo handle, bytes originais restaurados e relidos pelo mesmo handle, `FILE_BASIC_INFO` restaurado e verificado, e **segunda leitura independente** por handle read-only aberto relativamente ao diretório já fixado e comparado por identidade. A segunda abertura só admite acesso a dados para `metadata-probe.scs`, nunca para outros alvos escolhidos por usuário.

Foi acrescentado um modo de falha **somente no harness sintético**: `-InjectPostRestoreCorruptionForTest`. Ele exige a barreira `-HoldAfterPin` e o protocolo `CONTINUE`, escreve um byte `X` constante no arquivo artificial depois da restauração e verifica que o processo recusa sucesso com mensagem genérica, sem expor caminhos ou nonce. O teste **deliberadamente deixa a fixture descartável corrompida** para demonstrar o limite real: a recusa não implica desfazer a alteração. Outros ensaios exigem recusa de arquivo fictício com comprimento diferente ou bytes diferentes no mesmo comprimento; o cenário positivo demonstra a igualdade integral antes e depois.

**Evidência:** CI #40274880287, laboratório Windows: **123 testes aprovados, 0 falhas, 3 ignorados**, incluindo os quatro testes novos. Os jobs Linux/Playwright e pacote portátil são verificados separadamente. O script nativo e seu modo de falha não são distribuídos no aplicativo nem autorizam modificação de mods reais.

**Garantia limitada:** o teste mostra detecção de corrupção sintética nos pontos de verificação, não prova que observação e escrita sejam atômicas, não elimina ABA/TOCTOU, não oferece durabilidade ou rollback e não homologa uso em instalações OMSI. Contrato inalterado: `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false`, `atomicPathContainmentProven:false`.

## Interrupção de processo em duas etapas da gravação fictícia (26/10/2026)

O mutador descartável possui agora dois **pontos de pausa opcionais e somente de teste**, mutuamente exclusivos, exigindo `-HoldAfterPin`, nonce válido, conteúdo fixo autenticado e o protocolo `CONTINUE`. As novas opções `-HoldAfterIntermediateForTest` e `-HoldAfterRestoredBytesForTest` **não entram no pacote Electron** e não criam uma API para gravar em diretórios escolhidos pelo usuário.

1. `INTERMEDIATE_HELD`: o primeiro conteúdo fictício já foi escrito, conferido e descarregado por `FileStream.Flush(true)`, mas o original ainda não foi restaurado. O teste mata **o subprocesso PowerShell descartável** nesse checkpoint. O arquivo conserva os bytes intermediários; uma nova chamada normal do mutador **recusa** esses bytes e não tenta reparar ou mascarar o estado. Isso evidencia detecção conservadora de uma execução interrompida, não recuperação automática.
2. `RESTORED_BYTES_HELD`: os bytes originais já foram regravados, conferidos e descarregados, mas a chamada nativa para restaurar `FILE_BASIC_INFO` ainda **não aconteceu**. O teste mata o subprocesso e comprova a presença dos bytes originais sem qualquer marcador de sucesso. Esse cenário impede inferir conclusão apenas pela igualdade dos bytes; os timestamps permanecem sem atestação de restauração.

Há ainda testes que recusam as opções de pausa quando usadas **sem** a barreira principal e um teste estático da ordem das operações. A CI #40276132374 executou **130 testes no laboratório nativo Windows: 127 aprovados, zero falhas e três ignorados**, incluindo os quatro testes novos. O ensaio mata somente subprocessos criados para a fixture, não processos reais do OMSI nem serviços Windows, e não altera a TEMP verdadeira.

**Limites:** `TerminateProcess`/encerramento do subprocesso no Windows **não é simulação de queda de energia**, perda de cache do sistema, falha do dispositivo, transação ACID nem garantia de durabilidade. A fixture alterada é removida pelo próprio harness de testes; o produto não dispõe de rollback nem restauração automática. Não há comprovação de ausência de ABA/TOCTOU, homologação de mods reais ou autorização de escrita. Permanecem `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false` e `atomicPathContainmentProven:false`.

## Testemunha externa de estados para interrupções sintéticas (26/10/2026)

O novo módulo `synthetic-operation-ledger.cjs` existe **somente no laboratório** e é excluído do pacote Electron. É uma **testemunha externa**, executada pelo próprio harness Node, independente do mutador PowerShell que pode ser encerrado de forma abrupta. Seu objetivo é registrar, no máximo 12 eventos fixos em um arquivo `JSONL` de tamanho limitado dentro da **fixture descartável**; ele não autoriza operações, não modifica o arquivo `metadata-probe.scs` e não implementa recuperação. O arquivo de evidências é aberto com criação exclusiva (`wx`) e não pode sobrescrever uma testemunha anterior. Cada registro incrementa a sequência e solicita `FileHandle.sync()`. A testemunha autentica inicialmente a pasta filha direta de `os.tmpdir()`, o nome sintético e o marcador de 32 caracteres.

O vocabulário de eventos é fechado: `started`, `intermediate_observed`, `bytes_restored_unconfirmed`, `interrupted` e `completed_observed`. A ordem é verificada por uma máquina de estados: por exemplo, **conclusão depois de interrupção é recusada**, assim como sequência, esquema, campos ou JSON truncados. O leitor `readSyntheticOperationLedger` roda também em um segundo processo Node e relata apenas categorias: `interrupted_intermediate`, `interrupted_metadata_pending`, `interrupted_before_write`, `completion_observed_not_durable` ou `incomplete_unconfirmed`. Caminhos e nonces não são incluídos nos registros JSONL.

A conclusão só é **observada** pelo harness após saída normal do mutador, confirmação textual exata e leitura dos bytes originais. Um processo morto após `INTERMEDIATE_HELD` registra `intermediate_observed` e `interrupted`; se morto após `RESTORED_BYTES_HELD`, registra `bytes_restored_unconfirmed` e `interrupted`. A testemunha registra o evento **após receber a mensagem** do subprocesso, e o evento de interrupção **após observar seu encerramento**. A detecção de uma interrupção, portanto, pressupõe que o harness Node continue vivo; se o próprio observador cair, o último registro poderá ficar incompleto ou atrasado.

**Limites de segurança:** esse testemunho não é journal transacional, não é uma cadeia de auditoria autenticada contra adulteração, não fornece `fsync` comprovado do diretório após criação, não simula perda de energia e não garante persistência física, atomicidade, ordenação global ou contenção contra ABA/TOCTOU. Os caminhos de criação do arquivo testemunha pertencem exclusivamente ao harness descartável; o mutador de dados mantém sua política de handles nativos fixos. Nunca confiar nesses registros para reinstalar, remover, restaurar ou liberar mods reais. Permanecem `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false` e `atomicPathContainmentProven:false`.

## Morte do observador externo: testes portáteis Windows/Linux (26/10/2026)

O laboratório agora contém `synthetic-operation-observer.worker.cjs` (subprocesso Node) e `synthetic-operation-observer.test.cjs` (harness independente). O worker só aceita eventos da enumeração fechada, autentica uma pasta sintética filha direta da TEMP com marcador nonce e emite `SYNCED:<evento>` **depois** que `handle.sync()` do registro retornou. O harness encerra esse worker à força após um evento já confirmado e abre o arquivo de testemunho **em outro processo** para verificar o estado final.

Se o observador morrer com apenas `started`, após `intermediate_observed` ou após `bytes_restored_unconfirmed`, a interpretação continua `incomplete_unconfirmed`: **nenhuma conclusão é inventada, nem o evento `interrupted` é presumido sem testemunha viva**. Uma sequência que chega a `completed_observed` continua sendo classificada apenas como `completion_observed_not_durable`, não como prova autenticada de gravação ou restauração. Testes negativos cobrem arquivo ausente (`unverifiable_incomplete` na revisão conservadora), JSONL truncado (`unverifiable_incomplete`), nonce inválido (recusa) e impossibilidade de substituir o arquivo de testemunho por outro novo.

A suíte não exige o executável .NET/Win32 e deve rodar com Node 22 em Windows e Linux. Entrou em `npm run test:recovery:fixture`, usado pelos jobs Linux e Windows portátil, e também pode ser executada isoladamente por `npm run test:witness:portable`. Isso melhora a preparação do laboratório para desenvolvimento em Arch Linux, **não** significa que a versão Electron Linux já esteja empacotada ou homologada.

**Limites:** matar um processo não simula perda de energia. ACK após `handle.sync()` não autentica a origem dos eventos, nem é certificado de durabilidade de diretório, nem garante integridade contra adulteração. Uma testemunha pode morrer antes de registrar a própria interrupção; a ausência de registro deve ser interpretada como informação faltante. Nada daqui autoriza instalar, excluir, reparar ou restaurar mods reais. O observador e os testes são excluídos do `app.asar`; continuam `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false` e `atomicPathContainmentProven:false`.

## Leitura conservadora de evidências corrompidas ou substituídas (26/10/2026)

O leitor da testemunha sintética foi reforçado para não utilizar `readFile(path)` durante a inspeção do JSONL. Ele confere `lstat`, abre uma vez o arquivo em modo **somente leitura** (`O_NOFOLLOW` nas plataformas que permitem) e compara `fstat` e `lstat` antes e depois com identidade `dev/ino`, tamanho, número de links e tempos `mtime/ctime`. A leitura por **descritor fixado** é limitada a **4.097 bytes**, recusando entradas acima de 4.096 bytes e exigindo de 1 a 12 registros. Links simbólicos, hardlinks, diretórios disfarçados de arquivo e alterações observáveis durante a leitura são recusados. Trata-se de uma auditoria mais conservadora, **não** uma garantia de identidade transacional nem uma proteção absoluta contra ABA/TOCTOU.

Cada linha deve corresponder exatamente à serialização canônica `{"schema":...,"sequence":...,"event":...}` do laboratório, incluindo a ordem das três chaves. Espaços alternativos, campos duplicados, escapes JSON alternativos, números de sequência repetidos, estados desconhecidos, transições ilegais, conteúdo truncado, CRLF e bytes inválidos são recusados. A interface de revisão somente leitura `reviewSyntheticOperationLedger` interpreta falhas no **arquivo de testemunho** como `unverifiable_incomplete` e nunca como conclusão bem-sucedida. O marcador nonce e a fixture continuam sujeitos à autenticação obrigatória antes de qualquer revisão.

Os ensaios adversariais ficam em `synthetic-operation-observer.test.cjs` e fazem parte de `npm run test:recovery:fixture` nos runners Linux e Windows. O algoritmo não altera os arquivos alvo: apenas inspeciona uma testemunha pré-existente dentro de uma fixture descartável e isolada.

**Limite essencial:** registros canônicos ainda podem ser forjados por um agente que tenha acesso de escrita à fixture; **não existe assinatura digital, MAC ou cadeia de confiança autenticada**. Um `completed_observed` continua sendo apenas relato não durável de um observador, nunca permissão ou prova de recuperação, restauração ou gravação atômica. A verificação de `dev/ino` e timestamps não elimina ataques ABA, adversários privilegiados nem perda de energia. O pacote Electron permanece sem o laboratório e mantém `operationsEnabled:false` e `supportsRealGameInspection:false`.

## Encadeamento público SHA-256 das evidências fictícias (26/10/2026)

A testemunha exclusivamente experimental usa agora o esquema `omsi-synthetic-operation-witness-v2`, incompatível de propósito com o v1, para testar integridade **observável**, sem autenticação. O arquivo mantém formato JSONL com exatamente cinco chaves canônicas na ordem `schema`, `sequence`, `event`, `previous` e `digest`. A primeira entrada usa 64 dígitos hexadecimais zero como `previous`; cada entrada seguinte aponta para o `digest` anterior. O `digest` é SHA-256 de um prefixo fixo de domínio `OMSI-SYNTHETIC-WITNESS-CHAIN-V2` e da serialização JSON canônica do corpo da entrada (sem o campo `digest`). Um arquivo permanece limitado a 4096 bytes e 12 eventos.

O leitor somente leitura valida cada hash, a ligação com o registro anterior, o número sequencial, a máquina de estados e a serialização canônica. Falhas passam a `unverifiable_incomplete` na revisão conservadora. A suite portátil Linux/Windows inclui ensaios que adulteram um evento sem recomputar o digest, trocam hashes, alteram o campo `previous`, removem a linha intermediária e fornecem um arquivo v1; tudo isso deve ser recusado. Excluir uma **última linha inteira**, porém, pode deixar um prefixo perfeitamente válido, que deve continuar **inconclusivo** se não tiver evento terminal.

**Teste negativo indispensável:** um adversário capaz de reescrever o arquivo inteiro consegue forjar uma cadeia v2 válida e recalcular todos os hashes sem conhecer segredo algum. Nosso próprio ensaio reproduz esse ataque e demonstra que o leitor só pode classificar um `completed_observed` como observação **não durável e não autenticada**, jamais confirmação de restauração. **Isso não é assinatura, HMAC, cadeia de confiança, proteção contra rollback ou journal transacional.** Para autenticação contra adulteração intencional seria necessária uma âncora confiável externa ao arquivo e fora do controle do potencial atacante, com desenho e auditoria próprios.

**Escopo:** apenas `native-lab` e fixtures sintéticas descartáveis. Nada foi alterado para usar esses registros no Electron ou em jogos e mods reais. Permanecem `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false` e `atomicPathContainmentProven:false`.

## Checkpoint externo do histórico sintético (26/10/2026)

O laboratório experimental passa a contar com `synthetic-evidence-checkpoint.cjs` e `synthetic-evidence-checkpoint.test.cjs`. O checkpoint é criado **em diretório TEMP aleatório e separado**, irmão da fixture fictícia, e não é armazenado nem indicado pelo próprio histórico JSONL. Depois que um observador externo valida integralmente a cadeia v2, o checkpoint grava por criação exclusiva (`wx`) um resumo limitado e canônico: `schema`, `head` (hash do último evento) e `count` (número de eventos). O checkpoint não guarda caminhos, nonce, bytes do alvo nem nomes de arquivos do OMSI. Há sincronização do descritor e limites de tamanho de 512 bytes.

Para revisão, um chamador precisa fornecer **independentemente** o diretório do checkpoint, além da fixture e do nonce. O leitor autentica a fixture e o nonce, verifica a cadeia inteira, abre o checkpoint somente para leitura, recusa symlinks/hardlinks/arquivos não regulares e compara metadados e identidade antes e depois. Se o conteúdo for malformado, a cadeia não validar, a referência faltar ou `head/count` divergirem, o resultado é `unverifiable_incomplete`. Uma divergência não é classificada como ataque comprovado nem autoriza reparação. Se o checkpoint corresponder, o resultado continua `completion_observed_not_durable` ou um dos estados incompletos, **nunca** uma garantia de operação terminada ou segura.

**Resultados que os testes pretendem demonstrar:** uma cadeia inteira falsificada com seus hashes públicos recalculados, se criada **depois** do checkpoint, é detectada pela divergência do `head/count` externo. A remoção de uma última linha completa também é detectada. Checkpoint ausente, corrompido, hardlinkado ou redirecionado por symlink é recusado. Um nonce incorreto impede a própria revisão. O ensaio crucial modifica **tanto a cadeia quanto o checkpoint**, com hashes perfeitamente consistentes, e mostra que o verificador ainda aceita uma observação fictícia forjada. A separação física em duas pastas TEMP não transforma nenhuma delas em armazenamento confiável.

A suíte usa apenas Node.js, funciona nos jobs Windows e Linux por `npm run test:recovery:fixture` e pode ser executada isoladamente com `npm run test:witness:portable`. O checkpoint, a testemunha e os testes permanecem em `native-lab`, excluídos do `app.asar`. Nunca grava, remove ou examina mods reais.

**Limites:** o checkpoint é uma referência de comparação local, **não** assinatura digital, HMAC, armazenamento imutável, TPM, transação, certificado de durabilidade ou proteção contra alteração de ambos os lados. Um atacante que controla o caminho fornecido para o checkpoint ou consegue editar o conteúdo das duas pastas pode forjar ambos. O `fsync` do arquivo não prova persistência da entrada do diretório nem resistência a queda de energia. As comparações de identidade não eliminam ABA/TOCTOU. Continuam `operationsEnabled:false`, `supportsRealGameInspection:false`, `atomicPathContainmentProven:false` e `guaranteesNoABA:false`. A PR permanece experimental e não deve ser integrada à `main` sem revisão e homologação independentes.

## Verificador HMAC em diretórios sintéticos separados (26/10/2026)

O laboratório experimental ganhou `synthetic-evidence-authenticator.cjs` e `synthetic-evidence-authenticator.test.cjs`. O módulo valida primeiro o histórico fictício da fixture; em seguida cria dois diretórios irmãos aleatórios em `os.tmpdir()`, um `omsi-manager-hmac-verifier-...` para **chave binária aleatória de 32 bytes** e outro `omsi-manager-hmac-receipt-...` para o **recibo público**. A chave é gravada uma vez com criação exclusiva `wx` e modo `0600` onde o sistema respeita permissões POSIX. Não é retornada pela API e não entra no JSONL, recibo nem aplicativo Electron.

O recibo mantém apenas `schema`, `head`, `count` e `mac`. O `mac` é HMAC-SHA-256 calculado sobre JSON canônico de domínio fixo, hash final do histórico, quantidade de eventos **e nonce da fixture** (o nonce não é publicado no recibo). Assim um recibo de uma fixture não deve verificar outra fixture com nonce diferente, mesmo quando os eventos forem idênticos. Na revisão, o chamador fornece explicitamente **ambos** os diretórios de verificação, nunca derivados do histórico possivelmente alterado. A revisão autentica o nonce original, lê os arquivos pela abertura única de handles somente leitura com limite, compara `dev/ino`, tamanho, contagem de links e metadados antes e depois, e compara o MAC usando `timingSafeEqual`. Qualquer ausência de chave, arquivo malformado, tamanho irregular, link inesperado ou divergência produz `unverifiable_incomplete`, **nunca** uma restauração assumida.

Os **11 testes novos** validam o cenário íntegro, adulteração da cadeia com hashes públicos recalculados, MAC falsificado, replay entre nonces, chave perdida, chave danificada, hardlink e symlink de chave, nonce incorreto, recibo apagado e comprometimento simultâneo da chave e do recibo. O último caso comprova **deliberadamente a falha de confiança** quando um invasor pode ler a chave HMAC: o mesmo invasor consegue recomputar o MAC e forjar uma observação de conclusão, mesmo sem existir nenhum arquivo-alvo restaurado.

**Limites obrigatórios:** diretórios irmãos no mesmo `TEMP` **não são domínios reais de segurança separados** e geralmente são acessíveis ao mesmo usuário. Isto não é um serviço de chaves isolado, KMS, HSM, TPM, assinatura digital, recibo transacional ou mecanismo de recuperação. Uma chave pode ser copiada, alterada ou excluída; apagar chave não é prova de falha do jogo, e um recibo autenticado atesta **somente o registro do laboratório**, nunca a veracidade do evento nem a durabilidade do disco. Não há proteção garantida contra adversário privilegiado, ataques ABA/TOCTOU, falta de `fsync` no diretório ou queda de energia. A operação permanece inteiramente fictícia; `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false` e `atomicPathContainmentProven:false` continuam exigidos. **Nenhuma implementação desta seção está empacotada no Electron.**

## Verificador HMAC de chave volátil em processo separado (26/10/2026)

`synthetic-memory-verifier.worker.cjs` e `synthetic-memory-verifier.test.cjs` implementam **somente no laboratório** uma fronteira experimental de processo: o Node controlador inicia um subprocesso descartável com um único par imutável de fixture/nonce na linha de comando. O subprocesso autentica a fixture antes de responder `ready`, gera sua própria chave HMAC-SHA-256 aleatória de 32 bytes **dentro de sua memória** e nunca grava a chave, publica hash da chave, MAC ou segredo na saída, argumentos, IPC ou `app.asar`.

O protocolo textual é deliberadamente mínimo, de linha única e JSON canônico: `{"id":N,"op":"arm"}`, `{"id":N,"op":"verify"}` e `{"id":N,"op":"shutdown"}`. Campos extras, objetos duplicados, JSON malformado, caminhos fornecidos em comandos, pedido arbitrário de assinatura e comandos desconhecidos são recusados. `arm` só pode ser usado uma vez, calcula o HMAC sobre contexto de domínio fixo, nonce, hash da cadeia v2 e quantidade de eventos previamente validados, e armazena **somente a prova em memória**. `verify` reabre o histórico já conhecido em modo somente leitura e compara HMACs usando `timingSafeEqual`, sem retornar digest, MAC nem chave. Alteração posterior da cadeia, mesmo quando reencadeada corretamente, resulta em `unverifiable_incomplete`. Encerramento do subprocesso apaga a referência volátil e impede verificações posteriores daquela prova. Um processo reiniciado não possui a chave nem a referência anteriores.

**Ameaça explicitamente não resolvida:** processo separado **não significa usuário do sistema separado**. Outro processo do mesmo usuário, processos privilegiados, depuradores ou executáveis comprometidos podem inspecionar ou substituir o subprocesso ou sua comunicação. Um controlador malicioso pode iniciar seu próprio subprocesso e chamar `arm` **depois** de falsificar o histórico; nosso teste reproduz esse cenário e demonstra uma observação `matched` enganosa, que continua sendo `completion_observed_not_durable`, não restauração comprovada. O nonce passado nos argumentos é identidade de fixture, **não segredo**. A exclusão de chave de disco não equivale a isolamento do kernel, sandbox, HSM, TPM, segredo com acesso protegido, serviço assinado ou autenticação do controlador.

A suíte `synthetic-memory-verifier.test.cjs` cobre sequência correta, verificação antes de `arm`, segundo `arm` recusado, comandos indevidos, histórico substituído, histórico truncado, morte abrupta do subprocesso, reinício sem prova anterior, nonce inválido e falsa confirmação por um subprocesso novo malicioso. Ela roda por `npm run test:recovery:fixture` nos jobs Linux/Windows e por `npm run test:witness:portable`, mas **não modifica o aplicativo** e não prova nenhuma operação com arquivos do OMSI. Não há implantação de serviço operacional com identidade Windows/Linux distinta; uma etapa futura exigirá um modelo explícito de contas, permissões do IPC, ciclo de vida e revisão independente antes de sequer considerar uso fora do laboratório. Permanecem `operationsEnabled:false`, `supportsRealGameInspection:false`, `atomicPathContainmentProven:false` e `guaranteesNoABA:false`.
