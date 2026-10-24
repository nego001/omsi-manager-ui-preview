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
