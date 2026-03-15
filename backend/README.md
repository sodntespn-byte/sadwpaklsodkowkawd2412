# Backend — Liberty

API Node.js (Express), WebSocket, autenticação JWT e persistência PostgreSQL.

## Estrutura

- `server.js` — ponto de entrada (API + servir frontend)
- `src/` — config, rotas (auth), middleware, logger
- `message-cache.js` — cache de mensagens (memória ou Redis)
- `db/` — schema e helpers de base de dados

## Variáveis de ambiente

Defina na raiz do repositório (`.env`) ou no painel do host (Square Cloud: Configurações → Environment):

- `DATABASE_URL` — URL PostgreSQL (Neon)
- `JWT_SECRET` — mínimo 32 caracteres
- `ADMIN_USERNAMES` — opcional, ex.: `user1,user2`
- `ALLOWED_ORIGIN` / `CORS_ORIGIN` — opcional
- `RATE_LIMIT_MAX` — opcional (padrão 200)

## Executar

Na **raiz do repositório**:

```bash
npm install
npm start
```

O servidor sobe na porta definida em `PORT` (ou 3000) e serve a API em `/api/v1` e o frontend a partir da pasta `frontend/`.
