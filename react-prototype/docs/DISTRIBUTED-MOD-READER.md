# Leitura espalhada: analisador e instalador com módulos cooperativos

**Status: leitura e instalação reais ainda não implementadas. Etapa atual: Biblioteca/Detalhes + contratos de fusão sobre fixtures sintéticos, sem leitura real.** Jogos-alvo: OMSI 2, ETS2 e ATS. Outros títulos dependem de regras verificadas.


> **Implementação limitada disponível:** o [contrato sintético do leitor cooperativo](SYNTHETIC-READER-CONTRACT.md) já modela módulos, bloqueios, consenso e projeções em memória, com testes. Não lê arquivos de mods reais, não executa o gate de segurança nem habilita operações.

## Conceito exigido

O mod **não será interpretado por um leitor único, nem por um único sinal como nome, extensão ou manifesto**. Um coordenador entrega partes e aspectos **delimitados** de um mesmo pacote a módulos especializados. Cada módulo contribui com evidências independentes. Ao final, um mecanismo comum cruza resultados, detecta contradições e produz uma identificação justificada. O **analisador e o planejador/instalador futuro usam esse mesmo resultado**. Isso é leitura distribuída com decisões compartilhadas, e não dois leitores divergentes.

### Pipeline proposto

```text
Usuário escolhe mod(s)
  → Gate de segurança (assinatura, hash, tamanho, tipo, limites)
  → Índice IMUTÁVEL das entradas (sem extrair tudo)
     ├─ Estrutura e caminhos .............. → tipo de jogo, árvore do pacote
     ├─ Metadados/manifestos .............. → mod, autor, versão declarada
     ├─ Definições de jogo ................ → OMSI/ETS2/ATS, veículo/mapa/variante
     ├─ Modelos/texturas/materiais ......... → referências e faltas
     ├─ Sons/configurações ................ → tipo e dependências
     ├─ Mídia e previews ................. → imagem autêntica, origem/ausência
     ├─ Versões/dependências .............. → requisitos e conflitos
     └─ Integridade/segurança ............. → hashes, entradas perigosas, anomalias
  → FUSÃO de evidências com conflitos, confiança e lacunas
  → AnalysisSnapshot imutável, versionado, com hash do pacote
  → Verificador de instalação do jogo + pasta de mods (estados separados)
  → PLANO SIMULADO, baseado no MESMO snapshot
  → [FUTURO, somente com consentimento] backup, staging, validação e commit
  → [FUTURO] verificador espelhado + log da transação + rollback
```

## Responsabilidades especializadas

| Módulo | O que examina | O que entrega |
| --- | --- | --- |
| Contêiner/segurança | Assinaturas, entradas, índice, travessia de caminhos, links, limites de extração | Aprovado, recusado ou incompleto, com motivos |
| Estrutura | Árvores de diretórios e organização do pacote | Indícios de formato e simulador |
| Metadados | Manifesto e versões declaradas | Nome, autor, requisitos, evidências |
| Definições por jogo | Padrões específicos de OMSI/ETS2/ATS | Jogo e categoria prováveis; variantes |
| Recursos | Modelos, texturas, materiais, referências | Existência/faltas sem renderizar conteúdo não confiável |
| Áudio | Estrutura e definições sonoras | Indícios e referências faltantes |
| Imagens | Capas e prévias existentes, procedência, licença | Mídia real quando válida; caso contrário fallback rotulado |
| Compatibilidade | Regras versionadas, dependências, incompatibilidades | Verificado, suspeito, incompatível ou desconhecido |
| Destinos | Instalação do jogo e pasta de mods, por autorização | Jogo localizado ou não; pasta localizada ou não |
| Plano/consistência | Hashes, conflitos, variantes, arquivos esperados | Plano simulado ou bloqueio motivado |

**Gate obrigatório:** a segurança e o índice vêm primeiro. Depois módulos independentes podem rodar em paralelo sob orçamento **global** de tempo, memória, CPU, bytes, número de entradas e profundidade. Os módulos recebem somente um índice compartilhado e leitores de fluxo com escopo delimitado. Não extraem o arquivo completo repetidamente, não executam scripts, não seguem links e não têm permissão de escrita.

## Identificação conjunta, não votação cega

Saída mínima de cada módulo: `moduleId`, versão da regra, digest do pacote, observações/evidências com origem sanitizada, candidatos de jogo/categoria, avisos, bloqueios, estado incompleto. O coordenador gera `AnalysisSnapshot` com **proveniência e incerteza explícitas**.

Regras de fusão:

1. Bloqueio de segurança prevalece sobre qualquer suposto reconhecimento.
2. Evidência específica do formato prevalece sobre nome/extensão e descrição.
3. ETS2 e ATS podem compartilhar recursos; indícios contraditórios exigem análise de variantes ou estado **ambíguo**. Nunca copiar para os dois automaticamente.
4. Um pacote com estrutura OMSI em contêiner inesperado é **incomum**, não automaticamente inválido nem reconhecido.
5. Não encontrar recursos, versão ou imagem pode significar **inspeção incompleta**, não incompatibilidade confirmada.
6. Mesmo uma classificação de jogo bem fundamentada **não prova compatibilidade** com uma versão atual do simulador. Isso exige regras e evidências adicionais.

**Exemplo fictício:** arquivo chamado `truck_ats.scs`, manifesto indica ETS2, definições apontam ATS. Módulos relatam contradição; coordenador impede escolha silenciosa do destino, apresenta os indícios e solicita confirmação/inspeção mais profunda. Não confundir ausência de erro com validação.

## Analisador, instalador e desinstalador espelhados

- **Analisador:** vários leitores especializados processam partes diferentes do pacote, e o coordenador emite um snapshot único versionado e imutável.
- **Planejador:** verifica condições de destino e simula instalação **usando exatamente esse snapshot**. Não executa outra classificação escondida.
- **Instalador futuro:** antes de escrever, revalida digest, diretórios, versão de regras e consentimento. Se algo mudou desde a análise, **invalida o plano**. Executa somente a transação aprovada, com staging e backup.
- **Pós-instalação:** compara hashes e inventário instalado com o plano espelhado; não afirma que o jogo carregou o mod sem evidência.
- **Desinstalador futuro:** opera com o registro da transação, preserva alterações manuais e outros mods, oferece recuperação/rollback.
- **Atualizador futuro:** usa a mesma leitura distribuída sobre original e cópia candidata; mudar somente manifesto **não é garantia** de compatibilidade. Recursos e logs precisam de regras testadas.

## Interface com poucos comandos e muita inteligência

Uma única ação **Analisar mods** aciona os módulos automaticamente. Exemplo *apenas ilustrativo*:

> Analisando · Estrutura verificada · Jogo provável: OMSI 2 · Categoria: ônibus · Imagem indisponível · Compatibilidade não verificada

Um painel expansível mostra exatamente qual módulo verificou cada conclusão, falhas parciais, conflitos e próximos passos. O usuário **não tem que selecionar os módulos**. Sem mídia real, a ilustração continua rotulada como ilustração.

## Testes e garantias antes da execução real

- Corpus sintético de OMSI/ETS2/ATS, pacotes híbridos, extensões enganosas e manifests contraditórios.
- Entradas `../`, caminhos absolutos, links, arquivos gigantes, zip bombs, formatos quebrados, módulos lentos/falhando, interrupções e falta de rede.
- Orçamento de recursos, cancelamento, repetibilidade do resultado e impossibilidade de acesso fora da área permitida.
- Arquivo alterado entre análise e execução deve invalidar qualquer plano (proteção contra *time-of-check/time-of-use*).
- Nenhuma leitura transmite dados ou caminhos pessoais a servidores sem consentimento; fontes e licenças de previews são registradas.
- Escrita/desinstalação somente após homologar consentimento, isolamento, logs, backup, restauração e testes de falha parcial num Windows real.

## Distribuição do resultado aos demais setores

A saída consolidada do coordenador não termina no Analisador/Instalador: constitui o **núcleo de conhecimento compartilhado do mod**. A Biblioteca recebe identidade, categorias e estado; a Oficina recebe capacidades comprovadas de pintura e áudio; Atualizador, Loja e Diagnósticos recebem apenas os campos autorizados para cada tarefa. Uma `CapabilityProjection` com proveniência e motivos de indisponibilidade impede que a interface ofereça editores para materiais, UVs ou eventos que não foram identificados.

**Oficina de skins:** usa referências verificadas de materiais/texturas/UV e modelos para prévia e edição, sempre em workspace derivado. **Oficina de som:** usa os arquivos, eventos e mapeamentos realmente suportados pelo adaptador do simulador; não promete reautoria universal de bancos FMOD ou arquivos proprietários. Ao concluir uma alteração, a Oficina produz um derivado: os módulos relevantes reanalisam só as partes modificadas e a conclusão se transforma em um **novo snapshot imutável**. O instalador futuro recebe o novo snapshot e um plano revalidado.

A especificação completa de setores, contratos, exemplos de skin/som e ciclo bidirecional está em [SHARED-ANALYSIS-ECOSYSTEM.md](SHARED-ANALYSIS-ECOSYSTEM.md). **Ainda é arquitetura futura, não uma leitura/edição real já habilitada.**

## Ordem para não perder a etapa atual

1. **Agora:** apresentação visual e filtros da Biblioteca/Detalhes com metadados fictícios, status honestos e testes de UI.
2. **Depois:** contratos, módulos e fusão sobre dados **sintéticos**, sem arquivos reais.
3. **Depois:** leitura isolada segura de mods escolhidos, imagens verdadeiras e matrizes de versão.
4. **Depois:** plano simulado espelhado, análise de atualização e staging.
5. **Por último:** execução transacional, desinstalação com rastreabilidade e rollback, após homologação.

**Este documento especifica comportamento desejado. Nenhum desses leitores especializados ou instaladores reais foi habilitado no protótipo.**
