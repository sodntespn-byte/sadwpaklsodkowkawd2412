# Deploy Liberty na Square Cloud

## Arquivo de entrada (evitar MISSING_MAIN)

- O ponto de entrada da aplicação é **`backend/server.js`** (pasta `backend/`).
- O ficheiro **`squarecloud.app`** na raiz tem `START=npm install ... && node backend/server.js`.
- O **`package.json`** na raiz tem `"main": "backend/server.js"` e `"start": "node backend/server.js"`.
- A Square Cloud usa a **raiz do repositório**; o comando de arranque sobe o backend, que serve a API e o frontend (pasta `frontend/`).

## 1. Variáveis de ambiente

**Obrigatório:** configura no painel da Square Cloud em **Configurações → Environment**. Sem estas variáveis a aplicação **não inicia** ou retorna 503.

| Variável       | Obrigatório | Exemplo / Notas                                                                 |
| -------------- | ----------- | ------------------------------------------------------------------------------- |
| `JWT_SECRET`   | **Sim**     | String com **pelo menos 32 caracteres**. Sem isto a app para logo ao iniciar.   |
| `DATABASE_URL` | **Sim**     | Connection string do Neon. **Nome exato na Square Cloud:** `DATABASE_URL` (maiúsculas). No painel pode aparecer como "Database" — cria a variável com o **nome** `DATABASE_URL` e o **valor** da URL. Também aceita: `BANCO_DADOS`, `DB_URL`, `Database`, `DATABASE`. |
| `NODE_ENV`     | Não         | A Square Cloud costuma definir `production` automaticamente.                 |

**Como gerar um JWT_SECRET seguro (32+ caracteres):**
```bash
openssl rand -base64 32
```
Copia o resultado e cola no valor de `JWT_SECRET` no painel.

**Importante:** depois de adicionar ou alterar variáveis, é obrigatório **Redeploy** (ou Reiniciar) a aplicação — as variáveis são lidas apenas ao iniciar o processo.

- Nome exato: `DATABASE_URL` (tudo junto, maiúsculas). Podes colar a URL do Neon com `channel_binding=require`; o servidor remove esse parâmetro automaticamente.
- O backend usa **PostgreSQL** (Neon). Na primeira subida, o schema é aplicado automaticamente. Se as tabelas já existirem, os `CREATE` são ignorados.

## 2. Repositório e push

Repositório remoto correto:

```bash
git remote -v
# origin  https://github.com/sodntespn-byte/asdontellhimuinhim.git (fetch)
# origin  https://github.com/sodntespn-byte/asdontellhimuinhim.git (push)
```

Para enviar o código e a Square Cloud usar o main:

```bash
git add .
git commit -m "Deploy: backend + frontend, schema PostgreSQL"
git push origin main
```

Se o branch principal for `master`:

```bash
git push origin master
```

Depois do push, no dashboard Square Cloud: **Deploy** / **Commit** / **Update** para a plataforma puxar o código e reiniciar a app.

## 3. Schema manual (opcional)

Se quiseres aplicar o schema no Neon sem subir o servidor (por exemplo a partir da tua máquina):

```bash
npm run db:push
```

Requer `DATABASE_URL` no `.env` (na raiz) ou no ambiente.

## 4. Resumo de ficheiros importantes na raiz

| Ficheiro / Pasta   | Função |
|--------------------|--------|
| `backend/server.js` | Entrada da app (Express, API, WebSocket, servir frontend). |
| `squarecloud.app`   | Configuração Square Cloud (START, MEMORY, HOST). |
| `package.json`      | Scripts `start`, `db:push`; dependências. |
| `frontend/`         | Ficheiros estáticos servidos pelo backend. |
| `backend/db/`       | Schema e helpers PostgreSQL. |
