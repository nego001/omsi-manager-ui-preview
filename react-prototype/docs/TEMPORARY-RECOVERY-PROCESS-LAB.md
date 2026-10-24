# OMSI Manager | Laboratório de recuperação entre processos (somente testes)

> **Escopo: testes do Node.js em diretório descartável do sistema. Não é funcionalidade do Electron.**
> Não usa pastas do OMSI 2, ETS2, ATS, mods, Steam, Documentos ou backups particulares. Não tem IPC, instalador, API de restauração ou autorização de mod.

## Por que o laboratório existe

A tela Histórico já ilustra cenários de queda e concorrência, mas as demonstrações anteriores eram objetos em memória. Agora uma suíte isolada cria um diretório exclusivo com prefixo `omsi-manager-recovery-fixture-` em `os.tmpdir()`, grava marcadores inventados e inicia um **processo Node separado**. Este processo executa etapas pequenas de gravação e termina intencionalmente via `process.exit(91)` sem rotina de limpeza. Em seguida, outro processo Node abre o diretório e relata o que realmente ficou no disco.

O resultado é **observabilidade entre processos** sob término explícito. Não é uma simulação de perda de energia, travamento do kernel, bloqueio da unidade, falha do controlador de armazenamento ou prova de durabilidade após crash físico.

## Arquivos permitidos

O processo de testes só aceita uma pasta filha imediata de `os.tmpdir()` cujo nome começa com o prefixo estrito do laboratório. Exige diretório real (não symlink), verifica o caminho canônico e um marcador local `.omsi-test-fixture-marker` com identificador aleatório de 128 bits criado pela suíte. O processo filho nunca recebe um caminho de jogo, não varre outras pastas e só pode escrever estes nomes fixos:

| Nome | Finalidade |
| --- | --- |
| `prepared.json` | Registro fictício de preparo com escrita e `FileHandle.sync()` |
| `intent.json` | Intenção fictícia, separada do preparo e sincronizada |
| `published.tmp` | Registro de publicação escrito e sincronizado antes da mudança de nome |
| `published.json` | Resultado de `rename()` na mesma pasta, inspecionado no processo novo |
| `.omsi-test-fixture-marker` | Identificador de teste fornecido pela suíte, nunca permissão real |

A recuperação usa somente leitura. A suíte remove seus diretórios temporários ao finalizar; o aplicativo não inclui nem importa esses arquivos. São registros curtos, sem conteúdo de mods, nomes privados de arquivos ou dados de usuário.

## Pontos de interrupção

| Ponto | Resultado esperado em outro processo |
| --- | --- |
| Antes do preparo | Sem registro; nenhuma evidência aceita |
| Depois do preparo com `sync()` | Registro incompleto; nunca é promovido |
| Depois da intenção com `sync()` | Intenção incompleta; nunca é publicada automaticamente |
| Depois da publicação por `rename()` | Registro visível, mas **não confiável** |
| Saída limpa | Registro visível, mas **não confiável** |
| Repetição sobre pasta usada | Recusada antes de sobrescrever o registro |
| Registro truncado, adulterado, versão errada, sessão diferente | Rejeitado |
| Marcador ou caminho fora do escopo | Recusado antes de qualquer gravação |

A etapa de publicação e o nome do arquivo **não** autorizam restauração, instalação ou uso de evidência antiga. Os snapshots retornam permanentemente `durabilityProven:false`, `fileIdentityNativeVerified:false`, `operationsEnabled:false` e `oldEvidenceReusable:false`.

## Garantias que ainda NÃO foram testadas

- `FileHandle.sync()` solicita sincronização do **arquivo** ao sistema operacional, mas não demonstra persistência de metadados do diretório. A suíte **não implementa sync de diretório**, tampouco verifica garantias reais do hardware.
- A operação `rename()` é exercitada na mesma pasta de testes; sem medição por filesystem e sem verificação de durabilidade, **não** se afirma atomicidade universal nem sobrevivência a desligamento.
- A checagem de caminhos foi desenhada para um harness não privilegiado, controlado pela CI. Não substitui proteção nativa contra reparse points, file-ID/handle, TOCTOU ou adversários locais com privilégios.
- `process.exit(91)` termina o processo Node intencionalmente. Não prova que os mesmos arquivos sobreviveriam a um `SIGKILL`, acesso simultâneo hostil, interrupção de energia ou defeito de SSD.
- Um marcador aleatório é um vínculo entre instâncias de teste, não uma assinatura, HMAC, autorização ou segredo de produção.
- Não há cronologia criptografada, proteção antirreplay nativa, journal de produção ou política de consentimento em execução.

## Execução e CI

```bash
cd react-prototype
npm run test:recovery:fixture
```

Este comando usa `node --test scripts/temp-recovery-fixture.test.cjs` e não requer Electron nem Playwright. A CI executa a suíte em **Linux e Windows** separadamente, antes de empacotar o executável. O laboratório não expõe comandos na UI, e nenhum arquivo do laboratório é necessário para executar o aplicativo portátil.

O teste de sentinela comprova que um arquivo temporário situado **fora** do diretório do laboratório mantém seu conteúdo durante a sequência. Essa verificação não prova ausência de efeitos em um host comprometido; é um teste de regressão do escopo permitido do harness.

## Critério para uma etapa posterior

Antes de construir um journal nativo real, exigir design de durabilidade por plataforma, revisão do sandbox e escopo IPC, fixtures com falhas de processo e filesystem, proteção de identity/reparse/TOCTOU, logs sem dados privados e homologação em Windows físico. Qualquer futura escrita nos diretórios de mods exigirá outro PR, consentimento e estratégia de backup/rollback; continua **explicitamente bloqueada nesta PR**.


## Concorrência real entre processos Node e encerramento forçado (extensão de laboratório)

O arquivo `scripts/temp-recovery-concurrency.cjs` funciona **exclusivamente dentro das mesmas pastas temporárias** e usa `session.claim.json` como reivindicação de uso. `fsp.open(path,'wx')` testa exclusão na criação do arquivo dentro do diretório descartável e dois processos disputam o mesmo nome. O processo vencedor relata `claimed`, o perdedor relata `busy`. O processo detentor pode ficar vivo no modo `hold`, até que o teste pai o encerre explicitamente com `child.kill('SIGKILL')`. No Windows, o sinal corresponde à terminação forçada suportada pelo Node; **isso não equivale a falha de energia**.

- Após encerramento forçado, a reivindicação permanece no disco; **não é automaticamente limpa, roubada, renovada ou reutilizada**, e nenhuma permissão nova é concedida.
- `inspectTemporaryClaim` interpreta qualquer arquivo sintaticamente correto como `present-untrusted`, sem afirmar identidade ou vida do proprietário. Um arquivo adulterado ou maior que 512 bytes produz `corrupt-untrusted` e também não é reaproveitado.
- Duas instâncias simultâneas em pastas diferentes não disputam a mesma reivindicação. Duas instâncias no mesmo diretório disputam apenas a criação exclusiva do arquivo, **não um lock de kernel**.
- Os testes cobrem detentor vivo, concorrente recusado, detentor encerrado à força, recusa de replay/roubo da reivindicação, corrupção, sessão inválida, pares de diretórios independentes e sentinela externa preservada.
- A suíte adiciona **13 testes Node** aos 15 anteriores, totalizando 28 cenários esperados no laboratório. A CI executa ambos com `npm run test:recovery:fixture` em Linux e Windows.

**Importante:** proteção real contra links/reparse points e TOCTOU, detecção de proprietário morto, políticas de limpeza, relógio monotônico, identidade de handle, lock interprocesso nativo, `fsync` do diretório, durabilidade após pane elétrica e testes físicos ainda são requisitos futuros. O arquivo de reivindicação é deliberadamente conservador: ficar órfão resulta em indisponibilidade do fixture, nunca em liberação automática. Nenhuma capacidade de modificar mods foi habilitada.


## Revisão de órfãos por observação restrita e sem limpeza automática

A extensão `scripts/temp-recovery-orphan-review.cjs` emite um identificador de revisão mantido em `WeakMap`, sem API para remover ou renomear arquivos ou recuperar privilégios. Um objeto clonado não herda autoridade. Ao abrir, valida a pasta temporária e obtém um fingerprint experimental do arquivo de reivindicação: atributos de `lstat`, `FileHandle.stat` e SHA-256 do conteúdo limitado a 512 bytes. Revalida marcador/caminho a cada consulta. Se tamanho, status, metadados expostos pelo sistema ou digest mudarem, retorna `claim-changed`; um arquivo malformado gera `invalid-claim`. Não elimina o arquivo nem concede autorização.

A leitura usa `O_NOFOLLOW` nos sistemas que disponibilizam essa constante e examina se o arquivo é regular, mas **não reivindica garantia contra ataques de troca entre validação e uso** (TOCTOU), especialmente em Windows/reparse points ou quando metadados do filesystem são insuficientes. O fingerprint pode não distinguir todos os cenários adversariais, como substituições ABA. Não se trata de identidade de arquivo validada nativamente.

O laboratório recebe indícios **não autenticados** de PID, PID observado, etiqueta sintética de início e informação declarada sobre processo ativo. Exige formato estrito de dados próprios, não executa getters e não consulta o cadastro real do SO. Classifica `same-incarnation-claimed`, `pid-reuse-suspected`, `different-pid-reported`, `reported-not-running` e `unusable-hint` sem jamais inferir vida real, propriedade confiável, permissão, limpeza automática ou recuperação.

Mesmo depois de terminar um subprocesso por `SIGKILL`, o processo recém-iniciado **apenas observa** o arquivo residual. Até uma revisão nativa e homologação completa, um arquivo órfão leva a indisponibilidade conservadora, não a exclusão ou reuso. Nenhum PID é exibido no relatório e nenhum dado pessoal ou conteúdo de mods integra o experimento.

**18 novos testes Node, total de 46 cenários do laboratório** em `npm run test:recovery:fixture`, no Linux e Windows. Não altera UI, `preload`, IPC, empacotador nem arquivos de jogo. Instalação e remoção seguem bloqueadas.
