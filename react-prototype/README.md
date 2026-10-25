# OMSI Manager | Protótipo React + Electron isolado

Este projeto contém nove telas navegáveis de uma futura interface do OMSI Manager, em uma pasta separada do aplicativo original. **Não é a aplicação principal, nem uma restauração validada do backup.**

## Visão do ecossistema e etapa atual

**Fonte central de decisões:** [PRODUCT-DECISIONS-REGISTER.md](docs/PRODUCT-DECISIONS-REGISTER.md). Esse registro indica requisitos de todo o ecossistema, links técnicos, prioridades e estados (implementado, em andamento, planejado/bloqueado), inclusive Oficina, mods, segurança, loja e visão de UX. **Sempre consultá-lo antes de mudar o escopo do projeto.**

A visão transversal de automação do usuário foi registrada em [ECOSYSTEM-VISION.md](docs/ECOSYSTEM-VISION.md) e na [issue #2](https://github.com/nego001/omsi-manager-ui-preview/issues/2). A integração de **Oficina (skins e som)**, Biblioteca, Atualizador, Instalador e demais setores ao **mesmo resultado compartilhado** está em [SHARED-ANALYSIS-ECOSYSTEM.md](docs/SHARED-ANALYSIS-ECOSYSTEM.md) e na [issue #3](https://github.com/nego001/omsi-manager-ui-preview/issues/3), também como escopo futuro. O requisito de **leitura espalhada por módulos especializados e identificação conjunta para analisador/instalador** está detalhado em [DISTRIBUTED-MOD-READER.md](docs/DISTRIBUTED-MOD-READER.md), como arquitetura futura, sem acesso ou alterações a mods reais. Ela abrange identificação baseada em evidências de mods OMSI 2/ETS2/ATS, biblioteca com mídia autêntica, filtros, detecção de instalações, diagnóstico, adaptações versionadas, loja e operações transacionais com backup/rollback.

**Etapa em desenvolvimento:** acabamento visual e informativo da Biblioteca e Detalhes. A Biblioteca filtra **favoritos declarativos** por jogo e categoria; não representa um inventário de mods realmente instalados. Detalhes mostra **arte ilustrativa do próprio registro de mod**, identificada como ilustração, em vez de exibir erroneamente a capa do jogo como foto do mod. Estados de compatibilidade e instalação reais permanecem não verificados. Não existe instalador ou atualizador habilitado.

## Telas

1. Início
2. Jogos (OMSI 2, ETS2, ATS)
3. Catálogo de mods
4. Minha biblioteca (favoritos salvos localmente)
5. Detalhes
6. Fila de tarefas
7. Histórico
8. Configurações
9. Segurança

O catálogo é fictício. Os favoritos e as preferências visuais são persistidos apenas no armazenamento local do navegador/Electron, com IDs permitidos e sem arquivos dos jogos. Os cartões de mods usam arte **ilustrativa distinta**; as capas oficiais aparecem na seleção dos jogos. As capas dos jogos são buscadas da CDN pública da Steam no navegador (sem redistribuí-las neste repositório). Se uma capa não carregar, há um visual alternativo.

## Execução

Requisitos: Node.js 22+, npm e sistema operacional compatível com Electron.

```bash
cd react-prototype
npm install
npm run desktop:dev
```

Comandos auxiliares:

- `npm run dev`: apenas a interface no navegador, sem Electron.
- `npm run build`: verificação TypeScript e geração de `dist/`.
- `npm run desktop`: abre a interface compilada no Electron.
- `npm test`: Playwright, filtros, navegação, proteção e capturas visuais.
- `npm run test:security`: contratos estáticos das opções seguras e URLs permitidas.
- `npm run test:desktop`: abre a janela Electron e verifica o preload seguro, sem tocar em jogos. No Linux headless, usar `xvfb-run -a npm run test:desktop`.

## Limites de segurança

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`.
- Sem `ipcRenderer` genérico exposto, sem leitura de conteúdo de arquivos, sem execução de comandos nem APIs do instalador. Existe apenas uma função IPC limitada de inspeção manual de diretórios (veja abaixo).
- Downloads, permissões da sessão, abertura de janelas e navegação externa bloqueados.
- Botões de instalação e desinstalação desativados por construção.
- Apenas a inspeção manual e não recursiva de subpastas específicas é permitida após o usuário selecionar uma pasta; não há varredura automática de instalações, cópia de arquivos ou alterações de mods.

## Validações e próximos passos

As capturas de todas as nove telas são exportadas pela CI no artefato `react-prototype-visual-review`. Usá-las para comparar com a referência original, que não acompanha este repositório. Fidelidade **1:1 não está confirmada**.

Somente depois de recuperação independente do backup, auditoria técnica e testes de integridade, rollback, permissões e caminhos será possível projetar uma ponte IPC de **leitura** para uma branch de integração. Ações que escrevem ou removem arquivos exigem escopo e homologação separados.

**Não mesclar este protótipo diretamente no código principal até a revisão visual e de segurança.**

## Catálogo JSON personalizado (somente metadados)

Na tela **Catálogo de mods**, escolha **Importar catálogo JSON** e selecione um arquivo local. Exemplo: [`examples/catalog.example.json`](./examples/catalog.example.json).

```json
{
  "schemaVersion": 1,
  "mods": [{
    "id": "omsi-bus-demo",
    "title": "Ônibus de exemplo",
    "game": "omsi",
    "category": "Ônibus",
    "version": "1.0",
    "description": "Apenas informações do catálogo.",
    "size": "250 MB"
  }]
}
```

Jogos aceitos: `omsi`, `ets2`, `ats`. Categorias: Ônibus, Mapas, Caminhões, Sons, Gráficos. Aceita até 200 mods em arquivo JSON de até 1 MB. IDs devem ser únicos e usar letras minúsculas, números, hífen e underscore. Campos extras não são permitidos; não há suporte a paths, URLs, scripts, executáveis ou instruções de instalação.

O arquivo é lido **somente após seleção explícita do usuário** pela API de arquivos do navegador. Ele não é copiado, aplicado, instalado, enviado a servidor ou persistido pelo aplicativo. Ao reiniciar/recarregar, volta o catálogo demonstrativo. Os favoritos armazenados localmente não contêm os dados importados e são limpos quando se troca a origem do catálogo.

Esta é uma **etapa de integração de metadados**, não detecção de mods instalados nem restauração do backend original.

## Prévia portátil para Windows (sem instalador)

Uma segunda job da CI, `Windows portable preview (not signed)`, compila a interface e usa `@electron/packager` para montar **uma pasta portátil** dentro de `OMSI-Manager-Preview-Windows-x64.zip`. Este arquivo é publicado como artefato temporário do GitHub Actions, não como release e não como substituição para o OMSI Manager real.

Depois de baixar o artefato no GitHub Actions: descompacte **a pasta inteira** e execute `OMSI-Manager-Preview.exe` nela. Não arraste apenas o EXE, pois ele precisa das DLLs e da pasta `resources`. O binário **não tem assinatura digital** e pode acionar alertas do Windows; evite contornar avisos de segurança sem conferir sua procedência e o status dos testes. Não execute com privilégios de administrador.

O ZIP da prévia não inclui mods, instalações do Steam, banco de dados, jogo, relatórios privados nem código do backup do OMSI Manager. Ele não tem botão funcional para instalar ou remover mods.

Uma CI verde atesta o build/empacotamento automático, mas **não substitui testes manuais no Windows e uma revisão de assinatura/distribuição**.


## Inspeção opcional de pastas (novo)

No **aplicativo Electron**, em **Jogos → Inspeção local**, clique em `Selecionar pasta e inspecionar` no jogo correspondente. O sistema abre um diálogo **nativo**, e só inspeciona a pasta que a pessoa escolheu naquele momento.

- OMSI 2: contagem direta das entradas em `Vehicles`, `maps`, `Sceneryobjects` e `Splines`.
- ETS2 e ATS: selecione **a própria pasta `mod`** ou **a pasta acima dela** (frequentemente a pasta de documentos do jogo, separada da Steam). O aplicativo conta entradas diretas da pasta `mod`, distinguindo subpastas, arquivos e **candidatos** `.scs`/`.zip` apenas pela extensão, sem abrir nenhum arquivo.
- Limite de **2.000 entradas inspecionadas por subpasta**, incluindo links ignorados; contagem parcial indicada quando houver itens adicionais. Sem recursão, hash, leitura de conteúdo, extração de arquivos, execução de executáveis ou modificação dos jogos.
- Pastas-alvo que são links simbólicos são recusadas; também não segue links internos.
- A interface só recebe o **nome da pasta principal**, contagens e indicadores de presença/limite, nunca caminhos completos nem nomes de arquivos.
- O renderer aceita apenas os identificadores `omsi`, `ets2` e `ats`. Não envia nomes de diretórios nem caminhos arbitrários ao processo principal.
- A solicitação IPC exige que a origem seja a página principal autorizada do próprio aplicativo. IPC bruto, Node.js, filesystem e shell **não são expostos** ao renderer.
- Nenhum dado da inspeção é persistido ou enviado à rede. Uma pasta sem estrutura conhecida é exibida como **não reconhecida**, sem afirmar que o jogo está instalado.
- No navegador comum, os três botões de inspeção ficam desabilitados.

A inspeção é **experimental e somente leitura**, não substitui detecção automática de instalações e não comprova a compatibilidade dos mods. A inspeção de arquivos reais do usuário ainda precisa ser homologada num Windows físico; os testes de CI usam exclusivamente pastas temporárias sintéticas.

Comandos de validação: `npm run test:security`, `npm test` e `npm run test:desktop`.

## Homologação automatizada do seletor nativo

O teste `npm run test:inspection:e2e` abre a janela Electron e intercepta o **seletor de pastas apenas no processo de teste**, fornecendo um diretório temporário sintético. Confere a contagem de subpastas OMSI 2 na interface, cancelamento, rejeição de IDs inválidos, ausência de divulgação do caminho absoluto, bloqueio de diálogos simultâneos e preservação de um arquivo sentinela.

No Linux sem tela: `xvfb-run -a npm run test:inspection:e2e`. A CI executa esse teste antes de considerar o protótipo aprovado.

A janela real de escolha de pasta ainda precisa ser testada presencialmente no Windows. O teste com simulação não autentica detecção de instalações Steam, não lê nenhum mod verdadeiro e não libera instalação/desinstalação.

### Interpretação dos resultados

**Pastas e arquivos são entradas, não necessariamente mods instalados.** Um arquivo `.scs` ou `.zip` recebe o rótulo de *candidato*, sem qualquer validação do formato, versão, integridade, ativação, conflito ou compatibilidade. Pastas reconhecidas não comprovam a presença nem a instalação do jogo. O diagnóstico registra avisos quando nada é encontrado, há links ignorados ou a contagem está truncada. Os arquivos não são abertos, e o aplicativo não recebe seus nomes.

### Pré-checagem estrutural vs. compatibilidade

O resultado traz uma avaliação explícita `assessment.compatibilityVerified=false` e `assessment.installationVerified=false`. A presença de pastas ou arquivos nunca é interpretada como prova de instalação ou funcionamento. A inspeção mostra avisos para estrutura parcial de OMSI 2, pasta `mod` vazia e seleção direta da pasta `mod`. Não lê manifesto, versão mínima do jogo, arquivos `.scs`, banco de dados nem scripts de mods; portanto **não é possível afirmar se um mod é compatível somente com esta inspeção**.

Os testes de segurança executados na CI cobrem os dois formatos de seleção da pasta de ETS2/ATS, pasta vazia e estrutura parcial do OMSI, além do fluxo de seleção de pasta via Electron com conteúdos sintéticos.

## Relações entre mods: simulação de dependências e conflitos

O JSON de catálogo na versão `schemaVersion: 1` aceita dois campos **opcionais e somente declarativos** por registro:

- `requires: ["id-do-mod"]` indica IDs que o registro declara como necessários.
- `conflictsWith: ["id-do-mod"]` indica IDs que o registro declara como conflitantes.

Ambos aceitam até 20 IDs, minúsculos, únicos e no formato de IDs já validado. Caminhos de disco, comandos, URLs, scripts e chaves extras continuam proibidos. IDs ausentes são aceitos na importação e **sinalizados no diagnóstico**, de modo que catálogos incompletos sejam auditáveis; referências a outro jogo são sinalizadas e ciclos são detectados.

Na tela **Detalhes**, o painel **Dependências e conflitos · simulação** ordena as dependências declaradas do mesmo jogo, detecta ciclos e destaca conflitos dentro da sequência ou com IDs externos. Um conflito declarado com um registro fora da sequência aparece apenas como alerta, pois o aplicativo **não sabe se esse mod está instalado**.

Exemplo: [`examples/catalog.dependencies.example.json`](./examples/catalog.dependencies.example.json). Esse exemplo é fictício e não entrega nenhum mod. **Uma sequência sem erros no JSON não autoriza instalação nem comprova compatibilidade, integridade, versão, dependências reais ou ausência de conflitos nos arquivos.** Instalação e desinstalação seguem bloqueadas.

As verificações são inteiramente em memória, sem IPC, sem ler arquivos de jogos e sem escrever em disco.

## Requisitos de versões (somente declarações do catálogo)

Além de `requires` e `conflictsWith`, cada mod do JSON `schemaVersion: 1` pode declarar:

- `gameVersionRange: {"min":"1.50","max":"1.55"}`. Ambos opcionais individualmente, mas o objeto deve ter pelo menos um, com mínimo menor ou igual ao máximo.
- `requiresMinVersions: [{"id":"outro-mod","minVersion":"2.2"}]`. Cada ID precisa existir em `requires` no próprio registro. No máximo 20 requisitos, sem repetição.

O comparador aceita apenas versões numéricas de **1 a 4 componentes**, separados por ponto, sem prefixo `v`, rótulos `beta`, sufixos ou intervalos automáticos. Por exemplo `1.52` e `1.52.0` são equivalentes; `1.10` é maior que `1.9`. Versões fora desse formato **não são adivinhadas**: em requisitos de dependência, o diagnóstico as sinaliza como não comparáveis.

A pessoa pode preencher em **Detalhes → Versão hipotética do jogo** um valor para testar uma regra declarada. Não é autodetecção e não há leitura do Steam, registro do Windows, executáveis nem arquivos do jogo. Sem valor informado, o diagnóstico registra que a condição do jogo não foi verificada. A comparação de versão dos mods usa **exclusivamente o número publicado no JSON**, não o mod instalado.

Exemplo demonstrativo: [`examples/catalog.versions.example.json`](./examples/catalog.versions.example.json). Contém propositalmente uma dependência declarada em versão insuficiente para demonstrar alertas.

**“Nenhum bloqueio lógico no JSON” não é sinal de compatibilidade real, segurança, integridade ou autorização para instalar mods.** Instalação e remoção continuam permanentemente desativadas nesta prévia.

## Relatório consolidado de diagnóstico

Na tela **Detalhes → Relatório consolidado**, o protótipo agora agrupa informações antes apresentadas separadamente:

- **Metadados:** bloqueios declarados em dependências, conflitos e versões, avisos, sequência teórica e origem do catálogo JSON.
- **Pastas (opcional):** se a pessoa inspecionou uma pasta para aquele jogo nesta sessão, inclui contagens e avisos de estrutura. Não mistura resultados do OMSI com ETS2/ATS.
- **Escopo:** sempre mostra claramente o que falta verificar, como versão instalada do jogo, presença real de mods, integridade, ativação e compatibilidade.
- **Estado final:** somente “Inconsistências no catálogo” ou “Revisão manual obrigatória”, nunca “compatível”, “seguro” ou “pronto para instalar”.

O relatório é calculado em memória. Não grava histórico, não envia dados à rede, não exporta arquivos e não acessa APIs privilegiadas. O relatório de inspeção de pastas anterior é volátil: uma nova execução do aplicativo exige nova seleção manual. O nome da pasta pode ser visto na tela original de inspeção, mas **não é copiado para o relatório consolidado**.

A primeira seção **Dependências e conflitos · simulação** permanece para mostrar a ordem detalhada; o relatório abaixo dela resume as informações e separa suas origens. Sua contagem de entradas não equivale a número de mods.

Os testes automatizados cobrem catálogo sem bloqueios, versão incompatível, inspeção ausente/erro/parcial, proteção contra mistura de jogos, apresentação dos resultados na interface e E2E do Electron com pastas inteiramente sintéticas. O processo de instalação e desinstalação permanece bloqueado.


## Laboratório isolado: recuperação após término de processos

Há um teste de integração do Node.js em `scripts/temp-recovery-fixture.test.cjs` que cria **somente diretórios temporários e fictícios**, grava marcadores de preparo/intenção/publicação, encerra um processo filho intencionalmente e inicia outro processo para verificar o estado encontrado. Também testa corrupção, gerações/sessões incompatíveis, tentativa de reutilização, proteção de caminho e arquivo sentinela.

Execute com `npm run test:recovery:fixture`. A suíte é exigida nas CI Linux e Windows **antes do empacotamento** e os arquivos da pasta `scripts` são excluídos do aplicativo portátil por `scripts/package-windows.mjs`.

**Limites:** término explícito por `process.exit(91)` não é queda de energia nem crash do sistema operacional; sincronização de arquivos não prova durabilidade do diretório. Os registros encontrados continuam **não confiáveis** e não autorizam recuperar, editar, instalar, remover ou atualizar mods. Não existe journal real nem qualquer novo IPC. Detalhes: [TEMPORARY-RECOVERY-PROCESS-LAB.md](docs/TEMPORARY-RECOVERY-PROCESS-LAB.md). A PR permanece draft e não deve ser mesclada sem homologação física.


### Concorrência e encerramento forçado em duas sessões artificiais
O mesmo laboratório passou a incluir `scripts/temp-recovery-concurrency.test.cjs`. Dois processos Node distintos disputam um único **arquivo de reivindicação fictício** criado com `open('wx')`. Somente um consegue criá-lo enquanto o outro recebe `busy`. O processo vencedor pode ser encerrado à força por `SIGKILL` (ou terminação de processo equivalente no Windows); o arquivo remanescente não é removido automaticamente nem tratado como um bloqueio nativo válido.

A leitura do arquivo é sempre não confiável, mesmo com conteúdo bem formado; fraude, sessão falsa, arquivo truncado, marcador de outra pasta e caminho arbitrário são recusados. A suíte executa em Linux e Windows pelo mesmo `npm run test:recovery:fixture`, separado de Electron e da prévia distribuída.

**Isto não implementa lock de sistema operacional, lease com expiração confiável, remoção segura de arquivo órfão, escrita em mods ou recuperação de dados reais.**


### Revisão somente leitura de registros órfãos
O comando `npm run test:recovery:orphan` cobre mais 18 testes sobre arquivos artificiais: processo detentor vivo ou encerrado, troca de conteúdo com o mesmo tamanho, remoção e substituição de arquivos entre inspeções, links simbólicos quando permitidos, adulteração do marcador de origem, privacidade e isolamento entre fixtures.
A nova inspeção calcula uma impressão digital **somente para detectar mudanças no laboratório**, sem conceder identidade nativa ao arquivo. Comparações de PID e de uma etiqueta de início de processo são apenas **informações artificiais fornecidas aos testes**. Um PID igual pode pertencer a outro processo; nenhum PID ou etiqueta, mesmo coincidente, libera recuperação ou limpeza. O teste reaproveita a CI Linux e Windows existente: `npm run test:recovery:fixture` passa a reunir **46 casos Node de laboratório** (15 iniciais, 13 de disputa e 18 de revisão órfã).


### Identidade observada do arquivo e do processo (testes temporários)
O laboratório de recuperação passou a incluir `scripts/temp-recovery-identity.cjs`: obtém um handle real de leitura de **um arquivo fictício limitado a 4096 bytes** numa pasta descartável do teste, compara observações de `lstat` e `FileHandle.stat` antes/depois de ler, e usa SHA-256 exclusivamente como detector de mudança local. Após substituição, corrupção do marcador ou alteração dos bytes, a leitura deixa de ser considerada estável; nenhuma informação do arquivo é exposta no retorno.

Para processos, guarda uma referência a um `ChildProcess` que o próprio teste iniciou, sem resolver identidades por PID declarado. O fim desse subprocesso pode ser observado sem liberar um lock ou instalar mods. Todos os caminhos retornam `nativeIdentityProven:false` / `processIdentityVerifiedForRecovery:false` e `operationsEnabled:false`, inclusive quando o PID do relatório bate com o do subprocesso.

O comando `npm run test:recovery:identity` executa os **22 novos testes Node**. O comando principal `npm run test:recovery:fixture` inclui os testes anteriores, total esperado **68 testes do laboratório**, rodados pelo GitHub Actions em Linux e Windows. Tudo isso continua fora da distribuição Electron; nada muda no acesso real a mods. Ver [contrato de identidade nativa](docs/NATIVE-IDENTITY-ACCEPTANCE.md).


### Windows: primeira observação nativa do FileIdInfo em arquivos de laboratório
A prévia adicionou uma sonda `scripts/temp-native-file-id.ps1` que usa PowerShell + C# P/Invoke das APIs do Windows `CreateFileW` e `GetFileInformationByHandleEx`, **somente dentro de uma pasta temporária fictícia com marcador validado**. O identificador de arquivo nativo e o serial de volume são lidos de *dois handles reais, somente leitura*, e combinados com um hash do conteúdo limitado a 4096 bytes. Apenas uma impressão digital vinculada ao nonce temporário é exposta à suíte Node. Caminhos, volume bruto, FileId e bytes não aparecem no relatório público do teste.

`npm run test:identity:windows` roda dez testes desta rotina em Windows; em Linux, os testes específicos da API Windows são ignorados, mantendo o restante da suíte multiplataforma ativo. `npm run test:recovery:fixture` executa todas as suítes de laboratório, **78 casos no total**, com estes dez verificados somente no Windows. Os testes cobrem identidade estável, mudança de bytes, substituição por outro arquivo idêntico, arquivo inválido, link, caminho fora do escopo e uma sentinela externa preservada.

**Isso é uma prova de laboratório, não um adaptador de recuperação em produção.** Ainda não demonstra segurança contra TOCTOU/ABA hostil, reparse points em todos os volumes, persistência após falta de energia ou permissão de instalação. A pasta `scripts/` segue excluída do executável portátil. Nenhum IPC novo ou leitura de arquivos de jogos foi acrescentado.


### Windows: observação nativa de subprocesso controlado pelo laboratório

`scripts/temp-native-process-id.ps1` inicia **seu próprio subprocesso descartável** (PowerShell em repouso) e obtém uma referência nativa por `OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE)`. A partir do mesmo handle, consulta `GetProcessId`, `GetProcessTimes` e `WaitForSingleObject`, observa o encerramento real de um processo **que o próprio teste criou** e fecha todos os handles. Não recebe PIDs arbitrários do usuário, nem consulta outros processos do computador.

`npm run test:identity:process:windows` inclui 11 testes Windows: processo próprio vivo ou encerrado, estabilidade no mesmo handle, PID e tempo de criação falsificados, recusa de pasta/marcador inválidos, cenário não permitido, privacidade e sentinela externa. `npm run test:recovery:fixture` reúne **89 testes Node de laboratório** (68 gerais + 10 FileIdInfo + 11 processo Windows); no Linux, os 21 testes exclusivos do Windows são ignorados intencionalmente.

**Importante:** a observação real por handle vale apenas para o subprocesso artificial controlado pela suíte. Não demonstra proteção completa contra PID reciclado, posse de locks de outro processo, acesso a mods, recuperação ou autorização para instalar. Esta rotina fica na pasta `scripts/`, excluída do pacote Electron, sem novos comandos IPC.


### Concorrência nativa Windows: dois processos e um arquivo fictício

`scripts/temp-native-file-race.ps1` abre um handle **Win32 somente leitura** para `identity-target.bin` dentro de um diretório temporário vinculado ao marcador do laboratório. Após obter `FileIdInfo` e bytes de até 4096 B, sinaliza `READY` ao processo Node que o iniciou e mantém o handle aberto. O outro processo pode alterar, truncar, anexar, renomear ou excluir **somente essa fixture**, e então responde `CONTINUE`. O observador verifica bytes e ID no handle original e usa **um segundo handle** para reabrir o caminho. Divergências, remoções e novas identidades tornam o resultado `changed-or-unavailable`, sem autorizar ações.

O comando `npm run test:identity:race:windows` acrescenta **11 testes Windows-only** (incluindo invalidação do marcador e encerramento forçado antes de continuar). A suíte `npm run test:recovery:fixture` passa a totalizar **100 testes Node**, dos quais 32 dependem da API Windows e são ignorados intencionalmente no Linux. Quando um filesystem Windows recusa renomear/excluir um arquivo aberto, o teste registra `skip` e não alega ter exercitado a troca. A sonda não integra Electron, IPC ou distribuição, e não é uma solução de TOCTOU pronta para produção.


### Troca determinística de pathname após liberação do handle

O laboratório nativo Windows em `temp-native-file-race.ps1` ganhou um **segundo modo, `released`**, no qual observa `FileIdInfo` e os bytes, **fecha a referência nativa de leitura**, emite a barreira `READY` e só depois reabre o pathname para comparar com o snapshot anterior. Dessa maneira o Windows pode aceitar `rename`/substituição sem contornar as regras de compartilhamento de um handle aberto. `held` continua disponível para checar alterações enquanto a referência permanece viva.

Foram adicionados **7 testes**: arquivo preservado, substituição por outro de mesmo conteúdo com ID diferente, remoção e recriação, remoção sem reposição, dois observadores concorrentes, marcador adulterado e troca `ABA` (o original sai e depois retorna). O caso ABA deliberadamente registra uma observação estável como **não confiável**: a comparação entre duas amostras não consegue provar que nenhuma mudança ocorreu entre elas. O relatório registra `abaRuledOut:false` e continua negando toda operação real.

O laboratório passa a contar **107 casos Node**, com 68 multiplataforma e 39 exclusivos do Windows. A interface e o pacote Electron permanecem inalterados, e `scripts/` continua excluída da distribuição.


### Recibos de observação não reutilizáveis e revogação de sessão (somente testes)

`scripts/temp-evidence-lifecycle.cjs` cria uma sessão de observação vinculada a um **handle de arquivo temporário**, por meio do laboratório existente `temp-recovery-identity.cjs`. Cada leitura bem-sucedida emite um recibo **opaco, somente em memória, guardado em `WeakMap`**, válido unicamente para identificar *qual foi a última observação* dessa sessão. O recibo **não é autorização para instalar, modificar ou recuperar mods**.

O encerramento da sessão revoga todos os recibos *antes* de o fechamento assíncrono do handle terminar. Uma mudança de conteúdo detectada ou falha de validação do marcador revoga irreversivelmente a sessão. Outra sessão terá outra identidade mesmo se o arquivo antigo voltar a ter o mesmo caminho, conteúdo e identificador depois de uma troca ABA. Cópias JSON e recibos de outra sessão ou de outro processo não recuperam estado.

O novo comando `npm run test:evidence:lifecycle` executa **19 testes Node** em Linux e Windows, integrados também a `npm run test:recovery:fixture`: agora são **126 testes de laboratório** (87 multiplataforma e 39 Windows-only). Há cobertura de fechamento concorrente, evidências antigas, erros, clones, reinicialização de processo de teste, isolamento entre fixtures e ausência de vazamento de dados.

**Limite importante:** a sessão não tem lock nativo exclusivo e não garante que ninguém tenha trocado o arquivo entre duas leituras ou que o pathname permaneceu imutável enquanto o handle esteve aberto. Mesmo recibos recentes continuam `abaRuledOut:false` e `operationsEnabled:false`. A implementação é exclusiva de `scripts/`, excluída do executável Electron.


### Autorização efêmera de inspeção real pelo diálogo nativo do Electron

A prévia já possuía inspeção **somente leitura** de diretórios escolhidos pela pessoa, com contagem superficial de `Vehicles/maps/Sceneryobjects/Splines` ou `mod` e identificação de candidatos `.scs/.zip` apenas por nome.

Agora `electron/inspection-grant.cjs` vincula a seleção do diálogo nativo a um **grant efêmero e de uso único**, privado do processo principal. A autorização expira após 15 segundos, não pode ser copiada por JSON e vincula a inspeção a um `webContents` e identificador de jogo específicos. A origem é verificada antes do diálogo, depois da escolha e antes de entregar o resultado. O renderer continua sem poder fornecer caminhos para escanear ou solicitar escrita.

**18 testes Node novos** estão incluídos em `npm run test:security`, que passa de **14 para 32 testes** se a CI validar a revisão. A suíte anterior de 126 testes do laboratório continua separada, assim como as 744 verificações Playwright. O pacote Electron permanece só de leitura, sem novas operações de instalação, backup, desinstalação ou recuperação real.

**Limitação:** uma autorização de interface não equivale a identificação atômica de diretórios por handle; ainda existem possíveis janelas TOCTOU entre `lstat` e `opendir`. Veja [consentimento para inspeção somente leitura](docs/READ-ONLY-INSPECTION-CONSENT.md).


### Verificação de identidade de diretórios no diagnóstico real (conservadora)

`electron/game-inspection.cjs` agora compara informações da mesma pasta obtidas por `lstat({bigint:true})` em três momentos: **antes de `opendir`, imediatamente depois da abertura (antes de enumerar) e após a contagem**. As comparações incluem volume/dispositivo (`dev`), inode (`ino`), modo, `ctimeNs` e `mtimeNs`. Se a identidade mudar, o diretório desaparecer durante a inspeção ou virar um link, **o resultado é recusado** em vez de exibir contagens possivelmente enganosas. A identidade da raiz escolhida também é verificada ao resolver o caminho e entre cada grupo de OMSI/ETS2/ATS.

Foram adicionados **10 testes Node em Linux/Windows**, incluindo troca determinística de diretório antes da abertura, mudança durante a enumeração, desaparecimento, simulação de links e raiz substituída. A meta de segurança cresce de 32 para **42 testes Node**. O limite de 2.000 entradas e a leitura superficial por nomes permanecem. **Não há leitura de bytes de mods nem operações de escrita.**

Esta defesa é uma **detecção conservadora entre checkpoints**, não uma garantia de não seguir redirecionamentos em todas as condições: `fs.opendir` não é vinculado a um identificador de handle verificado e não exclui **ABA entre verificações ou TOCTOU hostil**. Nenhuma instalação/remoção é habilitada. Veja [escopo da inspeção](docs/READ-ONLY-INSPECTION-CONSENT.md).


### Enumeração de diretórios por handle real do Windows, exclusivamente em testes

A sonda `scripts/temp-native-directory-enum.ps1` abre **um diretório fictício chamado `native-enum`** dentro da fixture marcada no `os.tmpdir()` com `CreateFileW`, `FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT` e acesso `FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES`. Em seguida consulta `FileAttributeTagInfo` e `FileIdInfo` do próprio handle e percorre as entradas com **`GetFileInformationByHandleEx(FileIdBothDirectoryRestartInfo / FileIdBothDirectoryInfo)`**, interpretando registros nativos `FILE_ID_BOTH_DIR_INFO` de comprimento variável, sem recursão ou leitura de conteúdo.

O relatório retorna **somente contagens**, diferencia diretórios, arquivos, links/reparse e candidatos `.scs/.zip` pelo nome; não expõe nomes individuais, identificadores nativos ou caminhos. Verifica a identidade do handle e seus tempos de alteração antes/depois, e reabre o mesmo pathname num segundo handle para detectar substituição observável. O orçamento deliberadamente pequeno da prova é **128 entradas**: qualquer excedente ou registro inesperado recusa a observação, sem retorno parcial.

`npm run test:identity:directory:windows` executa **12 cenários Windows-only**. `npm run test:recovery:fixture` agrega esses testes à matriz existente, agora com **138 testes Node** (87 multiplataforma e 51 exclusivos Windows); no Linux os 12 novos casos recebem skip intencional. O pacote Electron e seu handler `preview:inspect-game` **não importam nem executam a sonda**. A enumeração do aplicativo real continua a existente em `electron/game-inspection.cjs`, com checkpoints de identidade conservadores.

Mesmo sendo enumeração real por handle do Windows dentro da fixture, a prova **não demonstra eliminação total de ABA/TOCTOU, contenção de pastas de jogo, autenticidade de arquivos ou locks de produção**. Todos os campos de permissão permanecem false; instalação, remoção e recuperação não são habilitadas.
