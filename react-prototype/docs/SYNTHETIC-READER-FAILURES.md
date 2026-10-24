# OMSI Manager | Corpus sintético de falhas e orçamentos

**Estado:** simulador determinístico em memória. Não lê pacotes reais, não descompacta ZIP/SCS, não usa IPC nem mede tempo real.

A rotina src/synthetic-reader-scenarios.ts cria cenários de entradas declaradas, módulos e tempos virtuais. A suíte tests/synthetic-reader-scenarios.spec.ts testa:

- Caminhos de travessia, absolutos, separadores Windows, nomes reservados, duplicados, links e formato fictício quebrado.
- Entradas além do limite, razão de expansão excessiva, profundidade e quantidade de bytes.
- Módulos fictícios demorados, cancelamento antes ou durante a sequência, e limite global de tempo virtual.
- Divergências ETS2/ATS e relatórios inválidos; todas as operações da Oficina/Instalador permanecem desativadas.

Os limites ARTIFICIAIS são: 128 entradas, caminhos de 160 caracteres, profundidade 12, 2 MB codificados, 4 MB expandidos, razão 100:1, 600 ms VIRTUAIS por módulo e 2500 ms VIRTUAIS totais.

**Esses limites não comprovam segurança de arquivos reais.** Nenhum parser de contêiner foi criado. O campo declaredFormat é um rótulo fictício e simulatedDurationMs não inicia tarefas nem espera no relógio. Uma implementação real precisará de sandbox, watchdog de tempo real, orçamentos de memória/CPU, validação de links e nomes no sistema operacional, hash do conteúdo, defesa TOCTOU, testes reais e consentimento.

Um candidato emitido pelo coordenador permanece não verificado. O resultado incompleto, cancelado, bloqueado ou ambíguo nunca contém autorização de instalar, remover, atualizar ou editar um mod.

Nenhum arquivo original, jogo, backup ou código do OMSI Manager principal foi modificado. PR isolado em rascunho, sem merge.
