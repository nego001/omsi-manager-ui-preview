# OMSI Manager | Núcleo de conhecimento compartilhado entre setores

**Estado:** requisito de arquitetura de produto para fases futuras. **Não implementado no protótipo atual.**  
**Etapa em andamento:** interface visual da Biblioteca e Detalhes, sem ler mods reais nem modificar jogos.  
**Origem do conceito:** leitura distribuída/cooperativa de mods, estendida agora a **todos os setores** do ecossistema, incluindo a **Oficina** (skins e sons).

## 1. Regra principal: uma análise, vários setores

O resultado da leitura espalhada **não termina na tela do Analisador e não pertence exclusivamente ao Instalador**. Os módulos examinam partes específicas de um pacote seguro e publicam observações em um **Núcleo de Conhecimento do Mod**. O coordenador consolida um retrato versionado, imutável e rastreável, chamado aqui de `AnalysisSnapshot`.

Cada setor recebe uma **projeção própria**, estritamente com os campos que utiliza, as evidências de origem e um marcador de incerteza. Isso evita que Oficina, Biblioteca e Instalador façam várias leituras incoerentes ou interpretem o mesmo mod de maneiras contraditórias.

```text
             MOD ESCOLHIDO PELO USUÁRIO
                          |
              [validação de segurança]
                          |
              [índice seguro compartilhado]
                          |
   +-------------+--------------+--------------+---------------+
   | Estrutura   | Recursos 3D  | Áudio/eventos| Metadados     |
   | Jogo/tipo   | UV/materiais  | referências  | versões/deps  |
   +-------------+--------------+--------------+---------------+
                          |
              [coordenador de evidências]
                          |
               AnalysisSnapshot vN
               (identidade + origem + avisos)
                          |
              [projeções por capacidade]
         +-------------+--------------+----------------+
         | Biblioteca  | Oficina      | Instalador     |
         | filtros     | skin / som   | plano simulado |
         +-------------+--------------+----------------+
         | Atualizador | Loja/Criador | Diagnósticos   |
         | diferenças  | direitos     | evidências     |
         +-------------+--------------+----------------+
                          |
              [derivados criados pelo usuário]
                          |
         [revalidação incremental + novo snapshot]
```

**Princípios:** nenhum setor reclassifica secretamente o jogo; nenhum setor é obrigado a receber conteúdo ou caminho pessoal de que não precisa; informações não verificadas permanecem desconhecidas, nunca "compatíveis".

## 2. Contratos entre módulos e setores

### 2.1. Retrato imutável do pacote: `AnalysisSnapshot`

O resultado compartilhado contém, conceitualmente:

- `schemaVersion`, `snapshotId`, `sourceDigest` e versões das regras/adaptadores utilizados;
- `identity`: jogo(s) candidato(s), categoria, variante, autor/origem e nível de evidência (confirmado, provável, ambíguo, não verificado);
- `assets`: **referências opacas** a recursos autorizados (texturas, mapeamentos UV, materiais, definições de som, arquivos de preview), nunca caminhos absolutos publicados para todas as telas;
- `dependencies` e `compatibility`: requisitos, conflitos e versões, com observações que suportam cada alegação;
- `capabilities`: operações que **podem ser oferecidas** naquele pacote, como `skinPreview`, `skinWorkspace`, `audioPreview`, `audioWorkspace`; cada uma com `available`, `reason`, `adapterVersion` e `sourceEvidence`;
- `media`: imagem real do pacote com procedência ou placeholder explicitamente ilustrativo;
- `diagnostics`: alertas, bloqueios, falhas parciais e limites de leitura;
- `createdAt` e `status`: estado e validade do retrato. Não confundir estrutura reconhecida com funcionamento comprovado no jogo.

O snapshot **não transporta instruções executáveis dos mods**, nem autoriza edição por si. Um `AssetHandle` deve ser vinculado ao snapshot, com permissão, escopo, tipo validado e tempo de vida limitado. No futuro, processos isolados podem resolver esses handles apenas mediante autorização específica.

### 2.2. Projeções por setor

| Setor | Dados recebidos | O que faz | O que não deve fazer |
| --- | --- | --- | --- |
| **Biblioteca** | Jogo, categoria, imagem/proveniência, versão, estado e avisos | Filtra, mostra a coleção e indica o estado | Declarar instalado/compatível sem evidência |
| **Oficina: skins** | Geometria suportada, slots de material, UVs, texturas, transparência, resolução e templates verificados | Exibe preview, camadas, editor de pintura e exportação em cópia | Inventar UV, editar modelo original sem consentimento ou perder referência da textura |
| **Oficina: som** | Eventos de áudio, mapeamentos, formatos, referências, volumes e bibliotecas quando suportados | Monta cadeia de preview, substituições e variantes de som em workspace | Reescrever bancos/formatos desconhecidos, prometer FMOD editável automaticamente |
| **Analisador** | Evidências completas estritamente necessárias | Detecta incoerências, faltas e suporte técnico | Transformar suspeita em certeza |
| **Instalador** | Snapshot, plano autorizado, arquivos esperados e hashes | Futuramente executa transação segura com backup/rollback | Reinterpretar destino em segredo ou copiar arquivos sem aprovação |
| **Atualizador** | Versões, recursos, diferenças e logs, com proveniência | Simula migração em cópia de trabalho e propõe patches testáveis | Corrigir só manifesto e chamar de "mod atualizado" |
| **Loja e criadores** | Metadados públicos autorizados, licença e mídia liberada | Publica/exibe mods com atribuição | Expor arquivos privados ou redistribuir conteúdo sem direito |
| **Suporte e diagnóstico** | Resumo sanitizado de evidências, versões e falhas | Explica correções e exporta relatórios com consentimento | Enviar caminhos, arquivos e dados pessoais automaticamente |

A interface deve mostrar **somente as ações válidas para aquele mod**. Por exemplo, se uma pasta de mapa não tem veículo/modelo de carroceria, não oferecer o editor de skin de veículo como se tivesse suporte. Ações ausentes devem ser explicadas de modo simples.

## 3. Oficina de skins: aproveitar a mesma leitura

Exemplo de fluxo pretendido para um ônibus OMSI 2:

1. Usuário seleciona um veículo na Biblioteca e escolhe **Abrir na Oficina > Pintura**.
2. A Oficina consulta `capabilities.skinWorkspace`; se houver suporte, recebe **somente handles de materiais/texturas e mapeamento UV relevante** daquela variante, mais evidência do leitor.
3. O editor apresenta a textura-base fiel ao arquivo e, quando houver suporte comprovado, a aplicação sobre a carroceria em preview 3D. Em caso contrário, editor 2D com molde e limitações sinalizados. Sem inventar a posição de portas, janelas ou elementos.
4. O usuário edita em camadas e vê alterações **na cópia de trabalho**, não sobre o mod original.
5. A exportação respeita formato e resolução exigidos pelo jogo/veículo, caminhos válidos e regras de licença, e cria um **derivado** com referências ao original.
6. O analisador reprocessa **apenas o que mudou** (texturas, referência de materiais, tamanhos, preview), com checagem global de consistência. O instalador futuro recebe **um novo plano baseado no snapshot atualizado**, nunca reaproveita plano antigo como se nada tivesse mudado.

**Exemplos de suporte condicional:** um mod que expõe um esquema de repaints verificado pode habilitar templates; um mod proprietário sem UV acessível deve mostrar "Editor de pintura indisponível para este formato" e permitir, quando cabível, anexar arte externa sem alegar preview 3D preciso.

## 4. Oficina de áudio: aproveitar a mesma leitura

Exemplo de fluxo pretendido para sons de veículo no OMSI, ETS2 e ATS:

1. O leitor de som descobre **mapeamentos, referências e eventos** de áudio permitidos pela especificação do jogo/versão. Não basta encontrar arquivos `.wav`, `.bank` ou `.scs` e afirmar que tudo é substituível.
2. A Oficina apresenta o que o pacote oferece: motor, marcha, turbo, freio motor, retarder, freios, portas, ambiente etc., **somente se esses eventos forem identificados**.
3. O usuário abre o editor e escolhe uma variante ou um arquivo autorizado. Pode pré-escutar, ajustar volumes e comportamento **nos formatos e extensões realmente suportados pelos adaptadores**, dentro de ambiente controlado.
4. Um validador compara referências, parâmetros/eventos obrigatórios, codecs e regras de versionamento. Para ETS2/ATS, suporte a bancos e eventos FMOD exige **adaptação explícita** do formato/versão e não pode ser prometido como conversão genérica; para OMSI, referências de scripts e configurações devem ser coerentes.
5. Exportação ocorre em **workspace isolado**. O original permanece íntegro. Um novo derivado é analisado novamente pelos módulos de áudio/compatibilidade, incluindo detecção de referências quebradas.
6. O instalador futuro aplica somente um **plano aprovado para esse derivado**, preservando o mod base e a capacidade de voltar à configuração anterior.

Casos especiais: mods criptografados, formato proprietário não suportado, banco de áudio que não pode ser reautorado, falta de licença ou referência de evento ausente devem produzir **"Edição indisponível / depende de suporte"**, não uma operação improvisada.

## 5. Mudanças na Oficina voltam ao núcleo: ciclo bidirecional

O compartilhamento é **bidirecional, mas controlado**:

- Análise inicial → o núcleo publica um snapshot.
- Biblioteca e Oficina consomem **projeções** dele, usando a mesma identidade.
- Oficina cria um `DerivedModDraft` com histórico de ações, arquivos que mudaram, autoria, origem e hash, sempre em local de trabalho separado.
- O coordenador identifica quais módulos precisam rodar de novo: uma skin geralmente aciona textura/material/preview; uma edição de som aciona áudio/eventos/dependências; alterações que afetem definições disparam a verificação de compatibilidade e estrutura.
- A conclusão não edita retroativamente o snapshot antigo: publica **nova revisão** com rastreabilidade entre original e derivado.
- Biblioteca passa a mostrar original e variante (ex.: "Pintura própria", "Escape direto") sem confundi-los; Atualizador compara versões; o Instalador planeja instalação **do derivado selecionado**.
- Se arquivo/hash/regra/estado de destino mudar, invalidar planos e solicitar nova inspeção antes da execução.

### Exemplo de contrato (ilustrativo, não API ativa)

```json
{
  "snapshotId": "sha256:fixture-mod-123",
  "sourceDigest": "sha256:fixture-only",
  "game": "omsi",
  "classification": {"category": "Ônibus", "status": "not-verified"},
  "capabilities": {
    "skinWorkspace": {"available": false, "reason": "UV e materiais ainda não analisados"},
    "audioWorkspace": {"available": false, "reason": "Formato e eventos ainda não verificados"}
  },
  "consumers": ["library", "workshop", "analyzer", "installPlanner"],
  "writeAccess": false
}
```

O exemplo contém identificadores fictícios; um snapshot real precisa de contrato formal validado e hashes verdadeiros. **`consumers` não significa distribuição irrestrita de dados brutos**.

## 6. Requisitos de segurança e UX

- Leitores de entrada isolados, com limites de recursos e sem executar scripts não confiáveis.
- Cache por hash + versão de regra e **invalidação obrigatória** quando o pacote ou as regras relevantes mudarem.
- A Oficina usa serviços internos autorizados para previews e edição; não recebe acesso irrestrito ao disco via interface web/Electron.
- Separar funções **prévia**, **edição**, **exportação** e **instalação** em permissões explícitas. Ver um preview não autoriza alterar arquivos.
- Alterações em staging, escrita atômica onde possível, backups, confirmação, licença/direitos de autoria e rollback antes de qualquer instalação real.
- Sem publicação em loja, envio a nuvem ou compartilhamento do mod sem consentimento, procedência e direitos.
- Mostrar estado **Desconhecido / Inspeção incompleta** em vez de habilitar editor ou instalação com capacidade presumida.
- Progressos e avisos simplificados: "**Reconhecido: ônibus OMSI 2 · Pintura: disponível / a verificar · Som: precisa analisar**"; uma ação principal por contexto, opções avançadas por expansão.
- Testes futuros de referências quebradas, UV inexistente, texturas faltantes, formatos de áudio não suportados, cache invalidado, derivado alterado, conflitos, falha parcial e rollback.

## 7. Ordem do trabalho preservada

1. **Agora:** terminar visual e estados honestos de Biblioteca/Detalhes do protótipo. **Nada de leitura ou escrita real.**
2. **Próxima fase de engenharia:** modelar `AnalysisSnapshot`, `AssetHandle`, `CapabilityProjection`, `DerivedModDraft` com fixtures sintéticas, incluindo leitura incremental.
3. **Depois:** adaptadores reais, limitados e homologados por formato/versão para reconhecimento, mídia, skins e áudio em ambientes separados.
4. **Depois:** Oficina em workspace seguro e exportação de derivados; simulação de instalação baseada no mesmo snapshot.
5. **Somente após homologação física, integridade, permissões, backup e rollback:** considerar instalação/desinstalação real por etapas.

**Nenhum desses recursos da Oficina está implementado hoje. Este documento protege essa visão de ser perdida enquanto seguimos a etapa atual.**
