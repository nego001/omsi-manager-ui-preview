# OMSI Manager | Revisão visual com referência pública do Hydra

Revisão de aproximação visual, **não** validação de fidelidade 1:1. O OMSI Manager é um aplicativo independente, com objetivos e recursos diferentes do Hydra. Não copiamos marcas, imagens, layouts proprietários, recursos de download nem identidade comercial de terceiros.

## Fontes e recorte

- Referência do launcher Hydra: https://docs.hydralauncher.gg/ (captura da interface Home consultada em 23/10/2026).
- Capturas do OMSI Manager executado no Windows: https://github.com/nego001/omsi-manager-ui-preview/actions/runs/40017963184/artifacts/12529331769
- Código de prévia atual: `feat/react-nine-screens-safe`.
- A CI anterior tinha arquivos `06-*-1440.png` produzidos por um runner Windows cuja tela disponível era **menor que 1440 px** (alguns PNGs perto de 993 px). Esses nomes estavam errados; não podem sustentar comparação geométrica objetiva a 1440 px. O teste agora usa sufixo `initial-NNN` calculado a partir do viewport e publica `screenshot-manifest.json` com dimensões reais e bounds nativos.

## Diferenças verificáveis

| Região | Referência Hydra | Prévia OMSI antes desta rodada | Ajuste atual |
| --- | --- | --- | --- |
| Moldura / superfícies | Predomina preto / cinza-escuro uniforme | Contorno roxo/azulado em painéis e banner | Tons neutros em barra lateral, barra superior, cartões e gradiente do destaque |
| Navegação | Sidebar lateral com item ativo discreto | Blocos roxos e bordas com acento vibrante | Estado ativo mais neutro, preservando nove páginas e nomes de acesso |
| Destaque | Uma faixa de jogo em destaque com imagem panorâmica | Banner com três capas inclinadas de jogos | **Ainda diferente**: mantemos capas para não substituir conteúdo por uma reprodução não solicitada |
| Biblioteca / grade | Capas de jogos de conteúdo real | Cards demonstrativos de mods com tipografia e gradientes próprios | **Diferença funcional intencional**: o catálogo de mods é fictício, não um download do Hydra |
| Experiência sem internet | Não avaliada nesta referência | Capas Steam com fallback | Fallback acessível e verificado na CI anterior |
| Acessibilidade | Sem certificação observada | Link de salto visível indevidamente em capturas de CI | Link de salto fica visualmente oculto até receber foco do teclado |

## Critérios usados nesta rodada

1. Ajustar as superfícies de navegação e o destaque para tons mais discretos, preservando contraste AA nas amostras existentes.
2. Confirmar que nove telas, busca, navegação por teclado e simulação de mods continuam funcionais.
3. Garantir que o link de salto só fique aparente com foco real.
4. Publicar metadados reais de dimensão das screenshots Windows para comparações futuras.
5. Não declarar 1:1 até comparar capturas na **mesma resolução e estado de interface**, com uma referência Hydra datada e revisada por pessoa.

## Não concluído

- Ajustar proporções e densidade do destaque, biblioteca, tipografia, geometria e espaçamento a partir de capturas equivalentes.
- Inspecionar diferenças de anti-aliasing, sistema de fontes, contraste em sobreposições, DPI do Windows real e desempenho gráfico com o notebook.
- Homologação física do seletor nativo de diretórios e revisão da segurança antes de considerar operações com escrita.

O PR continua **draft**. Nenhum mod, jogo ou arquivo do OMSI Manager original é modificado.
