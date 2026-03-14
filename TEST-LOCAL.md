# Testar o site em localhost

Antes de fazer push para o GitHub, podes testar a aplicação localmente.

## Servidor completo (com API e base de dados)

```bash
npm start
```

Abre **http://localhost:3000** no browser.

## Servidor só estático (opcional)

Para ver apenas a interface sem API:

```bash
npm run test:local
```

Abre **http://localhost:8080**. O login e o chat não funcionam (não há backend).
