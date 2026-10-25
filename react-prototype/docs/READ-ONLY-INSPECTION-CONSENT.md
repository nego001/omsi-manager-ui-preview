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
