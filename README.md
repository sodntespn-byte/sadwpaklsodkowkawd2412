# LIBERTY

Chat moderno com criptografia, mensagens em canais e DMs, amigos e servidores. Funciona 100% no navegador (modo offline) e opcionalmente com backend (Node, Vercel, Postgres).

## Compatível com GitHub

- **Clone e uso local** — basta ter Node 18+ e fazer clone do repositório.
- **GitHub Actions** — CI em todo push/PR; deploy automático no GitHub Pages.
- **GitHub Pages** — o app estático é publicado em `https://<user>.github.io/<repo>/` após cada push em `main`.

### Publicar no GitHub Pages

1. **Envie o repositório para o GitHub** (se ainda não estiver):
   ```bash
   git remote add origin https://github.com/<seu-usuario>/<repo>.git
   git push -u origin main
   ```

2. **Ative o GitHub Pages pelo Actions**:
   - Repositório → **Settings** → **Pages**
   - Em **Build and deployment**, em **Source** escolha **GitHub Actions**.

3. **Rode o deploy**:
   - O workflow **Deploy GitHub Pages** roda em todo push na branch `main`.
   - Ou em **Actions** → **Deploy GitHub Pages** → **Run workflow**.

4. **Acesse o site** em:
   `https://<seu-usuario>.github.io/<nome-do-repo>/`

### Rodar localmente

```bash
git clone https://github.com/<seu-usuario>/<repo>.git
cd <repo>
npm install
```

- **Só o frontend (estático):** sirva a pasta `liberty/web` com qualquer servidor, por exemplo:
  ```bash
  npx serve liberty/web
  ```
  Depois abra `http://localhost:3000`.

- **Com API (Node):** use o servidor em `liberty/server` ou as funções em `api/` (Vercel). Para Postgres (Neon), defina `POSTGRES_URL` ou `DATABASE_URL` no ambiente.

### Estrutura do repositório

| Pasta / arquivo      | Descrição                          |
|----------------------|------------------------------------|
| `liberty/web/`       | App estático (HTML, CSS, JS)       |
| `liberty/server/`    | Servidor Node (API opcional)        |
| `api/`               | Funções serverless (Vercel)         |
| `.github/workflows/` | CI e deploy (GitHub Actions)       |

### Branch padrão

Os workflows usam a branch **main**. Se o seu repositório usar **master**, altere em:

- `.github/workflows/ci.yml` → `branches: [main, master]`
- `.github/workflows/deploy-pages.yml` → `branches: [main]` para `master` (se for o caso).

### Variáveis de ambiente (opcional)

Para API/backend (Vercel, Node ou outro host):

- `POSTGRES_URL` ou `DATABASE_URL` — connection string do Postgres (ex.: Neon) para persistir mensagens e amigos.

O app funciona sem backend: dados ficam no navegador (localStorage/IndexedDB).

## Licença

Conforme definido no projeto.
