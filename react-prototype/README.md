# OMSI Manager: protótipo React seguro (nove telas)

Esta pasta é uma aplicação **React/Vite isolada**. O backend Electron real, biblioteca local, jogos instalados e rotinas de instalação/desinstalação **não estão conectados**. Não faz nenhuma alteração no sistema de arquivos do usuário. Os dados de mods são fictícios.

Execute `npm install` e `npm run dev` dentro de `react-prototype/`. Para validar os tipos e compilar, execute `npm run build`.

Telas: Início, Jogos, Catálogo, Minha biblioteca, Detalhes, Fila, Histórico, Configurações, Segurança. As capas são carregadas diretamente da CDN da Steam e dependem de rede e permissões de uso do titular. Não redistribuir assets da Steam em builds sem verificar licenças.

## Integração futura

Conectar ao Electron exclusivamente por preload seguro, com `contextIsolation: true`, `nodeIntegration: false`, IPC de leitura e validação de entradas. O botão de instalar, remover ou aplicar mods **não pode ser ativado** até haver testes de integridade, rollback, backup e permissões.

Este protótipo não prova fidelidade 1:1 à referência original, que não estava disponível nesta etapa.
