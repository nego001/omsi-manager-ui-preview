# Fase 2 / M7 | Pistas OMSI condicionadas a referência explícita de modelo

**Ramo:** `feat/controlled-zip-linked-model-hints-v1`, PR empilhada sobre M6 e separada da Biblioteca. Toda entrada continua sendo um ZIP **fabricado em memória por testes de CI**, jamais um mod do usuário.

## Falha de inferência eliminada

O M6 chamava de `omsi-fixture-candidate` uma variante contendo `.bus` e `.cfg` com marcadores, **mesmo que os arquivos fossem completamente independentes**. O M7 torna essa inferência mais restrita: a dupla somente conta como candidata quando o conteúdo simplificado do `.bus` declara explicitamente `[model]` seguido da referência relativa a um `.cfg` **que existe no mesmo índice ZIP, tem marcador próprio, e está dentro da mesma variante `Vehicles/<nome>`**.

O código reutiliza `inspect_fixture_references()` já existente, com um índice restrito **somente a `.cfg` com marcador e da mesma variante**. Não implementa um segundo parser nem consulta arquivos externos. O mesmo controle valida o formato da referência, impede travessia de pasta e exige a entrada alvo no ZIP fictício. O relatório não devolve referências, caminho ou conteúdo; apenas `omsiLinkedVehicleFolders`, `omsiUnlinkedPairedFolders` e contagens antigas.

**Decisões:**

- Referência model válida para o CFG marcado da mesma variante: `omsi-fixture-candidate`.
- Marcadores BUS+CFG na mesma variante, mas sem ligação: `unlinked-omsi-fixture-markers`, sem candidato.
- Referência a CFG inexistente, de outra variante, sem marcador, em contexto `[sound]` ou com caminho `../`: **não conta**.
- Sinais `.sii` de ETS2/ATS permanecem ambíguos. Se houver sinais OMSI e SII, o resultado continua ambíguo.
- Todos os resultados mantêm `evidenceAuthenticated:false`, `gameRecognized:false`, `realModInspected:false`, `compatibilityVerified:false`, `installationEnabled:false` e `realGameFilesTouched:false`.

**Limitação decisiva:** uma referência `[model]` escrita pelo fixture também pode ser falsificada. Isso **não** autentica o formato OMSI, o jogo, a versão, origem do ZIP ou qualquer mod real. Só comprova uma relação textual dentro do pequeno ZIP de laboratório, conferido com limites, CRC e verificações de entrada do leitor existente.

## Testes e bloqueios

Testes adicionais verificam a falta de vínculo, CFG sem marcador, referência de som, travessia, CFG de outra variante, diferença de caixa, múltiplas referências, privacidade e limite de amostra textual. O roteiro `test_controlled_*.py` da CI continua executando o conjunto antigo e novo sem alterações no workflow.

PR Draft. Não habilitar instalação, edição, leitura de mod do usuário, IPC, sandbox bypass, merge ou release. Ubuntu 24.04 X11 strict sandbox (issue #4) continua bloqueando a homologação.
