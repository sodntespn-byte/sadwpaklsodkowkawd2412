# LIBERTY - React + TypeScript

Versão do aplicativo LIBERTY migrada para React.js e TypeScript, com Tailwind CSS e animações via Framer Motion.

## Identidade Visual Mantida

- **Cores**: Preto (#000), amarelo (#FFFF00), dourado (#FFD700)
- **Fonte**: Inter
- **Layout**: Barra de servidores, canais, área de mensagens, membros

## Tecnologias

- **React 18** + **TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Estilização
- **Framer Motion** - Animações

## Instalação

```bash
cd liberty/web-react
npm install
```

## Desenvolvimento

```bash
npm run dev
```

## Build

```bash
npm run build
```

Os arquivos de produção ficam em `dist/`. Para usar no app desktop:

1. Execute `npm run build` nesta pasta
2. Copie todo o conteúdo de `dist/` para `liberty/web/` (substituindo os arquivos existentes)
3. O desktop carregará automaticamente o novo build

## Estrutura

```
src/
├── components/
│   ├── auth/          # Login, Register
│   ├── layout/        # ServerBar, ChannelBar, MainContent, etc.
│   └── modals/        # CreateServer, Settings
├── context/           # AppContext (estado global)
├── types/             # Interfaces TypeScript
└── utils/             # uuid, storage
```
