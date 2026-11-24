# M69 — Localização assistida de OMSI 2 no Linux

Solicitação do usuário após o seletor real abrir no Hyprland: localizar os
simuladores automaticamente, em vez de exigir navegação manual pela pasta
oculta da Steam.

Primeira entrega: ação explícita Localizar automaticamente para OMSI 2 no
Electron Linux. O main consulta somente caminhos Steam padrão, Flatpak e
legado sob o home fornecido pelo próprio Electron, com lstat de componentes
fixos, sem enumeração recursiva, leitura de conteúdo, busca em documentos,
rede, execução de jogos ou caminho vindo do renderer. Exige Vehicles,
maps e um marcador de executável regular. Uma única candidata é usada
apenas como defaultPath do seletor nativo. Ausência/ambiguidade abre seleção
manual; negativa de acesso ou cancelamento falha de forma segura. O mesmo
fluxo de grant, época, cancelamento e inspeção continua exigindo seleção
humana. Não prova instalação, versão, compatibilidade ou contenção atômica.

Próximos escopos: bibliotecas adicionais via índice Steam limitado e
validado; busca opcional em discos/pastas autorizados, sem recursão
irrestrita; detecção Windows; separar instalação ETS2/ATS de pasta de mods;
lista de múltiplas candidatas com confirmação; opção de busca ao abrir.
Nenhum destes escopos adicionais está implementado nesta PR.

M68 permanece Draft. Ubuntu24 strict X11 continua obrigatório; não alterar
AppArmor, sandbox, instalação/mods, merge ou release.
