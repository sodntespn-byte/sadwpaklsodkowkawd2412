/**
 * LIBERTY - Backend Node.js + PostgreSQL (Neon) + Socket.io
 * Segurança: helmet, rate-limit, sanitização. Persistência: Pool Neon.
 * Uso: node index.js (requer POSTGRES_URL em .env)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const db = require('./db');
const api = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;
const WEB_ROOT = path.join(__dirname, '..', 'web');

// —— Segurança: headers (helmet) ——
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// —— Rate limit (evitar spam) ——
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  message: { error: 'Muitas requisições. Tente de novo em instantes.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(WEB_ROOT));

// —— API sob /api ——
app.use('/api', api);

// —— Servidor HTTP ——
const server = http.createServer(app);

// —— Socket.io (tempo real) ——
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: true },
  transports: ['websocket', 'polling']
});
app.set('io', io);

io.on('connection', (socket) => {
  socket.on('subscribe', (data) => {
    const room = data?.room || data;
    if (room && typeof room === 'string') {
      socket.join(room);
    }
  });
  socket.on('unsubscribe', (data) => {
    const room = data?.room || data;
    if (room && typeof room === 'string') {
      socket.leave(room);
    }
  });
  // WebRTC: sinalização por sala (voz/tela) — encaminha para outros na mesma conversa
  socket.on('webrtc-signal', (payload) => {
    const room = payload?.room;
    if (room && typeof room === 'string') {
      socket.to(room).emit('webrtc-signal', { ...payload, from: socket.id });
    }
  });
});

// —— Inicialização: criar tabelas e subir ——
async function main() {
  if (db.pool) {
    try {
      await db.ensureTables();
      console.log('Banco PostgreSQL (Neon) conectado e tabelas prontas.');
    } catch (e) {
      console.error('Erro ao inicializar banco:', e.message);
    }
  } else {
    console.warn('POSTGRES_URL não definido. Defina em .env para persistir dados.');
  }
  server.listen(PORT, () => {
    console.log('Liberty servidor: http://localhost:' + PORT);
    console.log('Socket.io: ws://localhost:' + PORT + '/socket.io');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
