# Deploy na Netlify

## Sincronizar mensagens e solicitações de amizade

Para **mensagens e amizades sincronizarem**, é preciso:

1. **Fazer deploy pelo Git** (não só arrastar a pasta), para a Netlify publicar o site **e** as funções da API.
2. **Configurar um banco Postgres** (ex.: Neon) e definir a variável **`POSTGRES_URL`** no site da Netlify.

Sem isso, o app abre mas tudo fica só no navegador (localStorage); não há backend para persistir nem sincronizar.

---

## Passo a passo (com API e sync)

### 1. Banco de dados (Neon ou outro Postgres)

1. Crie uma conta em [neon.tech](https://neon.tech) (ou use outro Postgres).
2. Crie um projeto e copie a **connection string** (algo como `postgresql://user:pass@host/dbname?sslmode=require`).

### 2. Deploy na Netlify por Git

1. Envie o projeto para um repositório (GitHub, GitLab ou Bitbucket).
2. Em [app.netlify.com](https://app.netlify.com): **Add new site → Import an existing project** e escolha o repositório.
3. A Netlify usa o `netlify.toml`: **Publish directory** = `liberty/web`, **Build command** = `npm install`, **Functions** = `netlify/functions`. Não precisa mudar nada se o arquivo estiver na raiz.
4. Antes de dar deploy, em **Site settings → Environment variables** (ou no assistente de importação), adicione:
   - **Key:** `POSTGRES_URL`  
   - **Value:** a connection string do Postgres (ex.: a do Neon).  
   - **Scopes:** marque **All** ou pelo menos **Production**.
5. Faça o **Deploy** (ou **Trigger deploy**).

Com isso, o site é servido de `liberty/web` e as chamadas para `/api/*` vão para a function que usa o mesmo código da API (mensagens, amizades, etc.) e o Postgres.

### 3. Conferir se a API está no ar

Abra no navegador:

`https://SEU-SITE.netlify.app/api/health`

Deve retornar algo como: `{"ok":true,"vercel":true,"ws":false}`.  
Se der 404 ou erro, confira se o deploy foi feito a partir do repositório (não deploy manual) e se a variável `POSTGRES_URL` está definida.

---

## Deploy só estático (sem sync)

Se você **só quiser o site estático** (sem mensagens/amizades na nuvem):

- **Deploy manual:** arraste a pasta **liberty/web** para a área “Deploy manually” da Netlify. O site abre, mas mensagens e amizades ficam só no dispositivo (localStorage).

---

## Se aparecer "Page not found" (404)

- Deploy por Git: em **Build & deploy**, confira **Publish directory** = `liberty/web`.
- Deploy manual: a pasta que você arrastar deve ter `index.html` na raiz (por exemplo o conteúdo de `liberty/web`).

---

## Resumo

| Objetivo                         | Como fazer                                      | Variável `POSTGRES_URL` |
|----------------------------------|--------------------------------------------------|--------------------------|
| Site + mensagens/amizades sync   | Deploy por **Git** (repo com o projeto todo)    | **Obrigatório**          |
| Só o site (tudo local)          | Deploy **manual** da pasta `liberty/web`        | Não precisa              |
