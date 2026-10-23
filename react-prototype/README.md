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
