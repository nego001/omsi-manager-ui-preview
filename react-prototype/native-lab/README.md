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
