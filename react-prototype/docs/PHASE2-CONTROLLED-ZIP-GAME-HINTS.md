# Fase 2 / M6 | Identificação conservadora com bytes de ZIP gerados na CI

**Ramo:** `feat/controlled-zip-game-hints-v1`, empilhado sobre M5, sem alterar a Biblioteca v1. **Nenhum ZIP ou mod do usuário é aberto**. O leitor recebe `bytes` gerados em memória pelos testes; não usa filesystem, download, IPC, console, extração ou escrita.

## Por que reaproveitar o leitor existente

`scripts/controlled_zip_reader.py` já validava ZIP de fixture de memória, incluindo limites globais, entradas perigosas, symlinks, compressão permitida, leitura limitada com verificação CRC, e marcadores textuais muito restritos em `.bus`, `.cfg` e `.sii`. Duplicar um parser aumentaria a superfície de ataque. O M6 adiciona apenas **correlação de marcadores** ao relatório já sanitizado e um avaliador separado em `controlled_fixture_game_hints.py`.

## Regras de laboratório

- Um `.bus` com marcador de texto em `Vehicles/<variante>/...` e um `.cfg` com marcador em **outra entrada no mesmo diretório de variante** dão `omsi-fixture-candidate` e a quantidade de pastas correspondentes. Os marcadores são superficiais, não prova de sintaxe nem leitura dos formatos OMSI.
- Arquivos `.bus` e `.cfg` em variantes diferentes **não se corroboram**.
- Um `.sii` com marcador em `def/...` produz `ets2-ats-shared-format-ambiguous`: **não permite decidir ETS2 versus ATS**.
- Pistas OMSI e `.sii` no mesmo pacote fictício geram `mixed-markers-ambiguous`, sem selecionar jogo.
- Um indício OMSI solitário retorna `insufficient-omsi-fixture-evidence`; sem marcadores úteis retorna `no-recognizable-fixture-evidence`.
- Os nomes completos e caminhos são usados **apenas no leitor durante a inspeção**, nunca retornados. A API emite contagens agregadas e rótulos fixos.

**Sem elevação de confiança:** `omsi-fixture-candidate` não é identificação de mod real. Um par de marcadores genéricos falsificados no ZIP de teste pode produzir essa resposta. Toda saída tem `gameRecognized:false`, `evidenceAuthenticated:false`, `realModInspected:false`, `compatibilityVerified:false`, `installationEnabled:false` e `realGameFilesTouched:false`.

## Testes e limites

Os testes em `test_controlled_fixture_game_hints.py` geram ZIP em memória com DEFLATE e checam correlação por pasta, sinais de caminhão ambíguos, mistura OMSI/SII, extensão enganosa, marcadores ausentes, conteúdo binário, nomes privados, traversal, symlinks, expansão perigosa e rejeição de caminhos do host. São incluídos na descoberta `test_controlled_*.py` da CI.

**Próximos passos:** endurecer sandbox e consentimento para uma futura fonte real, limitar fluxo e permissões de arquivo, testar formatos de jogos com corpus autorizado e estabelecer proveniência criptográfica. Nenhuma execução deste marco autoriza mod real, instalação, modificação, merge ou release. Ubuntu 24.04 X11 strict sandbox (issue #4) segue como bloqueio de homologação.
