# OMSI Manager | Ubuntu 24.04: protocolo de revisão do bloqueio nativo

**Estado:** BLOQUEADO, sem merge da PR #1. Este é um protocolo de investigação,
não uma autorização para instalar, iniciar como root ou alterar políticas.

## Evidência atual (commit 0b35383, execuções 42323754207 e 42323759350)

- O mesmo pacote Linux foi verificado pelo fluxo de hash/proveniência da CI.
  O hash comum não constitui assinatura digital.
- Build: 877 testes Playwright aprovados; Windows, Arch e Ubuntu 22.04
  (janela X11 em Xvfb, sandbox estrito) passaram.
- Ubuntu 24.04: a janela X11 elementar mapeia; nem OMSI Manager Auto
  nem controle Electron direto exibem janela nas etiquetas GNOME/KDE
  simuladas em Xvfb. Ambos apresentam `SIGTRAP` antes da janela.
- O host Ubuntu 24.04 registra restrição AppArmor de user namespaces
  habilitada e uma tentativa independente de namespace recusada.
  O 22.04 registra teste permitido. **A coincidência não prova a causa.**
- As evidências de kernel iniciais do processo principal não atestam
  o sandbox do renderizador. As etiquetas Xvfb não substituem sessões
  reais GNOME ou KDE.

## Plano de investigação, sem execução automática

1. Preservar o gate estrito Ubuntu 24.04 e os logs sanitizados com
   cobertura das identidades Auto e controle direto, sem coletar caminhos,
   argumentos privados, PIDs ou dados pessoais.
2. Solicitar revisão de administrador para hipótese de política
   **específica do aplicativo**, apenas em VM descartável aprovada,
   com rollback definido e arquivo executável estável auditado.
   Não instalar nem carregar perfil AppArmor durante a CI regular.
3. Somente após autorização, comparar fases A/B/A do **mesmo artefato**
   e mesma sessão descartável; registrar apenas categorias verificadas,
   incluindo janela mapeada/pertencente ao processo e estado de namespace.
   Um aparente sucesso nessa prova ainda **não confirma causalidade**.
4. Avaliar separadamente a proteção real do renderizador, a assinatura
   e integridade da distribuição, e as janelas em **sessões reais**
   GNOME e KDE. Qualquer verificação ausente deixa a release bloqueada.
5. O merge/distribuição só pode ser considerado após revisão humana,
   aprovação explícita do risco e **CI nativa Ubuntu 24.04 obrigatória
   aprovada**, sem bypass de sandbox ou de segurança do host.

## Referências técnicas

- Ubuntu 24.04 LTS release notes, seção *Unprivileged user namespace
  restrictions*:
  https://documentation.ubuntu.com/release-notes/24.04/
- Ubuntu Security, documentação AppArmor e namespace:
  https://documentation.ubuntu.com/security/security-features/privilege-restriction/apparmor/
- Chromium, contexto técnico de builds não empacotados e AppArmor:
  https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md

O caminho preferencial é revisão **por aplicativo**, não alteração de
restrições globais ou abandono do sandbox. Este arquivo não inclui
receitas executáveis e não aplica nenhuma configuração.

## Registro de lacunas no handoff gerado

A saída humana `admin-handoff.md` agora inclui uma seção explícita
**Evidências ainda pendentes ou insuficientes**. A seção muda de acordo
com as categorias sanitizadas observadas, incluindo falta de janela
Ubuntu 24.04, testemunha Electron direta incompleta, identidade Auto
parcial/ausente ou sonda de namespace/AppArmor indeterminada. Mesmo
com janelas Xvfb mapeadas, seguem pendentes **prova independente do
sandbox do renderizador, validação em sessões gráficas reais e
autenticidade do pacote**. A lógica é apenas descritiva, não altera
o status de bloqueio, não abre exceção de merge e não acessa o host.

## Consistência obrigatória entre comparador e relatório humano

O handoff V1 **não pode recomendar uma revisão de política por
aplicativo só porque as sondas do host e os controles Electron coincidem**.
Também exige que o comparador sanitizado V6 classifique o conjunto
como `namespace-restriction-correlated-with-startup-failure`. Se a
classificação conjunta for `inconclusive`, mesmo com todos os processos
identificados e controle direto reportando SIGTRAP, o documento indica
que falta revisar a divergência de inicialização. Nenhum status de
causalidade, certificação ou release é inferido. Testes sintéticos cobrem
a divergência entre etiquetas Xvfb e preservam a recomendação somente
de revisão humana, nunca de aplicação automática.

## Pendências estruturadas no relatório JSON (fonte única)

O `admin-handoff.json` inclui agora `pendingEvidence`, uma lista
imutável de categorias fixas e não sensíveis. O `admin-handoff.md`
transforma **essa mesma lista** em descrições para revisão humana,
em vez de recalcular suas próprias condições de bloqueio. Estão
cobertas as ausências de janela, identidade de processo, testemunha
Electron direta, classificação conjunta, sonda de namespace,
estado de AppArmor, sandbox do renderizador, desktop real e prova
de autenticidade do pacote.

Uma categoria não comprova causalidade nem certifica sandbox. Nenhuma
categoria autoriza alteração da política do host, instalação de mods,
merge, exceção de CI ou lançamento. Testes sintéticos verificam que
todas as categorias presentes no JSON aparecem no Markdown correspondente.

## Auditoria de integridade dos três arquivos publicados

A comparação de CI agora confirma, **após escrita no disco**, a igualdade
exata dos bytes dos três arquivos com o resultado sanitizado que a própria
execução acabou de produzir: `host-comparison.json`, `admin-handoff.json`
e `admin-handoff.md`. A verificação usa nomes fixos, recusa links
simbólicos e modos de arquivo inesperados, exige limites de tamanho
e falha se dados estruturados ou redação do relatório forem alterados,
truncados, estiverem desatualizados ou contiverem campos adicionais.
A CI não publica o sinal de prontidão se essa leitura de volta falhar.

O verificador não opera sobre diretórios de jogos, não inspeciona mods,
não modifica políticas do host e não prova autenticidade de pacotes,
causalidade AppArmor ou sandbox do renderizador. Testes sintéticos
tentam injetar falsas aprovações, remover pendências, alterar a formatação
e misturar evidências de execuções diferentes. O workflow exige a
execução do contrato tanto no build quanto no job comparador.
