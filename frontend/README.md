# Frontend — Liberty

Interface estática (HTML, CSS, JavaScript) da aplicação Liberty.

## Estrutura

- `index.html` — SPA principal
- `404.html` — página de erro
- `css/` — estilos (main, components, themes, etc.)
- `js/` — lógica da aplicação (api.js, app.js, websocket.js, etc.)
- `assets/` — imagens, logo

## Integração com o backend

O frontend usa **URLs relativas** (`/api/v1/...`). Em produção o backend (pasta `backend/`) serve estes ficheiros estáticos, mantendo a mesma origem e evitando CORS para a API.

Para desenvolvimento com frontend e backend separados, configure no frontend a base da API (ex.: variável de ambiente ou `window.API_BASE`) se o backend estiver noutro porto/domínio.
