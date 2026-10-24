# Homologação da prévia OMSI Manager no Windows

Este checklist cobre o **protótipo isolado**, não o OMSI Manager principal. Os testes automatizados usam diretórios sintéticos e não conferem a instalação real dos jogos. **Não execute como administrador.** Nenhuma função de instalação/desinstalação está liberada.

## Evidências automatizadas do GitHub Actions

No workflow `React Prototype Validation`, o job **Windows portable preview (not signed)** agora:
1. Compila o React/TypeScript e roda os testes de segurança.
2. Empacota `OMSI-Manager-Preview.exe` com recursos em `resources/app.asar`.
3. **Abre o próprio executável portátil** usando Playwright no runner Windows (não usa `electron .` nem um servidor Vite).
4. Verifica que uma janela aparece, `app.isPackaged` está verdadeiro e o app é carregado de `app.asar`.
5. Confere isolamento do renderer: sem `window.require`, `window.process`, IPC bruto ou funções de instalar, remover e executar comandos.
6. Abre Jogos, usa um diálogo nativo **substituído por um retorno de teste** para selecionar uma pasta OMSI temporária fictícia, valida contagens e ausência de vazamento de caminho, e comprova que o arquivo sentinela não foi modificado.
7. Abre Detalhes e Segurança; confere relatório somente leitura e botões de instalação/remoção bloqueados.
8. Faz uma **varredura automática das nove telas**, conferindo os títulos e a navegação ativa. Produz capturas completas na dimensão inicial **efetiva** do runner, documentada em `screenshot-manifest.json`, e também nos tamanhos de conteúdo solicitados de 1024×768 e 850×650. Nesses dois últimos tamanhos, qualquer excesso horizontal significativo reprova o job.
9. Captura ainda o painel Detalhes com zoom do Chromium de 125% e 150%, preservando os controles bloqueados. **Zoom do Chromium não representa necessariamente a escala DPI real do Windows**.
10. Publica capturas do executável sob `windows-portable-runtime-screenshots`.
11. **Só se as etapas anteriores passarem**, compacta o ZIP portátil e publica SHA-256.

O teste não comprova a interação manual da janela de escolha de diretório no Windows nem a integridade de mods verdadeiros. Também não estabelece fidelidade visual pixel a pixel à interface Hydra.

## Procedimento no seu computador (pendente)

- [ ] Entre na execução **verde** do GitHub Actions e baixe o artefato `OMSI-Manager-Preview-Windows-x64-UNSIGNED`.
- [ ] Verifique se o artefato contém `OMSI-Manager-Preview-Windows-x64.zip` e o arquivo `.sha256`. Compare o hash SHA-256 do ZIP com o valor publicado; não execute se divergirem.
- [ ] Extraia o **ZIP inteiro** numa pasta sem privilégios administrativos; não tente executar apenas o `.exe` retirado da pasta.
- [ ] Execute `OMSI-Manager-Preview.exe` **sem elevar privilégios**. Caso o Windows alerte que o arquivo não é assinado, examine a origem e o hash antes de qualquer decisão. Não ignore alertas de segurança automaticamente.
- [ ] Verifique se a tela inicial abre e se a janela responde a maximizar, minimizar e fechar, em 100%, 125% e 150% de escala do Windows.
- [ ] Percorra as nove telas: Início, Jogos, Catálogo de mods, Minha biblioteca, Detalhes, Fila de tarefas, Histórico, Configurações e Segurança. Verifique cortes, botões inacessíveis e contraste.
- [ ] Em Jogos, escolha uma **pasta temporária de teste, vazia**. O relatório deve sinalizar estrutura desconhecida. Cancele a escolha e confira que o app não trava.
- [ ] Teste, **se desejar e sem necessidade de executar como administrador**, uma pasta real do OMSI 2 para verificar contagem de diretórios. A inspeção nunca deve ler o conteúdo ou alterar arquivos.
- [ ] Em Detalhes, confira a sequência teórica de dependências, a entrada de versão hipotética e o Relatório consolidado. Nenhuma mensagem deve dizer que um mod está definitivamente compatível.
- [ ] Confirme que `Instalar (bloqueado)` e `Remover (bloqueado)` não podem ser acionados em nenhum fluxo.
- [ ] Confira no Explorador que seus mods originais permanecem intactos e que nenhum instalador/desinstalador ou ferramenta de terceiros foi iniciado.

### Verificação do ZIP no PowerShell

Execute este comando **somente depois de obter o ZIP pelo GitHub**, adaptando o caminho para sua pasta de download:

```powershell
Get-FileHash -Algorithm SHA256 -Path '.\OMSI-Manager-Preview-Windows-x64.zip'
```

Compare o `Hash` com o conteúdo do `OMSI-Manager-Preview-Windows-x64.sha256`.

## Registro do resultado

Anote o Windows (edição e compilação), resolução/escala da tela, versão do pacote ou link exato da CI e se ocorreram: erro de abertura, falha de navegação, erro de leitura, congelamento, diferença visual, alerta de segurança. Não anexe logs contendo nomes de pastas pessoais sem remover essas informações.

**Critérios para sair do modo de rascunho:** execução da CI Windows verde, homologação manual documentada, revisão visual das nove telas, auditoria do backup original e desenho separado de permissões/backup/rollback. Não mesclar ou permitir operações destrutivas apenas porque o executável abriu.

## Teclado e acessibilidade (novos testes)

O protótipo oferece **Pular para o conteúdo principal** como primeiro elemento focável com `Tab` após abrir o aplicativo. `Enter` leva o foco ao conteúdo central. Os nove botões da navegação declaram nome acessível, inclusive quando a barra lateral está compacta, e só a tela ativa tem `aria-current="page"`.

A CI também testa se botões, entradas e seletores visíveis não passam pelas bordas horizontais da janela a 1024 e 850 pixels; isso é diferente de apenas verificar a ausência de uma barra de rolagem horizontal. O CSS respeita `prefers-reduced-motion` para animações decorativas. Testes do navegador exercitam teclado, foco, menu compacto, movimentação reduzida e limites de controles.

Na homologação física, também confira `Tab`, `Shift+Tab` e `Enter` nas nove telas; indicadores de foco, escolha de pastas com o diálogo nativo e navegação sem mouse. Os testes **não** substituem auditoria completa com leitor de tela, contraste ou verificação de DPI real do Windows.

## Auditoria automatizada de contraste (escopo declarado)

Uma rotina Playwright agora mede o **contraste calculado de textos representativos** em fundos sólidos das nove telas, usando 4,5:1 para texto comum e 3:1 para texto grande, com a fórmula de contraste do WCAG 2.x. A rotina também confere a presença de contorno visível no foco da barra de navegação, gera `test-results/contrast-audit.json` e publica esse relatório com as capturas no artefato `react-prototype-visual-review`.

A primeira correção foi no rótulo lateral `EXPLORAR`, cuja cor anterior tinha contraste insuficiente. A auditoria não cobre texto sobre gradientes complexos, capas Steam, ilustrações, translucidez, ícones isolados, imagens com texto, nem uma avaliação completa de WCAG, de leitores de tela ou de similaridade visual com Hydra. Esses itens exigem inspeção humana e, quando aplicável, ferramentas especializadas.

**Critério da CI:** um texto amostrado com relação de contraste abaixo do limiar reprova o teste, e o JSON identifica a tela, o seletor, as cores e a razão encontrada.

## Imagens, gradientes e ícones: segunda rodada da auditoria visual

As capas de OMSI 2, ETS2 e ATS podem ser obtidas online da Steam, mas **nunca devem ser necessárias para navegar**. O componente de capa mantém o cartão de fundo degradê e o título de cada jogo visível durante o carregamento e quando a imagem falha. Imagens remotas bem carregadas aparecem por cima apenas quando confirmadas como válidas.

A CI agora realiza:
- Simulação de falha nas imagens externas, sem interromper o servidor local de desenvolvimento; confere que o título e o desenho alternativo permanecem visíveis e registra `offline-game-covers.png`.
- Amostragem de pixels renderizados do **gradiente ao redor da área textual da página inicial**, verificando razão aproximada de contraste contra a cor computada do título e da descrição. Registra `gradient-sample.json`.
- Avaliação de ícones selecionados de navegação e status sobre fundos opacos, com limiar de 3:1, registrada em `icon-contrast.json`.

Todos esses arquivos, junto com o relatório anterior `contrast-audit.json`, ficam no artefato `react-prototype-visual-review` da CI.

**Limites explícitos:** a amostragem de gradiente lê pixels vizinhos ao texto, não todos os pixels sob cada glifo. A checagem de ícones abrange apenas os elementos selecionados e fundos opacos, não toda a interface. A imagem online pode estar indisponível e as capas alternativas não substituem a arte oficial ou uma comparação visual 1:1 com Hydra. Teste de conexão totalmente desligada no Windows físico, diferenças de GPU, transparências e conformidade WCAG completa continuam pendentes.

## Fidelidade visual: registro das dimensões reais

A revisão de capturas encontrou um erro de nomenclatura: o runner Windows limitava a largura inicial disponível, mas o arquivo tinha o sufixo `1440`. O novo teste não faz essa suposição. Cada captura de varredura possui entradas em `windows-portable-runtime-screenshots/screenshot-manifest.json`: largura e altura efetivas do viewport, escala de pixel, tamanho nativo da área de conteúdo e dimensões PNG. O sufixo das capturas iniciais agora usa `initial-<largura-real>`.

Uma avaliação visual comparativa foi iniciada e documentada em [HYDRA-VISUAL-REVIEW.md](./HYDRA-VISUAL-REVIEW.md), com referência pública da página oficial do Hydra. A paleta do protótipo foi aproximada de tons neutros; a organização e os cartões ainda **não** constituem réplica 1:1. Não usar o tamanho esperado da janela do Electron como se fosse a resolução de fato capturada.

## Rodada presencial: quadro de verificação em Detalhes

**Agora que o teste pode ser feito em um PC Windows**, manter a homologação manual dentro da prévia isolada, sem usar pastas com mods reais. Executar **somente a versão de uma CI verde**, após verificar o ZIP e seu checksum.

### Preparação sem risco

1. Abra [GitHub Actions da branch de prévia](https://github.com/nego001/omsi-manager-ui-preview/actions), selecione o último run **com jobs Linux e Windows verdes** e baixe o artefato `OMSI-Manager-Preview-Windows-x64-UNSIGNED`.
2. Dentro do artefato há um ZIP do aplicativo e o arquivo `.sha256`. Extraia ambos para uma pasta temporária. No PowerShell, sem administrador, execute `Get-FileHash .\OMSI-Manager-Preview-Windows-x64.zip -Algorithm SHA256` no diretório em que estiver o ZIP. Compare os caracteres da saída com os presentes no arquivo `.sha256`. **Se forem diferentes, não execute**.
3. Extraia o ZIP interno **inteiro**, mantendo `resources\app.asar` e os demais arquivos junto do `OMSI-Manager-Preview.exe`. Execute sem administrador. O build é **não assinado**; não desative o antivírus ou ignore alertas inesperados.
4. Crie uma pasta **fictícia** em um diretório próprio do Windows, por exemplo `OMSI-Manager-Teste-Vazio`, e, dentro dela, apenas subpastas vazias chamadas `Vehicles` e `Maps`. Nunca aponte inicialmente para diretórios verdadeiros do jogo.

### Verificações no aplicativo

- [ ] **Detalhes** abre o quadro `O que já sabemos sobre este mod` com quatro estados separados: metadados do catálogo, pasta do jogo, conteúdo do mod e compatibilidade com o jogo.
- [ ] Sem escolher pasta, o estado informa **Nenhuma inspeção de pasta realizada**; não mostra jogo/mod compatível ou instalado.
- [ ] **Consultar evidências e limitações** conduz ao `Relatório consolidado` sem acionar instalador.
- [ ] **Inspecionar pasta manualmente** apenas muda para a tela Jogos; não abre o seletor sozinho e não modifica nada.
- [ ] Em **Jogos**, clique em **Selecionar pasta e inspecionar** para OMSI 2 e escolha **somente** a pasta fictícia criada. O programa deve mostrar contagens de entradas e manter a conclusão **Compatibilidade não verificada**, nunca assumir que o jogo está instalado.
- [ ] Volte aos **Detalhes**. A etapa de pasta pode passar a indicar nomes de entradas examinados manualmente, mas **conteúdo do mod** e **compatibilidade** continuam não verificados.
- [ ] **Instalar (bloqueado)** e **Remover (bloqueado)** continuam desabilitados, antes e depois da inspeção.
- [ ] Confira a Biblioteca com favoritos, filtro por jogo/categoria, busca contextual, ordenação e retorno à Biblioteca a partir de Detalhes sem perder os filtros.
- [ ] Redimensione a janela e teste escala de exibição do Windows 100%, 125% e 150%, quando disponíveis. Anote cortes, textos ilegíveis e problemas de foco.

### Se encontrar um problema

Registre a **tela**, **passos exatos**, **largura/escala do Windows**, texto do alerta e, se possível, uma captura de tela sem dados pessoais. Não envie pastas de jogos, mods privados nem caminhos completos. Uma captura e os passos são suficientes para começar a reproduzir o defeito.

**Importante:** o seletor de pasta é real nesta verificação manual, enquanto o teste automático do Windows usa um retorno controlado. Inspecionar nomes de pasta não equivale a analisar arquivos internos do mod, validar sua compatibilidade ou instalar algo. O aplicativo original e backup permanecem fora do escopo.

## Teste no PC: alertas declarados da Biblioteca

A nova etapa visual usa o mesmo analisador de **relações em metadados JSON** na Biblioteca e em Detalhes. Para reproduzir com segurança **sem abrir nenhum mod verdadeiro**:

1. Baixe o JSON fictício [catalog.versions.example.json](../examples/catalog.versions.example.json) pelo GitHub, mantendo a extensão `.json`.
2. Na prévia portátil extraída de uma CI **verde**, entre em **Catálogo de mods > Importar catálogo JSON** e selecione esse exemplo. Esse carregamento só altera registros em memória, **não instala nem lê mods**.
3. Marque os três registros como favoritos: **Biblioteca de áudio (exemplo)**, **Som de motor (exemplo)** e **Pintura demonstrativa**.
4. Na **Minha biblioteca**, confira três cartões: o som de motor tem **bloqueio declarado** (a biblioteca de áudio declara versão menor que a exigida), a pintura tem **aviso declarado** (versão hipotética do jogo não informada) e a biblioteca de áudio fica **sem alertas declarados**.
5. No filtro **Alertas**, alterne entre essas opções. Cada uma mostra um dos registros da amostra. A etiqueta deve incluir **não verificado** em todos os casos, inclusive na opção sem alertas.
6. Abra o mod com bloqueio e confira o **Relatório consolidado**. O erro declarado deve aparecer no relatório, mas os botões **Instalar** e **Remover** permanecem desabilitados.
7. Use **Voltar à biblioteca** e confira se o filtro anterior foi preservado. Use **Limpar filtros da biblioteca** para restaurar a lista.
8. Repita em janela estreita e confira se os quatro controles (jogo, categoria, alertas e ordenação) não cortam o conteúdo.

**Limite essencial:** "sem alertas declarados" não significa compatibilidade, instalação, segurança ou funcionamento garantido. A amostra é fictícia e não contém um único caminhão, ônibus, mapa, textura ou áudio de jogo real.
