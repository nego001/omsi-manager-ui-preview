# OMSI Manager | Corpus sintético de falhas e orçamentos

**Estado:** simulador determinístico em memória. Não lê pacotes reais, não descompacta ZIP/SCS, não usa IPC nem mede tempo real.

A rotina src/synthetic-reader-scenarios.ts cria cenários de entradas declaradas, módulos e tempos virtuais. A suíte tests/synthetic-reader-scenarios.spec.ts testa:

- Caminhos de travessia, absolutos, separadores Windows, nomes reservados, duplicados, links e formato fictício quebrado.
- Entradas além do limite, razão de expansão excessiva, profundidade e quantidade de bytes.
- Módulos fictícios demorados, cancelamento antes ou durante a sequência, e limite global de tempo virtual.
- Divergências ETS2/ATS e relatórios inválidos; todas as operações da Oficina/Instalador permanecem desativadas.

Os limites ARTIFICIAIS são: 128 entradas, caminhos de 160 caracteres, profundidade 12, 2 MB codificados, 4 MB expandidos, razão 100:1, 600 ms VIRTUAIS por módulo e 2500 ms VIRTUAIS totais.

**Esses limites não comprovam segurança de arquivos reais.** Nenhum parser de contêiner foi criado. O campo declaredFormat é um rótulo fictício e simulatedDurationMs não inicia tarefas nem espera no relógio. Uma implementação real precisará de sandbox, watchdog de tempo real, orçamentos de memória/CPU, validação de links e nomes no sistema operacional, hash do conteúdo, defesa TOCTOU, testes reais e consentimento.

Um candidato emitido pelo coordenador permanece não verificado. O resultado incompleto, cancelado, bloqueado ou ambíguo nunca contém autorização de instalar, remover, atualizar ou editar um mod.

Nenhum arquivo original, jogo, backup ou código do OMSI Manager principal foi modificado. PR isolado em rascunho, sem merge.

## Leitura de ZIP real em memória: somente fixtures da CI

O laboratório em scripts/controlled_zip_reader.py aceita somente objetos
Python bytes, não caminhos, e utiliza zipfile para ler cabeçalhos ZIP e
validar CRC do conteúdo descompactado de fixtures geradas em memória.
Exige limites de entradas, tamanho e expansão, rejeita links, traversal,
caminhos duplicados, nomes reservados e formatos não suportados.

É uma etapa de testes e NÃO um parser liberado para arquivos de usuários.
Não lê ZIP/SCS de disco, não abre mods de verdade, não executa programas,
não extrai entradas e não tem garantia de sandbox de produção.
Um ZIP tecnicamente bem formado não prova autenticidade, ausência de malware,
compatibilidade, licença nem capacidade de instalação. Instalar permanece bloqueado.

O leitor de fixtures recusa também diretórios vazios registrados com
compressão DEFLATE. O contrato exige entradas de diretório ZIP_STORED
de tamanho zero; isso é uma restrição conservadora do laboratório, não
uma afirmação de que todo ZIP de usuário com diretórios DEFLATE seja malicioso.

Quando o teste de abertura X11 falha, ele registra somente categorias
de erro pré-definidas (sandbox, display, bibliotecas, GPU, filesystem e runtime),
sem publicar stderr bruto, caminhos do computador, nomes de usuário ou conteúdo.

### Contagem de extensões declaradas, sem nomes de arquivos

O leitor experimental agora devolve somente contagens agregadas de sufixos
(.bus, .cfg, .sco, .sli, .sii, .scs, .dds, .png, .jpg, .wav, .ogg,
.bank, .json e outros). Não devolve nomes, diretórios ou caminhos.
A contagem é gerada a partir do nome declarado na entrada ZIP, não do
conteúdo nem de uma assinatura de formato. Portanto, mesmo com arquivos
com extensão .bus ou .sii, os campos gameRecognized,
compatibilityVerified, installationEnabled e
declaredSuffixesAreContentProof permanecem falsos.

Os testes cobrem um ZIP fictício com indícios misturados de OMSI/ETS/ATS
e nomes sensíveis inventados, verificando que eles nunca chegam à saída.

### Bloqueio conhecido no lançador X11

Na execução 40573648625, o lançador nativo produziu SIGTRAP e indicação
de problema com sandbox antes de criar a janela. Não foi desabilitado
o sandbox nem transformado em sucesso o teste correspondente.
O funcionamento X11 do lançador Auto permanece sem certificação nesse runner.

### Marcadores textuais de definições, ainda somente em memória

O componente `controlled_definition_hints.py` avalia apenas bytes de
fixtures ZIP dentro dos limites existentes. Para `.bus`/`.cfg`, procura
linhas isoladas `[diretiva]`; para `.sii`, observa o token `SiiNunit`,
delimitadores de bloco balanceados em linhas próprias e uma declaração
com `:`. As saídas são apenas contagens de arquivos com marcador,
sem marcador, texto não decodificável ou maior que o limite de inspeção.

Limites adicionais: até 16 KiB e 256 linhas por arquivo textual.
Apenas UTF-8 estrito é aceito neste laboratório, e isso NÃO equivale
ao suporte completo às codificações usadas por mods reais do OMSI.
Um marcador sintático NÃO comprova gramática completa, validade de
referências, instalação, origem, compatibilidade ou reconhecimento
do simulador. Nenhum texto, nome de arquivo ou caminho é devolvido.

### Referências entre arquivos apenas dentro de fixtures

O laboratório `controlled_reference_hints.py` observa um subconjunto
artificial de diretivas `[model]`, `[mesh]`, `[texture]` e `[sound]`
em linhas seguidas de um único nome relativo. Conta declarações
existentes no ZIP de teste, ausentes do próprio ZIP, referências
com caminhos perigosos e referências de formato não suportado.
A resolução é somente relativa ao diretório declarado da fonte
dentro do mesmo ZIP, comparada contra o índice central previamente
validado. Não procura arquivos na instalação dos jogos ou em outros mods.

Cada fonte suporta no máximo 64 referências declaradas e a soma
do pacote no máximo 256. Estouro dos limites recusa integralmente
a análise do ZIP fictício; arquivos de texto grandes, inválidos
ou em codificações não suportadas são contados como não inspecionados.
Nenhum nome, caminho, referência ou conteúdo sai do processo.

As contagens são PISTAS ARTIFICIAIS: NÃO validam gramática completa
de OMSI, modelos O3D, texturas, som, SII, dependências externas ou
compatibilidade. `fixtureReferencesVerified` é sempre false, e
operações reais de instalação, remoção e reparo não são permitidas.

### CI: teste X11 estrito separado do leitor e da empacotagem

O teste do executável ELF `OMSI-Manager-Auto` no Xvfb agora é um job
independente, `native_auto_x11`, que baixa o **mesmo artefato Linux**
criado e validado pelo job `build`. A auditoria SHA256 é exigida antes
do teste gráfico. O job continua obrigatório e falha se a janela não
for confirmada ou o Electron encerrar por SIGTRAP; não há bypass do
sandbox. Essa separação impede que um defeito conhecido no lançador
cancele a criação do artefato Linux e as auditorias independentes do
leitor, Arch Linux e par Windows/Linux. Uma CI com falha no X11 **não**
pode ser divulgada como totalmente aprovada.

### Comparação de 2 a 4 ZIPs fictícios, sem arquivos reais

O módulo Python `controlled_fixture_group.py` recebe apenas uma tupla
de dois a quatro objetos `bytes` de ZIPs criados para testes. Antes de
comparar referências, reaplica o gate e as verificações CRC/limites do
leitor de cada pacote. Limites combinados: 6 MB de entrada compactada,
8 MB de conteúdo expandido e 512 diretivas declarativas. Nenhuma entrada
é extraída para disco. Os resultados incluem somente contagens por posição
do pacote, nunca caminhos, nomes, texto ou arquivos originais.

A comparação separa referências presentes no próprio ZIP, referências
cujo nome aparece em outro ZIP fornecido, referências ausentes de todos
os ZIPs de teste, caminhos perigosos e sugestões não suportadas.

**Candidato em outro ZIP não é dependência confirmada.** A comparação
depende exclusivamente do nome relativo no pequeno dialeto sintético
em memória e não valida load order, formatos binários, integridade
semântica, veículos reais, instalações OMSI/ETS2/ATS, licenças ou mods
de terceiros. Todos os campos de verificação real e instalação continuam
falsos. O leitor ainda não recebe arquivos do usuário nem participa do
Electron/preload/IPC.

### Biblioteca: exemplos de comparação de ZIPs fictícios

A Biblioteca mostra agora três **relatórios estáticos exemplificativos**
(referência candidata, referências ausentes e caminhos inseguros).
O JSON `src/fixture-cross-package-examples.json` contém somente números,
identificadores fixos e descrições genéricas. A suíte Python gera os mesmos
cenários ZIP em memória, executa o leitor de grupos e verifica a exatidão
de cada número exibido pela interface. O teste Playwright confere as
mudanças de cenário e a permanência do botão Instalar bloqueado.

**Não é um upload ou analisador ZIP no navegador.** O novo componente
não recebe caminhos, pacotes, fotos, arquivos do jogo, favoritos nem dados
pessoais. Ele não invoca IPC. Nenhum candidato é dependência comprovada.

### Ambiguidade quando vários ZIPs fictícios declaram o mesmo caminho

O comparador agora distingue **candidato em um único outro ZIP** de
**referência ambígua em dois ou mais ZIPs**. Uma referência encontrada
no ZIP de origem prevalece na categoria `insideOwnFixture`, sem
escolher entre os externos. Referências com caminhos inseguros jamais
são resolvidas por candidatos externos. A contagem de ambiguidade é
por referência declarada, e não por quantidade de cópias encontradas.

O laboratório da Biblioteca exibe o quarto cenário, com três ZIPs
fictícios e um arquivo com nome repetido entre dois fornecedores.
As contagens JSON são confrontadas com o leitor Python durante CI.
Os resultados continuam apenas agregados, sem caminhos, bytes,
instalações reais ou promessa de ordem de carregamento. Nenhuma
referência é validada semanticamente e todas as operações reais
permanecem indisponíveis.

### Biblioteca: triagem explicativa com origem e lacunas de evidência

O componente `fixture-diagnostic-guidance.ts` transforma somente as
contagens estáticas já confrontadas com o leitor Python em orientações
para os quatro cenários fictícios. A ordem de exibição é: caminho
recusado pelo contrato, ambiguidade, referência ausente, marcador
não suportado, candidato único e correspondência interna.

Cada orientação explicita por que o dado merece atenção e qual
verificação real ainda falta. A UI identifica a origem como CI de
ZIPs inventados, não como diagnóstico do catálogo ou instalação.
Contagens inválidas falham fechadas, o resultado é imutável e
`inspectedRealFiles`, `dependenciesVerified`, `compatibilityVerified`
e `canInstall` ficam permanentemente `false`.

**Não há sentença de malware, compatibilidade ou conflito real:**
um caminho recusado é apenas uma restrição sintética, e uma
correspondência nominal não prova que o destino seja utilizável.

### Cobertura de evidências e textos que não puderam ser lidos

O laboratório da Biblioteca agora exibe as quantidades de fontes
de definição inspecionadas e não inspecionadas, confrontadas em
CI com o leitor Python. O novo quinto cenário inclui um `.bus`
fictício acima do limite textual de 16 KiB. Nesse caso, nenhuma
referência é contada, mas a UI **não** apresenta o zero como prova
de que o mod não possua dependências.

`fixture-evidence-coverage.ts` gera um plano de verificação
não executável que distingue checagens de ZIP feitas apenas nas
fixtures da CI, referências nominais, candidatos externos,
ambiguidades, caminhos recusados, extensões não suportadas e
lacunas causadas pelo limite de leitura. A verificação de arquivos
reais, compatibilidade e autorização de instalar permanecem
sempre `false`. Sem IPC, upload, extração ou acesso a jogos.

### Relatório individual por pacote ZIP fictício na Biblioteca

Os cinco cenários demonstrativos agora contêm também contagens
por posição de ZIP (`slots`) com 2 ou 3 pacotes. A UI permite
alternar entre eles e apresenta as fontes textuais inspecionadas,
não inspecionadas, correspondências internas, candidatos,
ambiguidades, ausências e caminhos recusados daquele ZIP de teste.

O contrato Python confere **cada contagem por pacote**, além
das somas consolidadas, contra arquivos ZIP temporários em memória.
`fixture-per-package-report.ts` falha se algum slot faltar, repetir
numeração ou divergir dos totais consolidados. Toda saída permanece
anônima, sem nomes, paths ou dados binários, e o resultado nunca
representa arquivos reais, dependências verificadas ou permissão
de instalação. O seletor não abre ZIPs nem consulta favoritos.

### Leitura de um arquivo ZIP real no disco descartável da CI (sem mods de usuários)

Foi criado o experimento Linux `controlled_ci_file_reader.py`. A suíte
`test_controlled_ci_file_reader.py` grava um ZIP fictício real em uma pasta
temporária exclusiva, abre-o com `O_RDONLY|O_NOFOLLOW|O_CLOEXEC|O_NONBLOCK`,
passa **somente o descritor já aberto** a um processo Python novo e recebe
uma resposta de contagens sem nomes. O processo recusa descritores graváveis,
pipes, hardlinks, tamanhos acima do limite e arquivos ZIP corrompidos.
O leitor confirma que o descritor aponta para arquivo regular com identidade
estável antes/depois de `pread`; não extrai nem escreve o conteúdo.
Testes adicionais verificam que symlink não pode ser aberto, que não foram
criados arquivos na pasta de teste e que dados da fixture não chegam à saída.

Há limites de CPU/memória/fsize no processo e timeout no orquestrador de teste.
**Importante:** isso NÃO constitui isolamento de sistema operacional validado
(o próprio relatório devolve `osSandboxVerified=false`). O processo de teste
não está ligado ao Electron, IPC, leitor de mods de usuários ou pastas de jogos.
É uma prova testável de leitura de bytes de arquivo local descartável,
não uma aprovação de entrada não confiável, autenticidade, detecção de malware,
compatibilidade ou operações de instalação, remoção e reparo.

A função `projectFixtureSlots` agora padroniza defeitos de contagem ou
cobertura de slots como `FIXTURE_SLOTS_INVALID` sem aceitar a entrada;
erros de programação desconhecidos continuam propagados. Isso corrige
o teste Playwright de contratos que esperava um erro específico.


### Testes adicionais de recusa do descritor Linux

A suíte do trabalhador da CI agora testa também o processo filho com um
arquivo aberto para escrita, com hardlink e com descritor de diretório,
além de rejeitar um número de descritor não herdado. Os casos devem
terminar com uma mensagem fixa, sem nomes, conteúdos ou caminhos.
Um teste confirma que a leitura por `pread` não modifica o offset
compartilhado do descritor herdado nem os bytes do ZIP descartável.
Esses testes não representam um sandbox de produção nem permitem
usar um ZIP real de usuário no aplicativo.

### Comparação de 2 a 4 ZIPs físicos descartáveis, com descritores somente leitura (28/10/2026)

O laboratório Linux passou a incluir `controlled_ci_group_fd_reader.py`, que aceita **somente 2 a 4 descritores já abertos**, sem parâmetros de pathname. Os testes criam os ZIPs fictícios numa pasta temporária exclusiva, abrem os arquivos com `O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK` e passam exclusivamente os FDs ao processo `python -I -S -B` com recursos e tempo limitados. Arquivos regulares repetidos, descritores graváveis, arquivos corrompidos ou acima do orçamento, dados fora dos limites e grupos inválidos são recusados integralmente.

A leitura compartilha o mesmo controle de FD do experimento individual. Os bytes passam pelo `examine_fixture_group` existente, que primeiro verifica cada ZIP e suas entradas antes de calcular as contagens de referências por pacote. A saída devolve só contadores, slots 1–4 e garantias **negativas**: nenhum mod do usuário, nenhuma escrita, nenhuma instalação, nenhum reconhecimento de jogo ou certificação da sandbox. Não devolve nomes, conteúdos ou caminhos.

O módulo `src/fixture-ci-fd-evidence.ts` define uma ponte de projeção para os relatórios individuais. Rejeita campos inesperados, IDs de slot repetidos/incorretos, contagens incoerentes e qualquer alegação positiva de autorização, sandbox ou leitura de mods reais. Reutiliza `projectFixtureSlots` e preserva a origem `ci-disposable-zip-files`. Ainda é **um contrato de laboratório**, sem conexão ao Electron, à Biblioteca em execução ou ao seletor de mods.

**Limites importantes:** estabilidade de `fstat` antes/depois não demonstra invariância contínua contra ABA/TOCTOU. Os FDs provêm dos testes descartáveis, mas o leitor não autentica a origem de um FD arbitrário. As restrições de recurso não substituem isolamento completo de sistema operacional. O ZIP físico é real como arquivo de teste, mas o mod, as referências e as dependências são inteiramente inventados.

**Critério de aprovação:** a CI precisa aprovar os novos testes Linux e o contrato TypeScript. A compilação Windows, a integridade dos pacotes e o bloqueio de instalação devem permanecer intactos. O lançamento X11 automático continua uma pendência independente, sem `--no-sandbox`.

### Proteção kernel Linux no processo leitor CI (28/10/2026)

Os leitores de ZIPs fictícios baseados em descritores herdados exigem
`prctl(PR_SET_NO_NEW_PRIVS, 1)` no processo Python filho **antes** de analisar
os bytes. O valor é confirmado com `PR_GET_NO_NEW_PRIVS`; erro do syscall,
kernel sem suporte ou falha de confirmação causam **recusa integral**.
A suíte `test_controlled_ci_linux_hardening.py` confere a ativação em
processo separado e que erros não expõem informações do sistema.

`no_new_privs` impede ganhos de privilégio em operações `execve` e é um
pré-requisito para algumas modalidades de seccomp. **Não** restringe por si só
acesso a arquivos, rede, syscalls, diretórios ou vazamentos; o processo ainda
não dispõe de sandbox completa e `osSandboxVerified=false` permanece
obrigatório. Nada foi conectado ao Electron, ao instalador ou a mods reais.

A validação precisa ocorrer no GitHub Actions Linux antes de declarar a
etapa aprovada. O X11 Auto e a homologação física permanecem pendentes.

### Defesa por syscalls seccomp no laboratório Linux x86_64

Nos subprocessos Python de CI, `controlled_ci_syscall_guard.py` instala
um filtro kernel seccomp-BPF **somente em Linux x86_64**, após a verificação
`no_new_privs`, antes de ler ZIPs fictícios pelos descritores herdados.
O filtro exige arquitetura x86_64 correta, recusa a ABI x32 e bloqueia com
`EPERM` algumas famílias de syscalls: `open/openat/openat2/creat`,
`socket/connect/bind/listen/accept`, envio/recepção de mensagens por socket,
`execve/execveat`, `fork/clone`, alterações básicas de nomes de caminhos
e `ptrace`. Qualquer falha ao instalar o filtro interrompe o worker,
sem erro detalhado, caminho ou conteúdo dos arquivos.

O teste `test_controlled_ci_syscall_guard.py` verifica em outro processo
que `os.open('/dev/null')` e a criação de socket falham com `EPERM`,
enquanto um descritor já existente pode ser consultado normalmente.
Os testes do leitor precisam continuar aprovados *sob* o filtro ativo.
Nenhum byte de ZIP é descompactado para o disco.

**Limitações cruciais:** o filtro é uma lista de syscalls proibidas,
**não** uma lista de todas as syscalls permitidas e não isola sozinho
processos, kernel, memória, descritores herdados ou rede preexistente.
`osSandboxVerified=false` continua obrigatório. Não é homologação de
mods não confiáveis de usuários, nem habilitação de leitura no Electron.
Portabilidade além de Linux x86_64 é recusada, não simulada.

### Inventário estrito de descritores herdados no laboratório

O módulo `controlled_ci_fd_inventory.py` exige que os únicos descritores
abertos com número a partir de 3 no worker sejam os ZIPs fictícios
fornecidos pela CI por `pass_fds`, com uma única exceção estrita: até um
FD mantido pelo próprio interpretador para o script `__file__` em execução.
Essa exceção exige identidade dispositivo/inode exata e modo somente leitura.
O Python no runner também pode manter um descritor regular de biblioteca
sob `/usr/lib/` ou `/usr/local/lib/`; no máximo um descritor desse tipo,
se for somente leitura, é **fechado** antes da análise sob seccomp, sem ser
lido ou repassado. Descritores de arquivos externos e sockets não declarados
continuam causando recusa integral. Antes da ativação do filtro seccomp, o
worker inspeciona `/proc/self/fd`, consulta metadados com `fstat` e
`F_GETFL`, e recusa descritores extras, arquivos não regulares,
hardlinks e acessos de escrita. A leitura de `/proc/self/fd` cria um
descritor efêmero, ignorado apenas se `fstat` comprovar `EBADF` após
o fechamento.

Os testes `test_controlled_ci_fd_inventory.py` verificam que um ZIP
fictício legítimo passa, mas outro descritor **não declarado** faz o leitor
individual e o comparador de pacotes recusarem integralmente a execução.
Nenhum caminho observado, nome ou conteúdo de ZIP aparece nos relatórios.

**Escopo e limites:** esse inventário confere o conjunto de FDs durante
a inicialização do processo, não autentica a origem dos dados nem impede
todas as possíveis condições de corrida. Descritores 0, 1 e 2 são usados
para entrada/saída do worker e não passam pelo mesmo inventário. O kernel
seccomp continua operando com lista de negações, e
`osSandboxVerified=false` permanece obrigatório. Nenhum mod real ou
aplicativo principal passa a ser acessível. Essa implementação requer
validação do GitHub Actions antes de qualquer declaração de aprovação.

### Dupla leitura posicional dos ZIPs sintéticos

O leitor de descritor único e o comparador de pacotes agora exigem **duas
leituras completas independentes** do mesmo FD regular de tamanho limitado,
utilizando `os.pread` (sem alterar a posição compartilhada do arquivo).
Em cada leitura, a identidade `st_dev/st_ino/st_size/st_mtime_ns/st_ctime_ns`
é conferida; os dois conteúdos capturados devem ser exatamente iguais.
Divergência causa recusa integral antes da análise ZIP, sem divulgar bytes,
hashes, caminhos ou metadados particulares.

O teste `test_two_positional_snapshots_reject_changed_bytes_with_identical_fstat`
simula uma mudança temporária no retorno de `pread` com os metadados do
arquivo inalterados e exige recusa, preservando os bytes da fixture em disco.

**Limites:** duas leituras iguais não impedem todas as condições de corrida
nem garantem imutabilidade depois da captura; um adversário pode realizar
alterações idênticas nos dois períodos ou atuar fora deles. Isso tampouco
autentica a origem do FD, habilita mods pessoais ou estabelece sandbox
completa. As negativas de segurança, inclusive `osSandboxVerified=false`,
continuam obrigatórias.

### Revalidação ao término da comparação de ZIPs fictícios

A verificação individual `read_checked_fixture_fd_bytes` faz duas leituras
posicionais do mesmo arquivo de laboratório e compara os bytes e os metadados.
O comparador de **2 a 4 ZIPs inventados** acrescenta uma segunda barreira:
depois de calcular as relações entre os pacotes em memória, lê novamente cada
descritor original com as mesmas proteções e exige que o conteúdo seja
**idêntico** ao capturado antes da comparação. Se qualquer FD mudou, **todo**
o resultado é recusado; nenhuma relação por nome vira dependência verificada.

O teste `test_group_rechecks_all_fds_after_comparison_and_rejects_late_change`
simula a mudança do primeiro ZIP apenas na revalidação final, sem alterar
o arquivo real do laboratório nem mudar os metadados do FD, e exige recusa
com mensagem fixa. A validação precisa permanecer verde no GitHub Actions.

**Limites:** esse procedimento apenas amplia a janela na qual alterações
inesperadas são detectáveis. Leituras repetidas não criam um snapshot atômico,
não autenticam a origem dos ZIPs e não garantem que terceiros não modifiquem
bytes após a última verificação. `osSandboxVerified=false`, leitura de mods
pessoais desabilitada e operações de instalação/reparo bloqueadas permanecem.

### Bloqueio de alterações de metadados no worker seccomp

O processo Python de análise de ZIPs **inventados** da CI Linux x86_64
agora recusa syscalls de alteração de permissões/proprietário
(`chmod/fchmod/fchmodat/fchmodat2`, `chown/fchown/lchown/fchownat`),
datas (`utime/utimes/futimesat/utimensat`), tamanho de arquivos
(`truncate/ftruncate`), criação de hardlinks/symlinks/nós especiais,
e operações administrativas de montagem/namespaces. As restrições são
instaladas **depois** do aquecimento de componentes Python e do inventário
de descritores, mas **antes** da leitura de qualquer ZIP de laboratório.

Um teste separado em `test_controlled_ci_syscall_guard.py` exige que o
kernel retorne `EPERM` ao tentar `chmod`, `utime`, `truncate`,
`link`, `symlink` e `fchmod` em um arquivo descartável criado
exclusivamente pelo teste. Confere depois que os bytes, permissões, data
de modificação e inexistência de novo link continuam iguais. Não acessa
nenhum arquivo pessoal, pasta de jogo ou mod real.

**Não é sandbox completa:** o filtro continua sendo uma lista limitada de
syscalls proibidas e ainda não constitui uma política de allowlist ou
autenticação de origem. Nem protege contra todas as corridas entre
verificações. O campo `osSandboxVerified=false` permanece obrigatório;
operações de instalação, reparo, remoção e IPC de arquivos continuam
inexistentes no protótipo. Essa etapa só deve ser considerada aprovada
depois que a CI confirmar os testes sob o kernel do runner.
