# Backend — Liberty

API Node.js (Express), WebSocket, autenticação JWT e persistência PostgreSQL. Toda a lógica do servidor fica nesta pasta.

---

## Onde está cada coisa

```
backend/
├── server.js              ← Entrada da aplicação (API + WebSocket + servir frontend)
├── message-cache.js       ← Cache de mensagens (memória ou Redis)
├── db/
│   ├── schema.js          ← Schema da base de dados (Drizzle)
│   └── index.js            ← Conexão PostgreSQL (mTLS, pool)
├── src/
│   ├── config.js          ← Configuração (porta, STATIC_DIR, CORS, rate limit)
│   ├── lib/
│   │   └── logger.js       ← Logger seguro (redacta senhas/tokens)
│   ├── middleware/
│   │   └── validate.js     ← Validação Joi e schemas dos pedidos
│   └── routes/
│       └── auth.js         ← Rotas de autenticação (registar, login, refresh)
├── uploads/               ← Ficheiros enviados (avatares, ícones) — criado em runtime
└── README.md              ← Este ficheiro
```

### Tabela de referência rápida

| Quero… | Ficheiro / Pasta |
|--------|------------------|
| Alterar porta, CORS, rate limit, pasta do frontend | `src/config.js` |
| Adicionar ou alterar rotas da API | `server.js` |
| Alterar login, registo ou refresh de token | `src/routes/auth.js` |
| Alterar validação do body dos pedidos | `src/middleware/validate.js` |
| Alterar schema da base de dados | `db/schema.js` |
| Ver como se conecta ao PostgreSQL | `db/index.js` |
| Alterar cache de mensagens | `message-cache.js` |
| Onde ficam avatares e ícones enviados | `uploads/` (criado automaticamente) |

---

## Variáveis de ambiente

Defina na **raiz** do repositório (`.env`) ou no painel do host (Square Cloud: Configurações → Environment):

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim (produção) | URL PostgreSQL (Neon). |
| `JWT_SECRET` | Sim (produção) | Mínimo 32 caracteres. |
| `ADMIN_USERNAMES` | Não | Usernames de admins, separados por vírgula. |
| `ALLOWED_ORIGIN` / `CORS_ORIGIN` | Não | Origens CORS. |
| `RATE_LIMIT_MAX` | Não | Requisições por minuto por IP (padrão 200). |

---

## Executar

Na **raiz** do repositório:

```bash
npm install
npm start
```

O servidor sobe na porta definida em `PORT` (ou 3000), serve a API em `/api/v1` e o frontend a partir da pasta `frontend/`.

Documentação de deploy e segurança: pasta **`docs/`** na raiz. Mapa completo do projeto: **`ESTRUTURA.md`** na raiz.
