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
