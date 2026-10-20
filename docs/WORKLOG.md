# WORKLOG — OMSI Manager UI Preview (publicada, isolada)

## 2026-10-20 — Configurações → Personalização

**Objetivo:** implementar os três pedidos do usuário na prévia pública: estrutura completa da tela, nomes exatos das opções e fluxo de navegação com editor funcional.

**Alterações:**
- `personalizacao.html`: catálogo de seis layouts (OLED Premium, Glass Carbon, Neon Control, Titanium Pro, Minimal Slate e Blue Pulse), cada um com Aplicar/Editar/Duplicar.
- Oito seções do editor: Cores, Aparência, Sidebar, Topbar, Cards, Tipografia, Branding e Presets, com prévia instantânea dos parâmetros.
- Persistência isolada em `localStorage`, salvamento de até 20 presets personalizados, importação de JSON validado (máximo 10 KB), exportação para arquivo JSON, restauração de valores.
- `index.html`: Configurações exibe cartão dedicado com link para `personalizacao.html`. Navegação de retorno para a tela de Configurações.

**Verificação realizada:** recuperação dos dois arquivos por API GitHub, compilação sintática das duas tags `<script>` com `new Function`: ambas **PASS**. Confirmada presença dos seis nomes de layouts, dos botões de importação/exportação e da ligação entre as páginas. **Não** houve validação visual automatizada/browser desta nova tela ainda.

**Escopo/segurança:** demonstração pública independente, sem qualquer código do OMSI Manager privado, Electron, integração com OMSI, Steam, persistência em banco, função de instalação ou exclusão. As imagens miniatura são desenhadas com CSS, não fotografias nem reproduções 1:1 do catálogo ilustrativo. A personalização afeta esta prévia, **não o programa de produção**.
