# OMSI Manager | Protótipo React + Electron isolado

Este projeto contém nove telas navegáveis de uma futura interface do OMSI Manager, em uma pasta separada do aplicativo original. **Não é a aplicação principal, nem uma restauração validada do backup.**

## Visão do ecossistema e etapa atual

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
