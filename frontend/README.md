# Frontend — Liberty

Interface estática (HTML, CSS, JavaScript) da aplicação. Tudo o que o browser carrega fica nesta pasta.

---

## Onde está cada coisa

```
frontend/
├── index.html             ← Página principal (SPA)
├── 404.html               ← Página de erro 404
├── css/                   ← Estilos (ver css/README.md)
│   ├── main.css
│   ├── components.css
│   ├── liberty.css
│   ├── themes.css
│   ├── mobile.css
│   └── responsive.css
├── js/                    ← Scripts (ver js/README.md)
│   ├── api.js             ← Cliente da API e gestão de token
│   ├── app.js             ← Lógica principal da aplicação
│   ├── websocket.js       ← Conexão WebSocket
│   ├── chat-messages-react.js
│   ├── dm-unread-react.js
│   ├── dm-unread-store.js
│   ├── mentions-popover.js
│   └── logo-fallback.js
├── assets/                ← Imagens (logo, ícones)
│   ├── logo.png
│   └── settings-player.png
└── README.md              ← Este ficheiro
```

### Tabela de referência rápida

| Quero… | Onde |
|--------|------|
| Alterar a página principal | `index.html` |
| Alterar estilos gerais | `css/main.css` |
| Alterar componentes (botões, cards, etc.) | `css/components.css` |
| Alterar temas / cores | `css/themes.css` |
| Alterar chamadas à API e token | `js/api.js` |
| Alterar lógica da aplicação (UI, fluxos) | `js/app.js` |
| Alterar conexão WebSocket | `js/websocket.js` |
| Trocar logo ou imagens | `assets/` |

---

## Integração com o backend

O frontend usa **URLs relativas** (`/api/v1/...`). O backend (pasta `backend/`) serve estes ficheiros estáticos na mesma origem, por isso não é preciso configurar CORS para a API.

Se em desenvolvimento o backend estiver noutro porto ou domínio, podes configurar a base da API (ex.: `window.API_BASE` ou variável de ambiente) em `js/api.js`.

Mapa completo do projeto: **`ESTRUTURA.md`** na raiz.
