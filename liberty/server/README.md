# Liberty – Servidor Node.js + PostgreSQL (Neon) + Socket.io

Backend que entrega o frontend, persiste **mensagens e amizades** no PostgreSQL (Neon) e usa Socket.io para tempo real. Segurança: helmet, rate-limit e sanitização de entradas.

## Como rodar

1. **Configurar o banco:** na raiz do projeto (`liberty123`), crie um arquivo `.env` com:

   ```
   POSTGRES_URL=postgresql://user:password@host/db?sslmode=require
   PORT=3000
   ```

2. **Instalar e iniciar:**

```bash
cd liberty/server
npm install
npm start
```

- App: **http://localhost:3000**
- Socket.io: **ws://localhost:3000/socket.io**
- Banco: PostgreSQL (Neon) — tabelas criadas na primeira execução

## Variáveis de ambiente

| Variável       | Uso |
|----------------|-----|
| `POSTGRES_URL` ou `DATABASE_URL` | Connection string do PostgreSQL (Neon) |
| `PORT`         | Porta HTTP (padrão: 3000) |
| `SESSION_SECRET` | Segredo para tokens de sessão (opcional) |

## Segurança

- **helmet** — headers de segurança
- **express-rate-limit** — limite de requisições por minuto
- Sanitização (XSS) em conteúdo e nomes de usuário

## API

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- **Health:** `GET /api/health`
- **Mensagens canal:** `GET/POST /api/servers/:serverId/channels/:channelId/messages`
- **Mensagens DM:** `GET/POST /api/dm/:conversationId/messages`
- **Amizades:** `POST /api/friend-requests`, `GET /api/friend-requests/received/:username`, `POST /api/friend-requests/:id/accept`, `GET /api/friends/:userId`
- **Conta:** `POST /api/account/delete`

## Tabelas (PostgreSQL)

- `liberty_users` — usuários (username, senha opcional)
- `liberty_servers` — servidores (incluindo "Liberty" global)
- `liberty_server_members` — membros dos servidores (novo usuário entra em Liberty)
- `liberty_messages` — mensagens (id, content, author_id, chat_id, created_at)
- `liberty_friend_requests` — amizades (status: pending, accepted)
