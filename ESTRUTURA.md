# Mapa do projeto — Liberty

Este ficheiro indica **onde está cada coisa** no repositório. Use como referência rápida.

---

## Visão geral

**Código da aplicação Liberty:** apenas em **`backend/`** e **`frontend/`**. O resto são configuração, documentação e outros projetos.

```
libertyrealreal/
├── backend/          → Toda a API e servidor (Node.js) — entrada: backend/server.js
├── frontend/         → Toda a interface (HTML, CSS, JS, assets)
├── docs/             → Documentação (deploy, segurança, base de dados)
├── voiceroom/        → Projeto separado (salas de voz)
├── crates/           → Código Rust (opcional)
└── [ficheiros raiz]  → Configuração (package.json, squarecloud.app, etc.)
```

---

## Raiz do repositório

| Ficheiro / Pasta | Para que serve |
|------------------|----------------|
| `package.json` | Dependências e scripts (`npm start` → inicia o backend) |
| `.env.example` | Exemplo de variáveis de ambiente (copiar para `.env`) |
| `.gitignore` | Ficheiros e pastas que o Git ignora |
| `README.md` | Introdução ao projeto e como executar |
| `ESTRUTURA.md` | **Este ficheiro** — mapa da organização |
| `squarecloud.app` | Configuração de deploy na Square Cloud |
| `drizzle.config.js` | Configuração Drizzle (schema da BD) |
| `eslint.config.js` | Regras ESLint |
| `.prettierrc.json` / `.prettierrc` | Regras Prettier |
| `.prettierignore` | Ficheiros ignorados pelo Prettier |
| `dev-server.js` | Servidor de desenvolvimento (se usado) |

---

## backend/ — API e servidor

Tudo o que roda no servidor: API REST, WebSocket, autenticação, base de dados.

| Caminho | O que é |
|---------|--------|
| `backend/server.js` | **Entrada da aplicação.** Express, rotas API, WebSocket, servir frontend. |
| `backend/message-cache.js` | Cache de mensagens (memória ou Redis). |
| `backend/src/config.js` | Configuração (porta, pasta do frontend, CORS, rate limit). |
| `backend/src/lib/logger.js` | Logger seguro (não regista senhas/tokens). |
| `backend/src/middleware/validate.js` | Validação de pedidos (Joi) e schemas. |
| `backend/src/routes/auth.js` | Rotas de autenticação (registar, login, refresh). |
| `backend/db/schema.js` | Schema da base de dados (Drizzle). |
| `backend/db/index.js` | Helpers de conexão PostgreSQL (mTLS, etc.). |
| `backend/uploads/` | Ficheiros enviados pelos utilizadores (avatares, ícones de servidor). Criado em runtime. |
| `backend/README.md` | Detalhes da pasta backend. |

**Resumo:** Para alterar a API ou a lógica do servidor, edite ficheiros em `backend/`. A entrada é sempre `backend/server.js`.

---

## frontend/ — Interface

Tudo o que o browser carrega: páginas, estilos, scripts.

| Caminho | O que é |
|---------|--------|
| `frontend/index.html` | Página principal (SPA). |
| `frontend/404.html` | Página de erro 404. |
| `frontend/css/` | Folhas de estilo. Ver `frontend/css/README.md`. |
| `frontend/js/` | Scripts da aplicação. Ver `frontend/js/README.md`. |
| `frontend/assets/` | Imagens (logo, ícones). |
| `frontend/README.md` | Detalhes da pasta frontend. |

**Resumo:** Para alterar o aspecto ou o comportamento da interface, edite ficheiros em `frontend/` (HTML em `frontend/`, estilos em `frontend/css/`, lógica em `frontend/js/`).

---

## docs/ — Documentação

Documentos sobre deploy, segurança e base de dados.

| Ficheiro | Conteúdo |
|----------|----------|
| `docs/README.md` | Índice da documentação. |
| `docs/SECURITY.md` | Segurança e privacidade (variáveis, Helmet, CORS, cookies). |
| `docs/SQUARECLOUD.md` | Como fazer deploy na Square Cloud. |
| `docs/DATABASE.md` | Informações sobre a base de dados (PostgreSQL/Neon). |

---

## Outras pastas na raiz

| Pasta | Descrição |
|-------|-----------|
| `voiceroom/` | Projeto separado (salas de voz, stack própria). |
| `crates/` | Código Rust (liberty-server, liberty-core, etc.), se usado. |
| `node_modules/` | Dependências instaladas com `npm install` (não editar). |

---

## Onde fazer cada tipo de alteração

| Quero… | Onde ir |
|--------|---------|
| Mudar porta, CORS, rate limit | `backend/src/config.js` |
| Adicionar/alterar rotas da API | `backend/server.js` ou `backend/src/routes/` |
| Alterar login/registo | `backend/src/routes/auth.js` |
| Alterar validação de pedidos | `backend/src/middleware/validate.js` |
| Alterar esquema da BD | `backend/db/schema.js` (e migrações no `server.js` se aplicável) |
| Alterar aparência da app | `frontend/css/` e `frontend/index.html` |
| Alterar lógica da interface (JS) | `frontend/js/` |
| Alterar logo / imagens | `frontend/assets/` |
| Documentar deploy | `docs/SQUARECLOUD.md` |
| Documentar segurança | `docs/SECURITY.md` |

---

*Última atualização: organização da pasta para referência rápida.*
