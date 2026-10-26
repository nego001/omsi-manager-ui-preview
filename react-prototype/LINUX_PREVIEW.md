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

No `pacman` package, desktop integration, systemd unit, auto-update process or application installer is delivered. Avoid `sudo`, disabling Electron's sandbox, or modifying game folders to make a preview run. If the native preview fails to launch, collect application stderr and system information in a **separate** troubleshooting step rather than bypassing security.

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

O registro fica em `${XDG_DATA_HOME:-$HOME/.local/share}/applications/org.omsi_manager.Preview.desktop`. Ele aponta ao lançador `OMSI-Manager-Preview.sh` pelo caminho absoluto, respeitando espaços comuns no caminho. O helper recusa root/sudo, lançadores redirecionados, entradas pré-existentes não correspondentes e symlinks diretos no destino ou no diretório de atalhos. Não configura autostart, systemd, atualizações ou associação de extensões. Mover o pacote após registrar o atalho invalida esse caminho: remova o atalho antes de mudar a pasta e instale-o novamente depois.

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

Existe um teste manual **opt-in e fora da CI** que abre o seletor do Electron *sem mockar \`dialog.showOpenDialog\`*. Rode apenas numa instalação **de teste** Arch Linux + Hyprland, como usuário comum, dentro de \`react-prototype/\` com Node.js 22 e dependências de desenvolvimento:

\`\`\`bash
npm install --no-audit --no-fund
npm run build
npm run package:linux
npm run test:manual:hyprland -- --confirm-interactive
\`\`\`

O comando exige terminal interativo, Wayland, sessão declarando Hyprland, socket Wayland e propriedade FileChooser anunciada no D-Bus. Primeiro aparece uma janela de seleção que deve ser **cancelada**. Depois o script cria uma pasta OMSI fictícia em TEMP e pede para escolher **somente essa pasta** no segundo diálogo. Em ambos os casos o operador confirma que realmente viu a janela. Ele verifica retorno, contagem e SHA-256 de um arquivo fictício, depois remove a pasta temporária. Não use pastas de jogos reais nesse teste.

O teste imprime o caminho da pasta temporária **apenas no terminal local**, para permitir selecioná-la; não compartilhe esse caminho em capturas públicas. O projeto CI testa somente as recusas e invariantes de segurança com \`npm run test:manual:contract\`, sem abrir janelas. Mesmo um \`PASS\` manual **não identifica o backend exato** que desenhou a janela (\`portalBackendVerified: false\`). A compatibilidade Arch/Hyprland só pode ser afirmada após executar e registrar a homologação na máquina real.
