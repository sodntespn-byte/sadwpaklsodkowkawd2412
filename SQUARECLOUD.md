# Deploy Liberty na Square Cloud

O Liberty está configurado como aplicação Node.js 100% compatível com a Square Cloud.

## Configuração

O arquivo **`squarecloud.app`** na raiz define:

- **MAIN=server.js** — ponto de entrada da aplicação
- **MEMORY=256** — memória alocada (MB)
- **VERSION=recommended** — versão recomendada do Node

O **package.json** usa `"start": "node server.js"`.

## Variáveis de ambiente na Square Cloud

**Importante:** O arquivo `.env` não é enviado no deploy (está no .gitignore). Para o banco funcionar na Square Cloud, defina as variáveis no painel do app:

1. Abra seu app na Square Cloud → **Configurações** / **Environment Variables** (ou **Variáveis de ambiente**).
2. Adicione:
   - **Nome:** `POSTGRES_URL`
   - **Valor:** sua connection string do Neon, por exemplo:
     ```
     postgresql://usuario:senha@host.neon.tech/neondb?sslmode=require
     ```
3. Salve e reinicie o app.

Sem `POSTGRES_URL`, o servidor sobe mas mensagens e amizades não são persistidas (aparece o aviso no log).

| Variável       | Descrição |
|----------------|-----------|
| `POSTGRES_URL` | **Obrigatório** para o banco. Connection string do Neon |
| `PORT`         | Opcional; a Square Cloud define a porta |
| `SESSION_SECRET` | Opcional; segredo para tokens de sessão |

## O que o servidor faz

- **API REST** em `/api/*` (auth, mensagens, amizades)
- **Arquivos estáticos** da pasta **`public/`**
- **Socket.io** em `/socket.io` para mensagens em tempo real, notificações de amizade e status online
- **WebRTC** sinalizado via Socket.io (chamada e compartilhamento de tela pelo ID do chat atual)

## Deploy

1. Envie o repositório para a Square Cloud (ou faça upload do projeto).
2. Garanta que a variável `POSTGRES_URL` está definida.
3. A Square Cloud usará `npm start` → `node server.js` para iniciar a aplicação.
