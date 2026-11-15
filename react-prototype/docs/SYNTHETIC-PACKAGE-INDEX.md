# OMSI Manager | Índice sintético compartilhado de pacotes

**Situação:** contrato executável, imutável e exclusivamente fictício. Não existe parser real de arquivos ZIP, SCS, BUS ou DDS, nem acesso aos diretórios dos jogos. Nenhuma tela ou operação do app real foi habilitada.

## Contrato e integração

- Arquivo fonte: `src/synthetic-package-index.ts`.
- Testes: `tests/synthetic-package-index.spec.ts`.
- O simulador `src/synthetic-reader-scenarios.ts` agora usa `buildSyntheticPackageIndex()` como sua **única validação de entradas fictícias**, substituindo o validador duplicado.
- A validação confere esquema estrito, campos, nomes, segmentos de pasta, links, duplicatas no Windows, colisão entre um arquivo e seus supostos filhos, formato fictício malformado e orçamentos artificiais de entradas, tamanho e razão de expansão.
- Se houver qualquer rejeição, nenhum índice parcial é emitido. O gate do coordenador recebe um relatório bloqueado; módulos simulados não prosseguem.
- Após validação, as entradas são normalizadas por ordem canônica, ganham somente IDs `synthetic-entry-0001` etc. e campos sanitizados: grupo de pasta (por lista permitida), sufixo permitido, tipo, profundidade e tamanhos **declarados pelo fixture**.
- Caminho original, nomes internos, conteúdo bruto, endereço local, scripts e URLs são descartados e **não aparecem no índice**. Nomes de pastas desconhecidas viram `other`; sufixos desconhecidos viram `unknown`.
- As vistas `projectSyntheticIndex(index, moduleId)` entregam aos módulos uma lista restrita pelos tipos de extensão. São somente **pistas de roteamento**: `.scs` não significa ATS ou ETS2, `.bus` não comprova OMSI e `.bank` não prova editor FMOD funcional.
- O index produzido é profundamente imutável e a vista recusa objetos falsificados, sem transformar IDs sintéticos em permissões de acesso. O índice aparece no resultado do simulador mesmo quando este é cancelado após o gate, mas nunca desbloqueia operações.

## Limites explícitos

O identificador `fixtureDigest` é declarado no teste; não é hash calculado, autenticado ou verificado de um pacote. Os tamanhos também são fictícios; os contadores não comprovam que um arquivo exista. Uma vista de especialista **não é uma capacidade de abrir arquivos**, somente uma lista de registros sanitizados. A estrutura ainda não inspeciona bytes, assinaturas de arquivo, integridade, versão do jogo, licença, referências de recursos nem compatibilidade.

Não é um sandbox real, nem um leitor de diretório, nem proteção efetiva contra zip bombs. Os limites e os nomes permitidos são regras provisórias do contrato sintético, não uma política final para todas as instalações do OMSI/ETS2/ATS. A leitura real exige projeto e homologação independentes.

Oficina, Instalador, Atualizador, desinstalação, backup, rollback e todas as escritas permanecem bloqueados. O PR continua draft, sem merge, separado do OMSI Manager principal e dos dados privados do usuário.
