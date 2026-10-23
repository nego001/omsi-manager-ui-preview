# OMSI Manager | Protótipo React + Electron isolado

Este projeto contém nove telas navegáveis de uma futura interface do OMSI Manager, em uma pasta separada do aplicativo original. **Não é a aplicação principal, nem uma restauração validada do backup.**

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
- Sem `ipcRenderer` exposto, sem acesso a arquivos, sem execução de comandos ou APIs do instalador.
- Downloads, permissões da sessão, abertura de janelas e navegação externa bloqueados.
- Botões de instalação e desinstalação desativados por construção.
- Não executa varredura de diretórios, detecção de jogo, cópia de arquivos ou alterações de mods.

## Validações e próximos passos

As capturas de todas as nove telas são exportadas pela CI no artefato `react-prototype-visual-review`. Usá-las para comparar com a referência original, que não acompanha este repositório. Fidelidade **1:1 não está confirmada**.

Somente depois de recuperação independente do backup, auditoria técnica e testes de integridade, rollback, permissões e caminhos será possível projetar uma ponte IPC de **leitura** para uma branch de integração. Ações que escrevem ou removem arquivos exigem escopo e homologação separados.

**Não mesclar este protótipo diretamente no código principal até a revisão visual e de segurança.**
