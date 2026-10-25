# OMSI Manager | Consentimento e escopo da inspeção somente leitura

**Implementação na prévia Electron:** `electron/inspection-grant.cjs`, `electron/main.cjs` e `electron/game-inspection.cjs`.

## Fluxo da autorização

A interface solicita exclusivamente o identificador do jogo, entre `omsi`, `ets2` e `ats`. Nenhuma API da ponte Electron aceita pathname, shell command ou autorização enviada pelo renderer.

1. O processo principal valida a origem e o frame principal do pedido e impede dois diálogos simultâneos para o mesmo `webContents`.
2. O diálogo **nativo do Electron** permite que a pessoa escolha a pasta a ser examinada. O fechamento/cancelamento não cria autorização.
3. Depois que a pasta é selecionada, o processo principal **revalida a origem** do frame e emite um grant temporário, guardado em `WeakMap`, vinculado ao caminho escolhido, identificador do jogo e ID do `webContents`.
4. O grant só pode ser consumido **uma vez**, pelo mesmo `webContents` e jogo, dentro de **15 segundos**. O consumo ocorre antes de chamar o contador real de diretórios. Erros não restauram o grant. Cópias JSON ou tokens falsificados não herdam a autorização.
5. Depois da inspeção, uma terceira validação da origem impede retornar o relatório para uma página que tenha mudado durante a operação. O resultado autorizado contém apenas contagens, indicadores limitados e avisos, sem caminhos completos.

## O que é lido

O contador real examina **apenas entradas diretamente dentro das pastas reconhecidas**, com orçamento máximo de 2.000 por grupo. Para OMSI 2: `Vehicles`, `maps`, `Sceneryobjects` e `Splines`. Para ETS2/ATS: `mod` na pasta selecionada, ou a própria pasta `mod`, se escolhida diretamente.

Os arquivos `.scs` e `.zip` são classificados **pelo sufixo do nome**. Seus bytes não são abertos ou modificados. Não há leitura recursiva de arquivos, extração ZIP/SCS, instalação, desinstalação, download, execução de comandos ou limpeza de registros de mods.

## Limitações e próximos critérios

- O grant **representa consentimento de seleção de pasta naquela sessão da interface**, não posse de um handle persistente, licença para administrar arquivos, ou certificação do filesystem.
- A contagem atual usa `lstat` seguido de `opendir`. Isso **não elimina corridas TOCTOU** contra substituição de diretórios/link/reparse no intervalo. Também não detecta todos os casos de ABA. Não declarar garantia de contenção nativa baseada em handle até implementá-la.
- O usuário ainda precisa conferir no Windows físico os dispositivos/filesystems suportados, inclusive reparse points, junctions, compartilhamento em rede e diretórios com permissões parcialmente negadas.
- Continuam faltando backup transacional durável, journal nativo, recuperação de falhas e autorização de escrita. A prévia mantém `installMods:false` e `uninstallMods:false`.
- As sondas aprofundadas de `scripts/` são **exclusivas de testes temporários** e não foram conectadas ao renderer/IPC. O empacotamento do Electron exclui `scripts/`.

## Testes de segurança

`electron/inspection-grant.test.cjs` inclui 18 cenários Linux/Windows, cobrindo uso único, limite de validade, vínculo ao jogo e `webContents`, falsificação, cancelamento, concorrência, revogação após falha, relógio inválido, privacidade e integração com o contador real sobre um diretório temporário inventado.

O comando `npm run test:security` agrega os testes existentes a essa suíte. Os testes gráficos e IPC no GitHub Actions continuam executados independentemente.

**Estado:** esta autorização permite somente o diagnóstico estruturado já existente. A PR segue em rascunho e não habilita gerenciamento real de mods.


## Revalidação antes/depois de abrir e enumerar diretórios

A inspeção efetiva do Electron ganhou checkpoints de identidade em `electron/game-inspection.cjs`. Para cada pasta reconhecida, a rotina usa `lstat({bigint:true})` para registrar `dev`, `ino`, `mode`, `ctimeNs` e `mtimeNs`; compara esse conjunto **antes de abrir**, **após `opendir` mas antes de enumerar** e **ao concluir**. Se o alvo desapareceu, foi substituído ou apresenta atributos inconsistentes, a contagem é rejeitada. Para a raiz selecionada, também verifica o caminho real e a identidade antes, durante e depois da passagem pelos grupos. O handler Electron converte erros em mensagem genérica sem vazar paths.

O comportamento é intencionalmente conservador: instalações de jogos modificadas durante a contagem podem precisar de outra tentativa. Uma pasta ausente desde o início continua sendo classificada como não encontrada, e entradas de link não são percorridas intencionalmente. Nada recursa, abre conteúdo ZIP/SCS ou concede autorização de modificação.

**10 testes adicionais de segurança** exercitam diretórios temporários, mudanças na janela `lstat` → `opendir`, desaparecimento, links, recusa após detecção de alteração e funcionamento do contador em uma árvore estável. Testes que simulam metadados alterados usam um sistema de arquivos injetado exclusivamente na suíte Node, sem modificações na ponte do Electron.

**Limite de segurança importante:** esta revalidação é **best effort e fail-closed quando a mudança é observada**. As APIs `lstat` e `opendir` não compartilham necessariamente a mesma identidade nativa de handle. Um atacante pode alterar e restaurar caminhos entre os checkpoints (ABA); substituições transitórias ou junctions/reparse points específicos ainda exigem um adaptador por handle nativo e testes por filesystem. Portanto, não apresentar esta etapa como contenção completa, autorização de escrita ou proteção comprovada de mods.


## Contrato de integração ao processo principal: backend nativo ainda não conectado

`electron/inspection-executor.cjs` agora assume o papel do executor de leitura invocado pelo grant de uso único. A rotina real mantém o contador Node por checkpoints `lstat/opendir`. O retorno acrescenta um campo `provenance` destinado à interface: **`nativeDirectoryEnumeration:'not-connected'`**, identidade atômica não comprovada, ABA não excluído, compatibilidade não verificada, nenhuma leitura de conteúdo de mods e poderes `canInstall/canUninstall/canRecover/operationsEnabled:false`.

Foi criado um **porto de observação auxiliar futuro**, injetável exclusivamente pelo código do processo principal e exercitado com função simulada nos testes. A porta não é exposta por preload/IPC e não é ativada na distribuição. Quando uma sessão exige observação nativa (`requireNative:true`), a execução só acontece em Windows com a função explicitamente fornecida; ausência ou evidência inválida causa recusa **antes da inspeção Node**, sem fallback. Mesmo resultados aceitos são rotulados `auxiliary-untrusted-observation`, nunca `ABA-protected`.

A interface das telas existentes mostra o estado da origem do diagnóstico após a escolha da pasta, deixando clara a diferença entre a segurança do pedido pelo diálogo nativo e a ainda ausente integração dos handles nativos. A próxima etapa exige um backend nativo instalado, revisão de passagem de caminhos, isolamento por handle, e testes com substituição de diretórios reais sob várias modalidades de filesystem. Nenhuma instalação/remoção é permitida nesta revisão.
