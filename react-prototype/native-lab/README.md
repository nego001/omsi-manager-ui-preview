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
