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
a mutação. O laboratório não instala monitor de mudanças, não abre
mods reais, não concede autorização e não elimina ataques ABA.
