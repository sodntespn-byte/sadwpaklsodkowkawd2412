# Código fonte do backend

Esta pasta contém a lógica organizada do servidor (configuração, utilitários, middleware, rotas).

| Pasta / Ficheiro | Função |
|------------------|--------|
| **config.js** | Constantes da aplicação: `PORT`, `STATIC_DIR` (pasta do frontend), `ALLOWED_ORIGINS`, `RATE_LIMIT_MAX`, `isProduction`. Tudo a partir de variáveis de ambiente. |
| **lib/logger.js** | Logger que nunca regista senhas, tokens nem credenciais. Uso: `logger.info()`, `logger.warn()`, `logger.error()`. |
| **middleware/validate.js** | Validação de pedidos com Joi. Exporta `schemas` (registar, login, refresh, mensagens) e `validateBody(schema)`. |
| **routes/auth.js** | Rotas de autenticação: registar, login, refresh. Exporta `registerAuthRoutes(router, deps)`. |

Para adicionar novas rotas ou middleware, edita `server.js` na pasta `backend/` e, se fizer sentido, cria novos ficheiros aqui (por exemplo `routes/users.js`).
