# Deploy Liberty na Square Cloud

## Arquivo de entrada (evitar MISSING_MAIN)

- O ponto de entrada da aplicação é **`server.js` na raiz** do repositório.
- O ficheiro **`squarecloud.app`** deve ter exatamente: `MAIN=server.js`
- O **`package.json`** tem `"main": "server.js"` e o script `"start": "node server.js"`.
- Ao fazer deploy, a Square Cloud usa a **raiz do repositório**; não coloques o projeto dentro de uma subpasta (ex.: `src/`) se o teu `server.js` estiver na raiz no GitHub.

## 1. Variáveis de ambiente

**Obrigatório:** configura no painel da Square Cloud em **Configurações → Environment**. Sem estas variáveis a aplicação **não inicia** ou retorna 503.

| Variável       | Obrigatório | Exemplo / Notas                                                                 |
| -------------- | ----------- | ------------------------------------------------------------------------------- |
| `JWT_SECRET`   | **Sim**     | String com **pelo menos 32 caracteres**. Sem isto a app para logo ao iniciar.   |
| `DATABASE_URL` | **Sim**     | `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require` |
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
git commit -m "Deploy: entry server.js, schema PostgreSQL"
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

Requer `DATABASE_URL` no `.env` ou no ambiente.

## 4. Resumo de ficheiros importantes na raiz

- `server.js` — entrada da app (MAIN)
- `squarecloud.app` — MAIN=server.js, MEMORY=256, HOST=0.0.0.0
- `package.json` — main + scripts start / db:push
- `db/schema.sql` — tabelas PostgreSQL
- `db/init.js` — aplica o schema ao conectar
