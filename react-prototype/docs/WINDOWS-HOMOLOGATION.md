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
8. Faz uma **varredura automática das nove telas**, conferindo os títulos e a navegação ativa. Produz capturas completas na janela 1440×900 e também nos tamanhos de conteúdo 1024×768 e 850×650. Nesses dois últimos tamanhos, qualquer excesso horizontal significativo reprova o job.
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
