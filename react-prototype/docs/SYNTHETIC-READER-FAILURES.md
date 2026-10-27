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

## Leitura de ZIP real em memória: somente fixtures da CI

O laboratório em scripts/controlled_zip_reader.py aceita somente objetos
Python bytes, não caminhos, e utiliza zipfile para ler cabeçalhos ZIP e
validar CRC do conteúdo descompactado de fixtures geradas em memória.
Exige limites de entradas, tamanho e expansão, rejeita links, traversal,
caminhos duplicados, nomes reservados e formatos não suportados.

É uma etapa de testes e NÃO um parser liberado para arquivos de usuários.
Não lê ZIP/SCS de disco, não abre mods de verdade, não executa programas,
não extrai entradas e não tem garantia de sandbox de produção.
Um ZIP tecnicamente bem formado não prova autenticidade, ausência de malware,
compatibilidade, licença nem capacidade de instalação. Instalar permanece bloqueado.

O leitor de fixtures recusa também diretórios vazios registrados com
compressão DEFLATE. O contrato exige entradas de diretório ZIP_STORED
de tamanho zero; isso é uma restrição conservadora do laboratório, não
uma afirmação de que todo ZIP de usuário com diretórios DEFLATE seja malicioso.

Quando o teste de abertura X11 falha, ele registra somente categorias
de erro pré-definidas (sandbox, display, bibliotecas, GPU, filesystem e runtime),
sem publicar stderr bruto, caminhos do computador, nomes de usuário ou conteúdo.
