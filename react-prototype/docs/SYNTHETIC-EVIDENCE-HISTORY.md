# OMSI Manager | Historico sintetico de evidencias

Estado: contrato em memoria para testes. Sem leitura de arquivos, instalacao, edicao, atualizacao, IPC ou rede.

O modulo src/synthetic-evidence-history.ts cria um historico imutavel a partir de resultados do coordenador vinculados ao indice exato que os originou. src/synthetic-index-workers.ts guarda uma associacao privada (WeakMap) entre cada resultado emitido e o indice original. Relatorios inventados, clonados ou emitidos para outro indice sao recusados.

Abertura de nova revisao: beginSyntheticHistoryRevision() compara declaracoes privadas dos indices, marca registros anteriores como superseded, zera o candidato atual e exige reanalise dos sete especialistas, mesmo quando tamanhos, digest declarado e handles parecem iguais. A nova revisao registra diferencas agregadas, motivo e modulos afetados, mas nunca nomes ou caminhos dos arquivos.

Conclusao de revisao: completeSyntheticHistoryRevision() exige novo resultado emitido para exatamente o indice pendente. Reanalise incompleta ou bloqueada permanece assim e informa modulos pendentes. O historico nao reaproveita sinais antigos e preserva estados ambiguos.

A projecao projectSyntheticEvidenceHistory() fornece informacoes sanitizadas para futuras Biblioteca, Oficina, Instalador e Diagnosticos, sempre com operacoes bloqueadas. Nao foi conectada ainda a interface visual aprovada.

Limites: 24 revisoes por historico. Cada funcao retorna um novo objeto; consumidores devem usar a referencia nova (objetos antigos nao se invalidam sozinhos). Nao existe persistencia em disco. WeakMap nao e prova criptografica; digest e tamanhos de fixtures nao sao verificacao dos bytes. Nenhum mod real foi lido e nao houve homologacao manual no Windows fisico do usuario.

PR draft sem merge, ambiente de preview isolado do programa original, mods, jogos e backups privados.
