# OMSI Manager — prévia pública da interface

Demonstração **isolada**, estática, com dados fictícios. Não contém o código do OMSI Manager privado nem acessa OMSI, Steam, banco de dados ou Electron.

- `index.html`: prévia interativa do visual escuro de catálogo, com navegação entre setores.
- `.github/workflows/windows-screenshots.yml`: renderização e captura de tela em Windows, sem backend.
- `.github/workflows/pages.yml`: deploy GitHub Pages da prévia estática.

Ative **Settings → Pages → GitHub Actions** para publicar. Depois acesse `https://nego001.github.io/omsi-manager-ui-preview/`.

O visual é uma candidata independente inspirada na organização de launchers; não contém imagens, logos ou código do Hydra Launcher.
