# VoiceRoom

Sistema de salas de voz em tempo real (WebRTC + Socket.IO + Fastify + Next.js). Inspirado no conceito de salas de voz tipo Discord/Slack/Teams, com arquitetura modular e base sólida para produção.

## Visão geral

- **Frontend**: Next.js 14, TypeScript, Tailwind, Zustand, Socket.IO client, WebRTC (mesh).
- **Backend HTTP**: Fastify, Prisma, PostgreSQL, JWT (access + refresh), Argon2.
- **Signaling**: Socket.IO (join/leave, offer/answer/ICE, mute/speaking).
- **Infra**: Docker Compose (PostgreSQL, coturn para TURN/STUN).

## Estrutura do monorepo

```
voiceroom/
├── apps/
│   ├── server/     # API REST + signaling Socket.IO
│   └── web/        # Next.js (login, dashboard, sala de voz)
├── packages/
│   └── shared/     # Tipos, eventos e schemas Zod compartilhados
├── docker-compose.yml
├── .env.example
└── README.md
```

## Requisitos

- Node.js 20+
- pnpm 9+
- PostgreSQL 14+ (ou use Docker)
- (Opcional) coturn para TURN em redes restritas

## Instalação e execução local

### 1. Variáveis de ambiente

```bash
cp .env.example .env
# Edite .env: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET (mín. 32 caracteres cada)
```

### 2. Banco de dados

```bash
# Com PostgreSQL rodando localmente
export DATABASE_URL="postgresql://user:pass@localhost:5432/voiceroom"
pnpm --filter @voiceroom/server db:migrate
# Opcional: pnpm --filter @voiceroom/server db:seed
```

### 3. Servidor (API + signaling)

```bash
pnpm --filter @voiceroom/server dev
# Servidor em http://localhost:4000
```

### 4. Frontend

```bash
pnpm --filter @voiceroom/web dev
# Frontend em http://localhost:3000
```

Defina no frontend (ou `.env.local` em `apps/web`):

- `NEXT_PUBLIC_API_URL=http://localhost:4000`

### 5. Com Docker Compose

```bash
# Na pasta voiceroom/
docker compose up -d postgres coturn
# Ajuste .env com DATABASE_URL apontando para postgres:5432 se o server rodar no host
pnpm --filter @voiceroom/server db:migrate
pnpm --filter @voiceroom/server dev
pnpm --filter @voiceroom/web dev
```

Para subir o server também no Docker:

```bash
docker compose up -d
# Server em 4000, Postgres em 5432. Rode o frontend localmente com NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Fluxos principais

1. **Login**: POST /auth/login → accessToken + refreshToken; GET /auth/me com Bearer.
2. **Entrar na sala**: usuário abre /room/:id; frontend pede microfone, conecta Socket.IO com auth, emite `join-room`; servidor valida (capacidade, senha, sala privada) e envia `room-state` + broadcast `participant-joined`.
3. **WebRTC (mesh)**: cada par troca offer/answer e ICE via Socket.IO (`rtc-offer`, `rtc-answer`, `rtc-ice-candidate`). Áudio local via `getUserMedia` → `addTrack`; áudio remoto em `ontrack` → elemento `<audio autoplay>`.
4. **Mute / Speaking**: cliente emite `mute-state-changed` e `speaking-state-changed`; servidor repassa para a sala. Speaking detection no cliente via Web Audio API (AnalyserNode + RMS).

## Endpoints HTTP (resumo)

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | /auth/register | — | Registrar |
| POST | /auth/login | — | Login |
| POST | /auth/refresh | — | Renovar tokens |
| POST | /auth/logout | Sim | Logout |
| GET | /auth/me | Sim | Usuário atual |
| GET | /rooms | — | Listar salas públicas |
| GET | /rooms/my | Sim | Minhas salas |
| POST | /rooms | Sim | Criar sala |
| GET | /rooms/:id | Opcional | Detalhe da sala |
| PATCH | /rooms/:id | Sim | Atualizar (owner/admin) |
| DELETE | /rooms/:id | Sim | Excluir (owner) |
| POST | /rooms/:id/join-intent | Sim | Validar entrada (senha/invite) |
| POST | /rooms/:id/invite | Sim | Criar convite |
| POST | /rooms/:id/kick | Sim | Expulsar usuário |
| GET/PATCH | /users/me | Sim | Perfil |

## Eventos Socket.IO

| Evento | Direção | Descrição |
|--------|---------|-----------|
| join-room | C→S | Entrar na sala (payload: roomId, password?) |
| leave-room | C→S | Sair da sala |
| room-state | S→C | Lista de participantes na sala |
| participant-joined | S→C | Novo participante |
| participant-left | S→C | Participante saiu |
| rtc-offer | C→S / S→C | Offer WebRTC (relay para targetSocketId) |
| rtc-answer | C→S / S→C | Answer WebRTC |
| rtc-ice-candidate | C→S / S→C | ICE candidate |
| mute-state-changed | C→S / S→C | Mudo/desmudo |
| speaking-state-changed | C→S / S→C | Falando/silêncio |
| room-full, room-not-found, access-denied | S→C | Erros de sala |
| error | S→C | Erro genérico |

Conexão Socket.IO exige autenticação: `auth: { accessToken }` no handshake.

## STUN / TURN

- **STUN**: descoberta de IP público e porta (ex.: `stun:stun.l.google.com:19302`). Usado nos `iceServers` do `RTCPeerConnection`.
- **TURN**: relay de mídia quando o NAT bloqueia P2P. Necessário em redes corporativas/restritas.
- **coturn**: no projeto está no Docker Compose; variáveis `COTURN_REALM`, `COTURN_AUTH_USER`, `COTURN_AUTH_PASS`. No frontend use `NEXT_PUBLIC_TURN_SERVER_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_PASSWORD` para preencher `iceServers`.

## Limitações do MVP (mesh)

- **Mesh**: cada participante mantém uma conexão RTC com cada outro. Número de conexões por usuário = (N-1). Banda de upload por usuário ≈ (N-1) × bitrate de áudio.
- **Escala sugerida**: até ~6–8 participantes por sala em máquinas comuns; acima disso considerar SFU (mediasoup, LiveKit, Janus).
- **Migração para SFU**: trocar a lógica de “um peer por participante” por “um peer com o servidor SFU”; signaling pode manter os mesmos eventos; o servidor SFU recebe um stream por participante e redistribui.

## Segurança

- Senhas com Argon2id; JWT de acesso curto; refresh token em DB com rotação.
- Validação de payloads (Zod) no HTTP e no Socket.
- Rate limiting e Helmet no Fastify.
- Salas privadas e com senha validadas no join (HTTP e Socket).

## Testes

```bash
pnpm --filter @voiceroom/server test
```

## Checklist de produção

- [ ] HTTPS para API e frontend
- [ ] CORS e FRONTEND_URL corretos
- [ ] Secrets (JWT, DB, TURN) em variáveis de ambiente seguras
- [ ] Migrations aplicadas (prisma migrate deploy)
- [ ] TURN em servidor com IP público e portas 3478/5349
- [ ] Logs e monitoração (ex.: health /health)
- [ ] Redis adapter para Socket.IO se múltiplas instâncias do server
