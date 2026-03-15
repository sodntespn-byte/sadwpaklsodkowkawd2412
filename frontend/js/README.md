# Scripts (JavaScript)

Lógica da aplicação no browser.

| Ficheiro | Função |
|----------|--------|
| **api.js** | Cliente da API: chamadas a `/api/v1/*`, gestão de token (localStorage), refresh em 401. Expõe `window.API` (Auth, User, Server, Channel, etc.). |
| **app.js** | Aplicação principal: UI, navegação, listagem de servidores/canais, mensagens, perfil, configurações. |
| **websocket.js** | Conexão WebSocket para eventos em tempo real (mensagens, presença). |
| **chat-messages-react.js** | Componentes/helpers para mensagens do chat. |
| **dm-unread-react.js** | Lógica de DMs e contagem de não lidas (React-style). |
| **dm-unread-store.js** | Store para estado de DMs não lidas. |
| **mentions-popover.js** | Popover de menções (@utilizador). |
| **logo-fallback.js** | Fallback do logo (ex.: SVG se a imagem falhar). |

O `index.html` carrega estes scripts; a ordem pode importar (ex.: `api.js` antes de `app.js`).
