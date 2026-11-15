# OMSI Manager: Linux desktop preview (experimental)

**Scope:** native Linux x64 Electron **read-only UI preview**, with native folder dialog and structural inspection of user-selected, synthetic or explicitly consented folders. This is **not** a completed OMSI 2/openOMSI mod manager or Proton/Wine adapter. Installation, removal, repair, writes to real mods and automatic discovery of game folders remain disabled.

## Build and test

From `react-prototype/` with Node.js 22 and supported Linux desktop libraries:

```bash
npm install --no-audit --no-fund
npm run build
npm run test:security
npm run test:witness:portable
npm run package:linux
xvfb-run -a npm run test:portable:linux
```

The CI build on Ubuntu runs this same packaged-ELF smoke test after the normal Playwright and Electron checks. The test verifies an actual Linux ELF, loads the app from `app.asar`, verifies Electron/renderer isolation and disabled operations, opens the GUI and reads **only the names/counts** from a generated dummy `Vehicles` and `maps` tree. It also verifies that the dummy .bus file is byte-for-byte unchanged and that the fixture path is not leaked to the renderer.

## Portable archive and future Arch use

When the Linux CI job is green it uploads an **unsigned** portable Linux x64 artifact containing `OMSI-Manager-Preview-Linux-x64.tar.gz` and `OMSI-Manager-Preview-Linux-x64.sha256`. Check the checksum before extracting and never run an untrusted binary with root permissions. This experimental artifact is built on Ubuntu, not Arch Linux; compatibility with Arch graphics drivers, Wayland compositors, Hyprland and Steam/Proton game prefixes has **not** been established.

```bash
sha256sum -c OMSI-Manager-Preview-Linux-x64.sha256
tar -xzf OMSI-Manager-Preview-Linux-x64.tar.gz
./OMSI-Manager-Preview-linux-x64/OMSI-Manager-Preview
```

No `pacman` package, automatic desktop integration, systemd unit, auto-update process or application installer is delivered; an optional user-only XDG shortcut helper is documented below. Avoid `sudo`, disabling Electron's sandbox, or modifying game folders to make a preview run. If the native preview fails to launch, collect application stderr and system information in a **separate** troubleshooting step rather than bypassing security.

## Cross-platform architecture and remaining work

- UI and Electron security policy are shared between Windows/Linux; the renderer cannot execute shell commands or write mods.
- The existing game-directory inspection only counts structural folder entries and selected file extensions; a successful scan does not establish mod compatibility.
- Win32 handles, NTFS timestamps, C# directory observer and PowerShell fault injectors are **Windows-only laboratory components**, excluded from packaged Electron builds.
- Next candidates: Linux permission isolation and symlink/race hardening for production design, non-mutating discovery of Proton/openOMSI folders only with explicit consent, Hyprland/Wayland smoke tests, and proper package/release provenance.
- Real mod operations remain blocked by `operationsEnabled:false`, `supportsRealGameInspection:false`, `guaranteesNoABA:false`, and `atomicPathContainmentProven:false`.

Keep the pull request in draft; nothing in this document authorizes merging or touching an installed game.

## Wayland/Hyprland preparation

Electron 38 uses automatic Ozone backend selection. On a normal `XDG_SESSION_TYPE=wayland` session, it should select native Wayland without extra flags: see the official [Electron 38 breaking changes](https://www.electronjs.org/docs/latest/breaking-changes). The portable archive includes the relative launcher `OMSI-Manager-Preview.sh`, so relocating the extracted folder does not hardcode a machine-specific installation path.

- The default launcher respects Electron's automatic backend detection.
- Setting `OMSI_MANAGER_NATIVE_WAYLAND=1` on the launcher explicitly requests `--ozone-platform=wayland` for diagnosis. Neither mode passes `--no-sandbox`, requests administrator privileges or auto-discovers game files.
- A packaged smoke test is added against an ephemeral **real Wayland socket** served by Weston headless, with `DISPLAY` empty and the explicit Wayland switch asserted by Electron.
- Automatic backend regression: the same packaged launcher is restarted **without** `OMSI_MANAGER_NATIVE_WAYLAND=1`, still with `DISPLAY` empty and a real Weston socket. The GUI must load and keep its renderer read-only; this does **not** certify Hyprland or a real portal picker.
- The earlier packaged X11/Xvfb smoke continues checking a synthetic OMSI structure and the unchanged .bus sentinel.

**Still untested:** actual Hyprland behavior on Arch Linux, fractional scaling, GPU/compositor interactions, tray and portals, Flatpak/AppImage distribution and Proton/OpenOMSI integration. An ephemeral Weston compositor is not Hyprland. No global desktop entry, privileged service, `pacman` package or autostart unit is created.

## Atalho opcional no menu de aplicativos (XDG)

O pacote portátil agora inclui `OMSI-Manager-Desktop-Integration.cjs`. Ele **não é executado automaticamente**, nem quando o arquivo é baixado ou extraído. Para registrar o atalho no menu de aplicativos, em uma sessão de usuário comum e com Node.js 22 instalado, execute dentro da pasta extraída:

```bash
node ./OMSI-Manager-Desktop-Integration.cjs install
```

Para remover somente o atalho criado para **esta pasta de aplicativo**, execute:

```bash
node ./OMSI-Manager-Desktop-Integration.cjs remove
```

O registro fica em `${XDG_DATA_HOME:-$HOME/.local/share}/applications/org.omsi_manager.Preview.desktop`. Ele aponta ao executável nativo `OMSI-Manager-Auto` pelo caminho absoluto, respeitando espaços comuns no caminho. O helper recusa root/sudo, lançadores redirecionados, entradas pré-existentes não correspondentes e symlinks diretos no destino ou no diretório de atalhos. Não configura autostart, systemd, atualizações ou associação de extensões. Mover o pacote após registrar o atalho invalida esse caminho: remova o atalho antes de mudar a pasta e instale-o novamente depois.

**Limitação de distribuição:** essa integração opcional usa Node.js no comando de instalação do atalho, mas a execução cotidiana do Electron portátil não necessita do Node do sistema. Um instalador nativo sem dependências externas e verificação formal de todas as condições TOCTOU ainda não foi desenvolvido. A suíte CI cria `HOME`/`XDG_DATA_HOME` fictícios para conferir instalação, remoção e recusa de sobrescrita; não modifica o menu de um usuário real.

## Diálogos Wayland e portais XDG

A seleção da pasta continua por `dialog.showOpenDialog` **do processo principal do Electron**. A interface JavaScript nunca recebe permissão para escolher um caminho diretamente nem possui acesso direto ao sistema de arquivos. O diálogo exige `openDirectory`, evita adicionar pastas aos documentos recentes e não define `defaultPath`, porque o comportamento dos portais Linux varia conforme a versão do backend. O teste Weston verifica cancelamento e uma seleção sintética, revalidando o modo somente leitura e preservando o arquivo .bus fictício.

O teste de seleção **substitui a resposta da janela de seleção por um resultado simulado**, portanto **não comprova que `xdg-desktop-portal`, `xdg-desktop-portal-hyprland` ou um backend GTK tenha aberto um seletor real**. Isso precisará ser exercitado quando o ambiente Arch Linux/Hyprland estiver disponível. Consulte a [documentação do diálogo do Electron](https://www.electronjs.org/docs/latest/api/dialog) para as limitações relacionadas a portais.


## Diagnóstico de sessão Linux (somente leitura, opcional)

O pacote inclui `OMSI-Manager-Linux-Diagnostics.cjs`, que pode ser executado **voluntariamente**, sem `sudo`, com Node.js 22 instalado no sistema:

```bash
node ./OMSI-Manager-Linux-Diagnostics.cjs
```

Esse comando não instala serviços, não altera configuração do Hyprland e não lê pastas de jogos. Ele verifica apenas os indicadores `XDG_SESSION_TYPE` e `XDG_CURRENT_DESKTOP`, a presença de um **socket Unix real** para `WAYLAND_DISPLAY` dentro de `XDG_RUNTIME_DIR` e o estado de propriedade do nome `org.freedesktop.portal.Desktop` no barramento de sessão. Não imprime caminhos, usuários, processos, variáveis de ambiente brutas nem logs do sistema. O comando do D-Bus utiliza `NameHasOwner`, que não inicia um seletor de arquivos nem ativa deliberadamente o portal. Se `dbus-send` não estiver disponível ou não houver barramento de sessão, a resposta fica como `unknown`, não como falha confirmada.

Os campos `portalPickerVerified: false` e `hyprlandCompatibilityVerified: false` são intencionais: **detectar um socket ou um serviço de portal não comprova que um seletor gráfico real funciona**, nem garante integração com Arch/Hyprland. A CI executa os testes com um socket Unix sintético e arquivos descartáveis, mantendo todos os jogos e mods reais intocados. A distribuição continua uma prévia portátil não assinada e totalmente somente leitura.


### API D-Bus FileChooser, sem abrir janela

O diagnóstico também consulta a propriedade `org.freedesktop.portal.FileChooser.version`, **somente quando** `NameHasOwner` já confirmou que o portal está registrado. É uma leitura de propriedade pelo D-Bus, sem chamar `OpenFile`, `SaveFile`, `SaveFiles`, selecionar pastas ou ativar instalações.

- `portalFileChooserInterface: advertised`: o serviço apresentou uma versão numérica válida (campo `portalFileChooserVersion`).
- `portalFileChooserInterface: unknown`: serviço ausente, indisponível, propriedade ilegível ou resposta inesperada. Não significa necessariamente que o seletor esteja quebrado.
- `portalPickerVerified: false`: permanece **sempre falso** até um teste de janela real e interação com o usuário ser concluído.

**Para Arch + Hyprland:** o backend `xdg-desktop-portal-hyprland` não implementa FileChooser isoladamente. A documentação Hyprland recomenda também `xdg-desktop-portal-gtk`, ou outro backend com FileChooser configurado. Verificar apenas o nome do serviço ou a propriedade version não comprova o backend ativo nem o fluxo gráfico.

Verificação manual futura, somente na máquina de teste com consentimento, em sessão Arch/Hyprland e usando **somente uma pasta fictícia**:

1. Executar `node ./OMSI-Manager-Linux-Diagnostics.cjs` dentro do pacote; registrar os campos sem divulgar dados pessoais.
2. Iniciar `./OMSI-Manager-Preview.sh` sem `sudo` e sem `--no-sandbox`; observar janela, escala 100%/150%/200%, teclas e diálogos.
3. Abrir a inspeção OMSI e cancelar o seletor; confirmar que não surge inspeção indevida.
4. Selecionar uma pasta sintética com `Vehicles/` e `maps/`; confirmar apenas nomes/contagens, nenhuma modificação de bytes.
5. Fechar, reabrir e repetir em sessão Wayland nativa; confirmar que não há travamento ou vazamento de caminhos.
6. Registrar separadamente versão do Electron, do Arch, do Hyprland e do backend de portal efetivo. A homologação real **ainda não ocorreu**.

Fontes: [especificação FileChooser](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.FileChooser.html) e [documentação de portais do Hyprland](https://wiki.hypr.land/Hypr-Ecosystem/xdg-desktop-portal-hyprland/).


## Homologação real de seletor nativo no Arch + Hyprland

Existe um teste manual **opt-in e fora da CI** que abre o seletor do Electron *sem mockar `dialog.showOpenDialog`*. Rode apenas numa instalação **de teste** Arch Linux + Hyprland, como usuário comum, dentro de `react-prototype/` com Node.js 22 e dependências de desenvolvimento:

```bash
npm install --no-audit --no-fund
npm run build
npm run package:linux
npm run test:manual:hyprland -- --confirm-interactive
```

O teste Hyprland exige terminal interativo, sessão Wayland declarada, socket Wayland real e confirmação explícita. A propriedade FileChooser do D-Bus é somente diagnóstica; não é pré-requisito rígido para testar uma janela nativa real. Os testes GNOME e KDE são documentados na matriz de ambientes mais abaixo. Primeiro aparece uma janela de seleção que deve ser **cancelada**. Depois o script cria uma pasta OMSI fictícia em TEMP e pede para escolher **somente essa pasta** no segundo diálogo. Em ambos os casos o operador confirma que realmente viu a janela. Ele verifica retorno, contagem e SHA-256 de um arquivo fictício, depois remove a pasta temporária. Não use pastas de jogos reais nesse teste.

O teste imprime o caminho da pasta temporária **apenas no terminal local**, para permitir selecioná-la; não compartilhe esse caminho em capturas públicas. O projeto CI testa somente as recusas e invariantes de segurança com `npm run test:manual:contract`, sem abrir janelas. Mesmo um `PASS` manual **não identifica o backend exato** que desenhou a janela (`portalBackendVerified: false`). A compatibilidade Arch/Hyprland só pode ser afirmada após executar e registrar a homologação na máquina real.


## Arch Linux OCI / ELF: verificação automatizada de portabilidade

Além dos testes Ubuntu/Weston e Windows, o workflow inclui um job dependente do build que baixa **o mesmo pacote Linux x64 não assinado** produzido pelo Ubuntu e o verifica numa imagem oficial do Arch Linux. O contêiner é descartável e instala apenas as bibliotecas necessárias ao teste. O aplicativo OMSI Manager **não é executado como root**.

- Verifica o SHA-256 e recusa caminhos absolutos ou travessia de diretórios no arquivo TAR.
- Confere a estrutura portátil, permissões de execução, `app.asar` e o formato ELF64 x86_64.
- Verifica a sintaxe do lançador e rejeita opções que desativem o sandbox.
- Audita bibliotecas dinâmicas com `ldd`; o job falha caso faltem dependências no conjunto de bibliotecas instalado.

**Limites:** o teste não comprova renderização gráfica, Hyprland, drivers de GPU, seleção real de pastas, Proton ou openOMSI. Trata-se de um **teste de integridade e dependências em Arch**, não de homologação do desktop. A distribuição continua experimental e sem operações de escrita em mods.

Origem do contêiner: [imagem oficial Arch Linux](https://hub.docker.com/_/archlinux).


## GNOME e KDE Plasma: matriz de compatibilidade

A mesma prévia Electron foi preparada para **GNOME, KDE Plasma e Hyprland**, sem criar versões separadas nem modificar arquivos de jogos. A detecção usa `XDG_CURRENT_DESKTOP` (com aliases `KDE`/`PLASMA` e `GNOME`/`GNOME-Classic`); se houver múltiplos desktops conflitantes na variável, a classificação é `ambiguous` e o piloto recusa execução. A variável indica o ambiente informado, **não garante** que o compositor real tenha sido homologado.

| Desktop | Wayland | X11 | Seletor de arquivos |
| --- | --- | --- | --- |
| Hyprland | Alvo de homologação | Não se aplica à sessão Hyprland | Requer backend FileChooser compatível, normalmente GTK |
| KDE Plasma | Alvo de homologação | Alvo de homologação | Portal `xdg-desktop-portal-kde` ou diálogo nativo equivalente |
| GNOME | Alvo de homologação | Alvo de homologação | Portal `xdg-desktop-portal-gnome` / GTK ou diálogo nativo equivalente |

Com Node.js 22, dependências de desenvolvimento e build Linux criados **na máquina de teste**, execute a partir de `react-prototype/` o teste correspondente à sessão já aberta:

```bash
npm run test:manual:hyprland -- --confirm-interactive
npm run test:manual:kde -- --confirm-interactive
npm run test:manual:gnome -- --confirm-interactive
```

Execute **um comando por vez**, só para o desktop efetivo: os scripts recusam identidade divergente e sessão não interativa. GNOME/KDE podem testar Wayland ou X11 local; Hyprland exige Wayland. Cada teste abre a caixa nativa real, exige cancelar a primeira seleção e escolher uma pasta sintética na segunda, verifica leitura de estrutura e SHA-256 do arquivo fictício e remove a fixture temporária. O teste **não mocka** o diálogo.

A propriedade D-Bus `FileChooser.version` é registrada quando anunciada, mas sua ausência **não impede o piloto interativo**: alguns ambientes podem usar um seletor GTK/Qt direto. O sucesso observa o seletor nativo, **não prova qual backend o atendeu**. A CI executa só contratos automáticos de gate e segurança; não certifica KDE/GNOME/Hyprland no desktop de uma pessoa.

Documentação técnica: [Portal XDG](https://flatpak.github.io/xdg-desktop-portal/docs/), [seleção de backends](https://flatpak.github.io/xdg-desktop-portal/docs/configuration-file.html) e [Electron 38 / Wayland](https://www.electronjs.org/blog/electron-38-0).


### CI: matriz de ambientes GNOME e KDE sem certificar os compositores

A CI testa a interface empacotada com `XDG_CURRENT_DESKTOP=GNOME` e `KDE`, de duas formas:

- **Wayland:** o mesmo socket de compositor **Weston headless** usado anteriormente, sem servidor X e sem forçar o backend; verifica inicialização e isolamento do renderer.
- **X11:** o mesmo **Xvfb** já usado na suíte, forçando o backend X11; verifica inicialização, segurança e preservação de um arquivo `.bus` sintético.

Essas execuções confirmam o comportamento diante das variáveis de ambiente, **não** executam os compositores Mutter (GNOME) ou KWin (KDE), nem abrem um seletor XDG real. A homologação final permanece manual por desktop, com o teste específico documentado acima. Os caminhos reais dos jogos continuam fora dos testes.

## Executável nativo com detecção automática de GNOME, KDE e Hyprland

O pacote portátil Linux x64 contém agora **`OMSI-Manager-Auto`**, um binário ELF que pode ser aberto diretamente pelo gerenciador de arquivos ou pelo terminal:

```bash
./OMSI-Manager-Preview-linux-x64/OMSI-Manager-Auto
```

Ele identifica a família de desktop por `XDG_CURRENT_DESKTOP` e a sessão por `XDG_SESSION_TYPE`. Se houver sinais suficientes, seleciona o backend gráfico `wayland` ou `x11`; se forem conflitantes ou insuficientes, usa o modo `auto` do Electron 38. O lançador não executa shell e não aceita flags arbitrárias: a única opção diagnóstica permitida é `--diagnose-sandbox`, que não inicia o Electron. Ele recusa root e não desliga o sandbox.

### Diagnóstico nativo de sandbox quando a janela não abre

Se o Electron não conseguir iniciar, execute manualmente, **sem sudo**:

~~~bash
./OMSI-Manager-Preview-linux-x64/OMSI-Manager-Auto --diagnose-sandbox
~~~

O binário nativo consulta **somente três controles fixos do kernel**,
não abre o Electron e não exige Node.js. O resultado limitado a categorias
pode indicar \`restriction-indicated\`, \`no-obvious-restriction\` ou
\`undetermined\`. Mesmo o segundo estado **não prova** que o sandbox
funcionará; o comando não tenta criar namespaces, não acessa mods ou
pastas do jogo, não altera o AppArmor/sysctl e não concede permissões.
Use o resultado como evidência a discutir com o administrador do sistema.
O prévio \`SIGTRAP\` observado no runner Ubuntu 24.04 não é corrigido
por esse comando, e nenhuma opção \`--no-sandbox\` é permitida.

**Portátil, não monolítico:** `OMSI-Manager-Auto` deve ficar na pasta extraída ao lado de `OMSI-Manager-Preview`, `resources/` e das demais bibliotecas Electron. Não é necessário instalar Node.js ou GCC para utilizar o programa. A compilação C acontece somente no job de empacotamento.

O atalho XDG opcional passa a apontar diretamente para `OMSI-Manager-Auto`. Nenhum arquivo OMSI real é manipulado. Os testes de desktop simulados não equivalem a uma homologação gráfica real em KWin, Mutter ou Hyprland.

### Migração segura dos atalhos antigos

Atalhos criados anteriormente que apontam para `OMSI-Manager-Preview.sh` não são sobrescritos automaticamente. Se existir um atalho **idêntico ao que esta mesma pasta criou**, use primeiro `node ./OMSI-Manager-Desktop-Integration.cjs remove` e depois `node ./OMSI-Manager-Desktop-Integration.cjs install` dentro da pasta extraída. O comando de remoção aceita tanto a versão antiga quanto a atual **somente se corresponderem exatamente ao caminho desta pasta**; atalhos desconhecidos ou apontando para outra pasta continuam protegidos.

A integração com o menu permanece opcional, exige Node.js apenas na configuração do atalho e não é um serviço. A execução do aplicativo pelo atalho ou pelo ELF não exige Node.js de sistema.


## Identificação automática Windows e Linux

A mesma aplicação Electron detecta o sistema operacional na inicialização. No Windows, o pacote próprio usa `OMSI-Manager-Preview.exe`; no Linux, o pacote próprio pode ser aberto por `OMSI-Manager-Auto`, que seleciona Wayland/X11. Ambos exibem em **Configurações** a identificação da plataforma por um campo limitado do preload sandboxed, sem vazar caminhos ou variáveis de ambiente. Uma prévia no navegador não afirma detectar o sistema do aplicativo.

**Dois executáveis, uma aplicação:** um arquivo `.exe` de Windows não é um binário Linux; um ELF Linux não é um aplicativo Windows. A distribuição entrega artefatos separados, mas o código da interface e das operações de inspeção segura é compartilhado. Não há troca manual de modo Windows/Linux dentro do programa. A CI testa o indicador de plataforma em ambos os pacotes e mantém instalação, remoção e execução de comandos desativadas.


### Teste visual de identificação automática (Windows e Linux)

Além de verificar o campo limitado do preload, a CI agora abre **Configurações** no executável Windows, no pacote Linux/X11 e no Linux/Weston e verifica que a interface apresenta `Sistema detectado automaticamente: Windows` ou `Linux`, conforme a plataforma real. Todos os testes mantêm o renderer isolado, o modo somente leitura e as operações de modificação bloqueadas. Esses testes validam os pacotes, não a execução de jogos ou a homologação do KDE/GNOME/Hyprland em computadores reais.


### Limitação da automação de navegação no Weston headless

O Weston headless da CI não fornece necessariamente dispositivos de mouse ou teclado que permitam ao Playwright realizar um clique físico. Para testar a exibição da identificação da plataforma na tela **Configurações**, o teste Wayland aciona o botão do próprio DOM e confere o conteúdo renderizado. A interface e o Electron continuam reais, mas **não se afirma que o compositor processou entrada física**. A suíte Windows e X11/Xvfb continuam usando cliques Playwright e a seleção de pastas real ainda necessita homologação manual.


## Separação dos pacotes Windows e Linux

A montagem dos pacotes exclui arquivos de laboratório, fontes do lançador nativo Linux (`native-launcher/`) e roteiros de teste do `app.asar`. A CI inspeciona o arquivo `app.asar` **de cada executável realmente empacotado**, recusando diretórios de laboratório, scripts e fontes experimentais. Também confirma que o pacote Windows não contém `OMSI-Manager-Auto` e o pacote Linux não contém `OMSI-Manager-Preview.exe`. Os dois continuam compartilhando o código da interface e a API restrita de inspeção. Essas verificações evitam misturar artefatos das plataformas, sem afirmar que existe um executável binário idêntico para os dois sistemas.

## Manifesto de origem Windows e Linux

Os dois pacotes portáteis incluem **`OMSI-Manager-Preview-build.json`**, fora do `app.asar`.
Ele indica a plataforma (`windows` ou `linux`), arquitetura `x64`, commit de origem
(`sourceRevision`) e limites da prévia (`mode: read-only`,
`modificationEnabled: false`, `signatureStatus: unsigned`).

Numa mesma execução do GitHub Actions, os dois pacotes devem identificar **o mesmo commit**.
A CI verifica o manifesto de cada pacote e, no contêiner Arch, compara a revisão indicada
com o commit do workflow. Uma compilação local sem `GITHUB_SHA` recebe
`sourceRevision: null` e `buildEnvironment: local`.

**Este arquivo não é uma assinatura digital nem comprova reprodutibilidade.**
Para verificar a integridade do download, confira o SHA-256 do ZIP/TAR.
O manifesto não autoriza leitura automática de jogos nem escrita em mods reais.


## Auditoria cruzada dos artefatos Windows e Linux

Há também um job separado chamado **Windows + Linux archives / same-commit read-only provenance**, executado **somente depois** da criação dos dois pacotes. Ele baixa o ZIP Windows e o TAR.GZ Linux da mesma execução do GitHub Actions, verifica os arquivos SHA-256 e examina os membros compactados **sem extrair ou executar binários**.

O teste recusa travessia de diretórios, links em TAR, entradas duplicadas e manifestos inconsistentes. Confere que cada pacote contém seu executável nativo e `app.asar`, que não mistura o executável de outra plataforma e que ambos os manifestos declaram **o commit exato da CI**, a prévia não assinada e o modo somente leitura.

Essa verificação não prova que os binários tenham sido assinados, não substitui verificação independente de procedência nem certifica funcionamento gráfico em GNOME, KDE ou Hyprland reais. Trata-se de um controle adicional para evitar pacotes cruzados ou versões divergentes.

## Nova verificação de geometria e escala da janela

O pacote Electron Linux agora tem um contrato de geometria que confere
a existência da navegação e do conteúdo, título visível, ausência de
rolagem horizontal inesperada e manutenção do modo somente leitura.
A CI redimensiona a janela real no X11/Xvfb para 1280×800, 1024×720 e
850×600; no Weston headless, observa a área útil sem alegar clique físico.

O piloto manual KDE/GNOME/Hyprland também observa a área útil e
o fator de escala da sessão. Nenhuma captura de tela, caminho do sistema
ou dado privado é enviado por esse diagnóstico.

**Limite:** esses testes não homologam a aparência numa sessão KWin,
Mutter ou Hyprland real, nem garantem escala fracionária perfeita ou
funcionamento de todos os dispositivos de entrada. A validação real
continua pendente e não autoriza modificações em mods.

## Piloto manual do executável automático (KDE, GNOME e Hyprland)

O teste de seletor anterior usa um wrapper Electron para permitir instrumentação Playwright.
Para verificar também **o verdadeiro `OMSI-Manager-Auto`**, há um segundo piloto
opt-in. Na máquina Linux do teste, com o pacote gerado em `release/` e uma sessão
gráfica real já aberta, rode **apenas um** dos comandos a seguir, conforme seu desktop:

```bash
npm run test:manual:auto:kde -- --confirm-interactive
npm run test:manual:auto:gnome -- --confirm-interactive
npm run test:manual:auto:hyprland -- --confirm-interactive
```

O piloto recusa CI, root, sessões remotas X11, ambiente divergente e terminal
não interativo. Ele inicia **diretamente** o ELF `OMSI-Manager-Auto` sem flags,
sem shell e sem `sudo`. A pessoa confirma no terminal que a janela apareceu,
que a navegação por teclado funciona e que a escala da interface é legível.
O processo é encerrado ao final; não acessa pasta de jogos nem abre o seletor.

Um resultado `PASS_MANUAL_VISUAL_ONLY` é apenas o testemunho do operador,
não uma prova automática de que Mutter, KWin ou Hyprland foram homologados.
O teste de diálogo nativo e pasta sintética continua separado, e os testes
de CI validam apenas os contratos não interativos do novo piloto.

## Abertura real do executável ELF automático na CI X11

A CI também **executa diretamente `OMSI-Manager-Auto`** no Xvfb,
com etiquetas de sessão GNOME e KDE, sem argumentos e sem `sudo`.
O teste consulta o processo por `/proc` para conferir a opção Ozone
e utiliza `xwininfo` para atestar uma janela X11 efetivamente visível
(mapeada), com dimensão mínima, sem ler arquivos do jogo.
O aplicativo roda com diretórios HOME/XDG temporários e é encerrado.

**Atenção:** Xvfb não é GNOME Mutter nem KDE KWin. Este teste não
comprova acesso ao seletor gráfico real, entrada física de mouse nem
funcionamento do executável no Hyprland. Os pilotos manuais reais
continuam obrigatórios para essa homologação.

### Homologação de pré-diagnóstico do ELF real na matriz Ubuntu

A matriz X11 Ubuntu 22.04/24.04 executa agora a opção
`OMSI-Manager-Auto --diagnose-sandbox` **sobre o mesmo ELF portátil que
será usado no teste gráfico**, antes de abrir o Electron. Um contrato
restritivo exige os nove campos e categorias esperados, verifica que o
resumo de políticas coincide com as categorias e recusa mensagens extras,
valores privados ou alegações de sandbox verificado. O comando não usa
`sudo`, não executa Electron e não tenta mudar AppArmor, namespaces ou
políticas do kernel. O job gráfico continua vermelho se não houver janela
mapeada, independentemente do resultado informativo desse diagnóstico.

Os testes do parser usam apenas textos sintéticos, incluindo entradas
malformadas e falsas alegações de sucesso. O relatório limitado a
categorias é diagnóstico do **host da CI**, não homologação de GNOME,
KDE ou Hyprland reais e não comprova isolamento do aplicativo.

## Mensagem de risco de inicialização com sandbox estrito (opcional)

O comando **somente leitura** `node ./OMSI-Manager-Linux-Diagnostics.cjs` agora também apresenta `electronStartupRisk`, com dados limitados e sem comandos de correção automática:

- `host-policy-restriction-indicated`: os indicadores públicos do kernel sugerem alguma restrição relevante. O próximo passo indicado é **revisar o diagnóstico com o administrador**, preservando o sandbox.
- `no-obvious-host-restriction`: não foi detectada restrição óbvia nesses indicadores; isso **não comprova** que o Electron irá abrir.
- `undetermined`: não há evidência suficiente; é necessário testar a abertura real com as proteções intactas.

Em todas as categorias, `electronLaunchVerified` e `apparmorCausalityProven` continuam `false`. Não há `sudo`, execução de Electron, varredura de jogos, modificação do AppArmor ou recomendação de `--no-sandbox`. A CI tem testes sintéticos de classificação, privacidade e inexistência de certificação indevida.


## Aviso informativo no executável automático Linux

O binário nativo `OMSI-Manager-Auto` agora consulta apenas três indicadores fixos do kernel **antes** de executar o Electron. Se algum deles indicar restrição relevante de *user namespaces*, imprime um aviso curto em `stderr` para orientar o uso do diagnóstico somente leitura. A mensagem **não impede** a abertura do aplicativo e **não prova** que a política do host seja a causa de uma falha. Se os indicadores forem inconclusivos, o launcher não presume bloqueio.

O aviso não contém nomes de usuário, caminhos de jogo, perfis do AppArmor nem saída bruta do sistema. Nenhum comando privilegiado, `--no-sandbox` ou alteração de política é executado. O launcher continua recusando argumentos extras e preservando a mesma configuração estrita do Electron. Um teste com ELF real e aplicativo fictício compara a mensagem ao próprio pré-diagnóstico, verifica a ausência de vazamentos e a recusa de argumentos proibidos.

## Revisão administrativa por aplicativo (Ubuntu 24.04)

O teste X11 agora cruza **a categoria somente leitura** de `apparmor_restrict_unprivileged_userns` com a triagem independente do launcher nativo e do Electron direto. O campo `AUTO_X11_APPARMOR_ADMIN_REVIEW` pode pedir revisão administrativa de um perfil **específico para o executável** quando a restrição estiver ativa, o Xvfb aceitar a janela de controle e ambos os Electron encerrarem com `SIGTRAP` e indícios de sandbox.

Essa classificação **não prova causalidade**, não gera ou instala perfis e não autoriza alterar o host. Os testes de contrato rejeitam evidências parciais e entradas privadas. A documentação de encaminhamento encontra-se em `docs/UBUNTU24_APPARMOR_ADMIN_REVIEW.md`. A exigência de janela nativa e sandbox permanece intacta; a matriz continua vermelha enquanto o Ubuntu 24.04 não passar.

### Quatro sinais antes da revisão administrativa

O parecer de uma possível política específica agora também confirma **AppArmor ativo** pelo indicador fixo somente leitura de `/sys/module/apparmor/parameters/enabled`. O aviso é gerado somente com módulo ativo, restrição de namespace ligada, tentativa independente negada e falha compartilhada do Electron com `SIGTRAP`. Ausência de qualquer sinal torna o parecer inconclusivo, não uma autorização para modificar o host.
