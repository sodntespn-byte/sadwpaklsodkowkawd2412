/**
 * LIBERTY — Dev Mock Server
 * Serve os arquivos estáticos + simula a API REST e WebSocket
 * para visualização do frontend sem precisar do backend Rust.
 *
 * Usage: node dev-server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT_DEFAULT = 8080;
let PORT = Number(process.env.PORT) || PORT_DEFAULT;
const STATIC_DIR = path.join(__dirname, 'static');

function ago(minutes) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

// ── Dados mock ────────────────────────────────────────────────────

const MOCK_USER = {
  id: 'usr-001',
  username: 'você',
  display_name: 'Você',
  email: 'user@liberty.app',
  avatar: null,
  status: 'online',
  created_at: new Date().toISOString(),
};

const MOCK_SERVERS = [
  {
    id: 'srv-001',
    name: 'LIBERTY HQ',
    icon: null,
    owner_id: 'usr-001',
    region: 'sa-east',
    created_at: new Date().toISOString(),
  },
  {
    id: 'srv-002',
    name: 'Dev Team',
    icon: null,
    owner_id: 'usr-001',
    region: 'sa-east',
    created_at: new Date().toISOString(),
  },
];

const MOCK_CHANNELS = {
  'srv-001': [
    { id: 'cat-001', name: 'Text Channels', channel_type: 'category', parent_id: null, server_id: 'srv-001' },
    {
      id: 'ch-001',
      name: 'general',
      channel_type: 'text',
      parent_id: 'cat-001',
      server_id: 'srv-001',
      topic: 'Bem-vindo ao servidor LIBERTY 🟡',
    },
    {
      id: 'ch-002',
      name: 'announcements',
      channel_type: 'text',
      parent_id: 'cat-001',
      server_id: 'srv-001',
      topic: 'Novidades e atualizações',
    },
    {
      id: 'ch-003',
      name: 'off-topic',
      channel_type: 'text',
      parent_id: 'cat-001',
      server_id: 'srv-001',
      topic: 'Papo livre 🎉',
    },
    { id: 'cat-002', name: 'Voice Channels', channel_type: 'category', parent_id: null, server_id: 'srv-001' },
    { id: 'vc-001', name: 'Geral', channel_type: 'voice', parent_id: 'cat-002', server_id: 'srv-001' },
  ],
  'srv-002': [
    {
      id: 'ch-010',
      name: 'general',
      channel_type: 'text',
      parent_id: null,
      server_id: 'srv-002',
      topic: 'Canal do time',
    },
    {
      id: 'ch-011',
      name: 'code-review',
      channel_type: 'text',
      parent_id: null,
      server_id: 'srv-002',
      topic: 'Revisão de código',
    },
  ],
};

const MOCK_MEMBERS = {
  'srv-001': [
    {
      user_id: 'usr-001',
      username: 'você',
      display_name: 'Você',
      nickname: null,
      status: 'online',
      avatar: null,
      roles: ['role-001', 'role-004'],
    },
    {
      user_id: 'usr-002',
      username: 'alice',
      display_name: 'Alice',
      nickname: 'Alice',
      status: 'online',
      avatar: null,
      roles: ['role-002'],
    },
    {
      user_id: 'usr-003',
      username: 'bob',
      display_name: 'Bob',
      nickname: 'Bob',
      status: 'idle',
      avatar: null,
      roles: ['role-003'],
    },
    {
      user_id: 'usr-004',
      username: 'carol',
      display_name: 'Carol',
      nickname: null,
      status: 'dnd',
      avatar: null,
      roles: ['role-002', 'role-003'],
    },
    {
      user_id: 'usr-005',
      username: 'dave',
      display_name: 'Dave',
      nickname: 'Dave',
      status: 'offline',
      avatar: null,
      roles: ['role-003'],
    },
    {
      user_id: 'usr-006',
      username: 'eva',
      display_name: 'Eva',
      nickname: null,
      status: 'offline',
      avatar: null,
      roles: ['role-003'],
    },
  ],
  'srv-002': [
    {
      user_id: 'usr-001',
      username: 'você',
      display_name: 'Você',
      nickname: 'Lead Dev',
      status: 'online',
      avatar: null,
      roles: ['role-010'],
    },
    {
      user_id: 'usr-007',
      username: 'frank',
      display_name: 'Frank',
      nickname: 'Frank',
      status: 'online',
      avatar: null,
      roles: ['role-011'],
    },
    {
      user_id: 'usr-008',
      username: 'grace',
      display_name: 'Grace',
      nickname: null,
      status: 'online',
      avatar: null,
      roles: ['role-011'],
    },
  ],
};

const MOCK_MESSAGES = {
  'ch-001': [
    {
      id: 'msg-001',
      channel_id: 'ch-001',
      author: { id: 'usr-002', username: 'alice' },
      content: 'Oi pessoal! 👋',
      created_at: ago(120),
      reactions: {},
    },
    {
      id: 'msg-002',
      channel_id: 'ch-001',
      author: { id: 'usr-003', username: 'bob' },
      content: 'E aí! Como vocês estão?',
      created_at: ago(115),
      reactions: {},
    },
    {
      id: 'msg-003',
      channel_id: 'ch-001',
      author: { id: 'usr-002', username: 'alice' },
      content: 'Cara, o novo design do LIBERTY ficou **incrível**!',
      created_at: ago(110),
      reactions: {},
    },
    {
      id: 'msg-004',
      channel_id: 'ch-001',
      author: { id: 'usr-004', username: 'carol' },
      content: 'Concordo! O glassmorphism ficou muito bonito 🔥',
      created_at: ago(100),
      reactions: {},
    },
    {
      id: 'msg-005',
      channel_id: 'ch-001',
      author: { id: 'usr-003', username: 'bob' },
      content: 'A teoria das cores foi bem aplicada, os pretos quentes combinam perfeitamente com o ouro.',
      created_at: ago(90),
      reactions: {},
    },
    {
      id: 'msg-006',
      channel_id: 'ch-001',
      author: { id: 'usr-005', username: 'dave' },
      content: 'Acabei de entrar e já estou impressionado com a UI 🤩',
      created_at: ago(80),
      reactions: {},
    },
    {
      id: 'msg-007',
      channel_id: 'ch-001',
      author: { id: 'usr-001', username: 'você' },
      content: 'Obrigado! Usamos Glassmorphism + Neon Glow + regra 60-30-10 na paleta 🎨',
      created_at: ago(70),
      reactions: {},
    },
    {
      id: 'msg-008',
      channel_id: 'ch-001',
      author: { id: 'usr-002', username: 'alice' },
      content: 'Esse efeito de glow no logo é top demais ✨',
      created_at: ago(60),
      reactions: {},
    },
    {
      id: 'msg-009',
      channel_id: 'ch-001',
      author: { id: 'usr-004', username: 'carol' },
      content: 'Os anéis pulsantes ao redor do logo na loading screen são perfeitos!',
      created_at: ago(50),
      reactions: {},
    },
    {
      id: 'msg-010',
      channel_id: 'ch-001',
      author: { id: 'usr-003', username: 'bob' },
      content: 'O indicador de digitação agora funciona de verdade também 💪',
      created_at: ago(40),
      reactions: {},
    },
    {
      id: 'msg-011',
      channel_id: 'ch-001',
      author: { id: 'usr-006', username: 'eva' },
      content: 'Alguém testou a parte de DMs? Ficou ótima!',
      created_at: ago(30),
      reactions: {},
    },
    {
      id: 'msg-012',
      channel_id: 'ch-001',
      author: { id: 'usr-001', username: 'você' },
      content: 'Sim! DMs, friends list, pinned messages — tudo novo nessa versão.',
      created_at: ago(20),
      reactions: {},
    },
    {
      id: 'msg-013',
      channel_id: 'ch-001',
      author: { id: 'usr-003', username: 'bob' },
      content: 'Os roles com cores ficaram muito bons na member list 🎨',
      created_at: ago(10),
      reactions: {},
    },
    {
      id: 'msg-014',
      channel_id: 'ch-001',
      author: { id: 'usr-002', username: 'alice' },
      content: 'Bem-vindo ao LIBERTY — **Freedom to Connect** 🕊️',
      created_at: ago(1),
      reactions: {},
    },
  ],
  'ch-002': [
    {
      id: 'msg-020',
      channel_id: 'ch-002',
      author: { id: 'usr-001', username: 'você' },
      content: '📢 **v1.0.0 lançada!** Frontend totalmente renovado com Web3 UI.',
      created_at: ago(120),
      reactions: {},
    },
  ],
  'ch-003': [
    {
      id: 'msg-040',
      channel_id: 'ch-003',
      author: { id: 'usr-003', username: 'bob' },
      content: 'Alguém jogando alguma coisa hoje?',
      created_at: ago(180),
      reactions: {},
    },
    {
      id: 'msg-041',
      channel_id: 'ch-003',
      author: { id: 'usr-005', username: 'dave' },
      content: 'Bora Valorant! 🎯',
      created_at: ago(170),
      reactions: {},
    },
    {
      id: 'msg-042',
      channel_id: 'ch-003',
      author: { id: 'usr-004', username: 'carol' },
      content: 'Não posso hoje, tô em deadline 😭',
      created_at: ago(160),
      reactions: {},
    },
    {
      id: 'msg-043',
      channel_id: 'ch-003',
      author: { id: 'usr-002', username: 'alice' },
      content: 'Eu topo! Me chama no DM',
      created_at: ago(150),
      reactions: {},
    },
    {
      id: 'msg-044',
      channel_id: 'ch-003',
      author: { id: 'usr-006', username: 'eva' },
      content: 'Olha esse meme kkkk https://i.imgur.com/meme.jpg',
      created_at: ago(90),
      reactions: {},
    },
    {
      id: 'msg-045',
      channel_id: 'ch-003',
      author: { id: 'usr-003', username: 'bob' },
      content: 'KKKKKKK rachei 😂',
      created_at: ago(85),
      reactions: {},
    },
    {
      id: 'msg-046',
      channel_id: 'ch-003',
      author: { id: 'usr-001', username: 'você' },
      content: 'Galera, sexta que vem tem pizza na firma 🍕',
      created_at: ago(30),
      reactions: {},
    },
    {
      id: 'msg-047',
      channel_id: 'ch-003',
      author: { id: 'usr-005', username: 'dave' },
      content: 'BORA! 🎉',
      created_at: ago(25),
      reactions: {},
    },
  ],
  'ch-010': [
    {
      id: 'msg-030',
      channel_id: 'ch-010',
      author: { id: 'usr-007', username: 'frank' },
      content: 'PR #42 está pronto pra review 🔍',
      created_at: ago(30),
      reactions: {},
    },
    {
      id: 'msg-031',
      channel_id: 'ch-010',
      author: { id: 'usr-001', username: 'você' },
      content: 'Vou dar uma olhada agora',
      created_at: ago(25),
      reactions: {},
    },
  ],
  'ch-011': [
    {
      id: 'msg-050',
      channel_id: 'ch-011',
      author: { id: 'usr-007', username: 'frank' },
      content: 'Review do PR #38 — mudanças no WebSocket handler',
      created_at: ago(200),
      reactions: {},
    },
    {
      id: 'msg-051',
      channel_id: 'ch-011',
      author: { id: 'usr-001', username: 'você' },
      content: 'Acho que falta tratar o caso de reconexão. Se o client perder conexão o state fica inconsistente.',
      created_at: ago(190),
      reactions: {},
    },
    {
      id: 'msg-052',
      channel_id: 'ch-011',
      author: { id: 'usr-008', username: 'grace' },
      content: 'Concordo. Podemos usar um `session_id` pra resumir a sessão.',
      created_at: ago(185),
      reactions: {},
    },
    {
      id: 'msg-053',
      channel_id: 'ch-011',
      author: { id: 'usr-007', username: 'frank' },
      content: 'Boa ideia! Vou implementar e atualizar o PR.',
      created_at: ago(180),
      reactions: {},
    },
    {
      id: 'msg-054',
      channel_id: 'ch-011',
      author: { id: 'usr-001', username: 'você' },
      content:
        '```rust\npub async fn resume_session(session_id: &str) -> Result<Session> {\n    // lookup existing session\n}\n```\nAlgo assim?',
      created_at: ago(170),
      reactions: {},
    },
    {
      id: 'msg-055',
      channel_id: 'ch-011',
      author: { id: 'usr-008', username: 'grace' },
      content: 'Perfeito. Aprovado! ✅',
      created_at: ago(160),
      reactions: {},
    },
  ],
};

// ── DM Conversations ──────────────────────────────────────────────

const MOCK_DMS = [
  {
    id: 'dm-001',
    type: 'dm',
    recipients: [{ id: 'usr-002', username: 'alice', display_name: 'Alice', avatar: null, status: 'online' }],
    updated_at: ago(5),
  },
  {
    id: 'dm-002',
    type: 'dm',
    recipients: [{ id: 'usr-003', username: 'bob', display_name: 'Bob', avatar: null, status: 'idle' }],
    updated_at: ago(30),
  },
  {
    id: 'dm-003',
    type: 'dm',
    recipients: [{ id: 'usr-004', username: 'carol', display_name: 'Carol', avatar: null, status: 'dnd' }],
    updated_at: ago(120),
  },
];

// ── Friends / Relationships ──────────────────────────────────────
// type: 1=friend, 2=blocked, 3=pending_incoming, 4=pending_outgoing

const MOCK_RELATIONSHIPS = [
  {
    id: 'rel-001',
    type: 1,
    user: { id: 'usr-002', username: 'alice', display_name: 'Alice', avatar: null, status: 'online' },
  },
  {
    id: 'rel-002',
    type: 1,
    user: { id: 'usr-003', username: 'bob', display_name: 'Bob', avatar: null, status: 'idle' },
  },
  {
    id: 'rel-003',
    type: 1,
    user: { id: 'usr-004', username: 'carol', display_name: 'Carol', avatar: null, status: 'dnd' },
  },
  {
    id: 'rel-004',
    type: 1,
    user: { id: 'usr-005', username: 'dave', display_name: 'Dave', avatar: null, status: 'offline' },
  },
  {
    id: 'rel-005',
    type: 1,
    user: { id: 'usr-006', username: 'eva', display_name: 'Eva', avatar: null, status: 'offline' },
  },
  {
    id: 'rel-006',
    type: 1,
    user: { id: 'usr-007', username: 'frank', display_name: 'Frank', avatar: null, status: 'online' },
  },
  {
    id: 'rel-007',
    type: 1,
    user: { id: 'usr-008', username: 'grace', display_name: 'Grace', avatar: null, status: 'online' },
  },
];

// ── Pinned Messages ───────────────────────────────────────────────

const MOCK_PINNED = {
  'ch-001': [
    {
      id: 'msg-001',
      channel_id: 'ch-001',
      author: { id: 'usr-002', username: 'alice' },
      content: 'Oi pessoal! 👋',
      created_at: ago(120),
      pinned: true,
    },
    {
      id: 'msg-007',
      channel_id: 'ch-001',
      author: { id: 'usr-001', username: 'você' },
      content: 'Obrigado! Usamos Glassmorphism + Neon Glow + regra 60-30-10 na paleta 🎨',
      created_at: ago(70),
      pinned: true,
    },
  ],
};

// ── Roles ─────────────────────────────────────────────────────────

const MOCK_ROLES = {
  'srv-001': [
    { id: 'role-001', name: 'Admin', color: '#E53935', position: 3, permissions: 'all' },
    { id: 'role-002', name: 'Moderator', color: '#1E88E5', position: 2, permissions: 'moderate' },
    { id: 'role-003', name: 'Member', color: '#43A047', position: 1, permissions: 'basic' },
    { id: 'role-004', name: 'VIP', color: '#FFD700', position: 2, permissions: 'basic' },
  ],
  'srv-002': [
    { id: 'role-010', name: 'Lead', color: '#FFD700', position: 2, permissions: 'all' },
    { id: 'role-011', name: 'Dev', color: '#1E88E5', position: 1, permissions: 'basic' },
  ],
};

// ── DM Messages ───────────────────────────────────────────────────

const MOCK_DM_MESSAGES = {
  'dm-001': [
    {
      id: 'dm-msg-001',
      channel_id: 'dm-001',
      author: { id: 'usr-002', username: 'alice' },
      content: 'Oi! Tudo bem?',
      created_at: ago(10),
    },
    {
      id: 'dm-msg-002',
      channel_id: 'dm-001',
      author: { id: 'usr-001', username: 'você' },
      content: 'Tudo ótimo! E você?',
      created_at: ago(8),
    },
    {
      id: 'dm-msg-003',
      channel_id: 'dm-001',
      author: { id: 'usr-002', username: 'alice' },
      content: 'Bem também! Vi o novo design do LIBERTY, ficou incrível!',
      created_at: ago(5),
    },
  ],
  'dm-002': [
    {
      id: 'dm-msg-010',
      channel_id: 'dm-002',
      author: { id: 'usr-003', username: 'bob' },
      content: 'Viu o novo update?',
      created_at: ago(35),
    },
    {
      id: 'dm-msg-011',
      channel_id: 'dm-002',
      author: { id: 'usr-001', username: 'você' },
      content: 'Sim! Ficou muito bom',
      created_at: ago(30),
    },
  ],
  'dm-003': [
    {
      id: 'dm-msg-020',
      channel_id: 'dm-003',
      author: { id: 'usr-004', username: 'carol' },
      content: 'Meeting às 15h, não esquece!',
      created_at: ago(125),
    },
    {
      id: 'dm-msg-021',
      channel_id: 'dm-003',
      author: { id: 'usr-001', username: 'você' },
      content: 'Valeu pelo lembrete 👍',
      created_at: ago(120),
    },
  ],
};

// ── Simulated reply pool ──────────────────────────────────────────

const SIMULATED_USERS = [
  { id: 'usr-002', username: 'alice' },
  { id: 'usr-003', username: 'bob' },
  { id: 'usr-004', username: 'carol' },
  { id: 'usr-007', username: 'frank' },
  { id: 'usr-008', username: 'grace' },
];

const SIMULATED_REPLIES = [
  'Concordo! 👍',
  'Boa ideia!',
  'Haha verdade 😄',
  'Interessante...',
  'Demais! 🔥',
  'Show!',
  'Vou dar uma olhada',
  'Faz sentido',
  'Top demais!',
  'Pois é!',
  'Legal! ✨',
  'Hmm vou pensar nisso',
];

// ── MIME types ────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

// ── HTTP Server ───────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method.toUpperCase();

  if (url.pathname.startsWith('/api/')) {
    return handleAPI(req, res, url, method);
  }

  // Deixar /ws para o WebSocketServer fazer o upgrade (não responder aqui)
  if (url.pathname === '/ws') {
    return;
  }

  let filePath = path.join(STATIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname);

  if (url.pathname === '/404' || url.pathname === '/404.html') {
    filePath = path.join(STATIC_DIR, '404.html');
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    });
    return;
  }

  if (!fs.existsSync(filePath)) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

// ── API Handler ───────────────────────────────────────────────────

function handleAPI(req, res, url, method) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const p = url.pathname.replace('/api/v1', '');

  let body = '';
  req.on('data', c => (body += c));
  req.on('end', () => {
    let json = {};
    try {
      json = JSON.parse(body);
    } catch {}
    route(res, method, p, url, json);
  });
}

// ── Route Handler ─────────────────────────────────────────────────

function route(res, method, p, url, body) {
  const ok = (data, code = 200) => {
    res.writeHead(code);
    res.end(JSON.stringify(data));
  };
  const noContent = () => {
    res.writeHead(204);
    res.end();
  };
  const notFound = () => {
    res.writeHead(404);
    res.end(JSON.stringify({ message: 'Not found' }));
  };
  const bad = msg => {
    res.writeHead(400);
    res.end(JSON.stringify({ message: msg }));
  };

  // ── Auth ──────────────────────────────────────────────────────
  if (p === '/auth/register' || p === '/auth/login') {
    return ok({ access_token: 'mock-token-' + Date.now(), refresh_token: 'mock-refresh', user: MOCK_USER });
  }
  if (p === '/auth/logout') return noContent();
  if (p === '/auth/refresh') return ok({ access_token: 'mock-token-refresh', refresh_token: 'mock-refresh' });

  // ── Current user ──────────────────────────────────────────────
  if (p === '/users/@me' && method === 'GET') return ok(MOCK_USER);

  if (p === '/users/@me' && method === 'PATCH') {
    Object.assign(MOCK_USER, body);
    return ok(MOCK_USER);
  }

  // ── DM Channels ──────────────────────────────────────────────
  if (p === '/users/@me/channels' && method === 'GET') return ok(MOCK_DMS);

  if (p === '/users/@me/channels' && method === 'POST') {
    const recipientId = body.recipient_id;
    const existing = MOCK_DMS.find(d => d.recipients?.[0]?.id === recipientId);
    if (existing) return ok(existing);
    const rel = MOCK_RELATIONSHIPS.find(r => r.user?.id === recipientId);
    const newDm = {
      id: 'dm-' + Date.now(),
      type: 'dm',
      recipients: [
        {
          id: recipientId,
          username: rel?.user?.username || 'unknown',
          display_name: rel?.user?.display_name || 'Unknown',
          avatar: null,
          status: rel?.user?.status || 'offline',
        },
      ],
      updated_at: new Date().toISOString(),
    };
    MOCK_DMS.push(newDm);
    MOCK_DM_MESSAGES[newDm.id] = [];
    return ok(newDm, 201);
  }

  // ── Friends / Relationships ─────────────────────────────────
  if (p === '/users/@me/relationships' && method === 'GET') return ok(MOCK_RELATIONSHIPS);

  if (p === '/users/@me/relationships' && method === 'POST') {
    const newRel = {
      id: 'rel-' + Date.now(),
      type: 4,
      user: {
        id: 'usr-pending-' + Date.now(),
        username: body.username || 'unknown',
        display_name: body.username || 'Unknown',
        avatar: null,
        status: 'offline',
      },
    };
    MOCK_RELATIONSHIPS.push(newRel);
    return ok(newRel, 201);
  }

  const relIdMatch = p.match(/^\/users\/@me\/relationships\/([\w-]+)$/);
  if (relIdMatch && method === 'PUT') {
    const relId = relIdMatch[1];
    const rel = MOCK_RELATIONSHIPS.find(r => r.id === relId);
    if (!rel) return notFound();
    rel.type = 1;
    return ok(rel);
  }
  if (relIdMatch && method === 'DELETE') {
    const relId = relIdMatch[1];
    const idx = MOCK_RELATIONSHIPS.findIndex(r => r.id === relId);
    if (idx !== -1) MOCK_RELATIONSHIPS.splice(idx, 1);
    return noContent();
  }

  // ── Servers ──────────────────────────────────────────────────
  if (p === '/servers' && method === 'GET') return ok(MOCK_SERVERS);

  if (p === '/servers' && method === 'POST') {
    const srv = {
      id: 'srv-new-' + Date.now(),
      name: body.name || 'New Server',
      icon: null,
      owner_id: 'usr-001',
      region: body.region || 'sa-east',
      created_at: new Date().toISOString(),
    };
    MOCK_SERVERS.push(srv);
    MOCK_CHANNELS[srv.id] = [
      {
        id: 'ch-new-' + Date.now(),
        name: 'general',
        channel_type: 'text',
        parent_id: null,
        server_id: srv.id,
        topic: '',
      },
    ];
    MOCK_MEMBERS[srv.id] = [
      {
        user_id: 'usr-001',
        username: 'você',
        display_name: 'Você',
        nickname: null,
        status: 'online',
        avatar: null,
        roles: [],
      },
    ];
    MOCK_ROLES[srv.id] = [
      { id: 'role-new-' + Date.now(), name: 'Member', color: '#43A047', position: 1, permissions: 'basic' },
    ];
    return ok({ server: srv }, 201);
  }

  // ── Invites ──────────────────────────────────────────────────
  const inviteCreateMatch = p.match(/^\/channels\/([\w-]+)\/invites$/);
  if (inviteCreateMatch && method === 'POST') {
    const code = 'ABC' + crypto.randomBytes(4).toString('hex').toUpperCase();
    return ok(
      {
        code,
        channel_id: inviteCreateMatch[1],
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        max_uses: body.max_uses || 0,
        uses: 0,
      },
      201
    );
  }

  // ── Server by ID ─────────────────────────────────────────────
  const srvMatch = p.match(/^\/servers\/([\w-]+)$/);
  if (srvMatch && method === 'GET') {
    const id = srvMatch[1];
    const srv = MOCK_SERVERS.find(s => s.id === id);
    if (!srv) return notFound();
    return ok({ ...srv, channels: MOCK_CHANNELS[id] || [], members: MOCK_MEMBERS[id] || [] });
  }

  if (srvMatch && method === 'DELETE') {
    const id = srvMatch[1];
    const idx = MOCK_SERVERS.findIndex(s => s.id === id);
    if (idx === -1) return notFound();
    MOCK_SERVERS.splice(idx, 1);
    delete MOCK_CHANNELS[id];
    delete MOCK_MEMBERS[id];
    delete MOCK_ROLES[id];
    return noContent();
  }

  // ── Server Roles ─────────────────────────────────────────────
  const rolesMatch = p.match(/^\/servers\/([\w-]+)\/roles$/);
  if (rolesMatch && method === 'GET') {
    const id = rolesMatch[1];
    return ok(MOCK_ROLES[id] || []);
  }

  // ── Server Channels (create) ─────────────────────────────────
  const srvChannelsMatch = p.match(/^\/servers\/([\w-]+)\/channels$/);
  if (srvChannelsMatch && method === 'POST') {
    const serverId = srvChannelsMatch[1];
    if (!MOCK_CHANNELS[serverId]) MOCK_CHANNELS[serverId] = [];
    const ch = {
      id: 'ch-' + Date.now(),
      name: body.name || 'new-channel',
      channel_type: body.channel_type || 'text',
      parent_id: body.parent_id || null,
      server_id: serverId,
      topic: body.topic || '',
    };
    MOCK_CHANNELS[serverId].push(ch);
    return ok(ch, 201);
  }

  // ── Channel operations ───────────────────────────────────────
  const channelMatch = p.match(/^\/channels\/([\w-]+)$/);

  if (channelMatch && method === 'PATCH') {
    const chId = channelMatch[1];
    for (const srvId of Object.keys(MOCK_CHANNELS)) {
      const ch = MOCK_CHANNELS[srvId].find(c => c.id === chId);
      if (ch) {
        Object.assign(ch, body);
        return ok(ch);
      }
    }
    return notFound();
  }

  if (channelMatch && method === 'DELETE') {
    const chId = channelMatch[1];
    for (const srvId of Object.keys(MOCK_CHANNELS)) {
      const idx = MOCK_CHANNELS[srvId].findIndex(c => c.id === chId);
      if (idx !== -1) {
        MOCK_CHANNELS[srvId].splice(idx, 1);
        delete MOCK_MESSAGES[chId];
        return noContent();
      }
    }
    return notFound();
  }

  // ── Pinned Messages ──────────────────────────────────────────
  const pinsMatch = p.match(/^\/channels\/([\w-]+)\/pins$/);
  if (pinsMatch && method === 'GET') {
    const chId = pinsMatch[1];
    return ok(MOCK_PINNED[chId] || []);
  }

  const pinMsgMatch = p.match(/^\/channels\/([\w-]+)\/pins\/([\w-]+)$/);
  if (pinMsgMatch && (method === 'POST' || method === 'PUT')) {
    const [, chId, msgId] = pinMsgMatch;
    if (!MOCK_PINNED[chId]) MOCK_PINNED[chId] = [];
    const msgs = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId] || [];
    const found = msgs.find(m => m.id === msgId);
    if (found && !MOCK_PINNED[chId].find(m => m.id === msgId)) {
      MOCK_PINNED[chId].push({ ...found, pinned: true });
    }
    return noContent();
  }

  if (pinMsgMatch && method === 'DELETE') {
    const [, chId, msgId] = pinMsgMatch;
    if (MOCK_PINNED[chId]) {
      const idx = MOCK_PINNED[chId].findIndex(m => m.id === msgId);
      if (idx !== -1) MOCK_PINNED[chId].splice(idx, 1);
    }
    return noContent();
  }

  // ── Messages (list + create) ─────────────────────────────────
  const msgMatch = p.match(/^\/channels\/([\w-]+)\/messages$/);
  if (msgMatch && method === 'GET') {
    const chId = msgMatch[1];
    const msgs = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId] || [];
    return ok(msgs);
  }

  if (msgMatch && method === 'POST') {
    const chId = msgMatch[1];
    if (body.content == null && (!Array.isArray(body.attachments) || body.attachments.length === 0))
      return bad('Envie texto e/ou anexos.');
    const attachments = Array.isArray(body.attachments)
      ? body.attachments.map((a) => ({
          url: a.url || (a.data && a.data.startsWith('data:') ? a.data : null),
          filename: a.filename || 'file',
          mime_type: a.mime_type || null,
        })).filter((a) => a.url)
      : [];
    const msg = {
      id: 'msg-' + Date.now(),
      channel_id: chId,
      author: { id: MOCK_USER.id, username: MOCK_USER.username },
      content: body.content != null ? String(body.content) : '',
      created_at: new Date().toISOString(),
      reactions: {},
      attachments: attachments.length ? attachments : undefined,
    };
    const store = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId];
    if (store) {
      store.push(msg);
    } else {
      MOCK_MESSAGES[chId] = [msg];
    }
    return ok(msg, 201);
  }

  // ── Edit Message ─────────────────────────────────────────────
  const editMsgMatch = p.match(/^\/channels\/([\w-]+)\/messages\/([\w-]+)$/);
  if (editMsgMatch && method === 'PATCH') {
    const [, chId, msgId] = editMsgMatch;
    const store = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId] || [];
    const msg = store.find(m => m.id === msgId);
    if (!msg) return notFound();
    msg.content = body.content ?? msg.content;
    msg.edited_at = new Date().toISOString();
    return ok(msg);
  }

  // ── Delete Message ───────────────────────────────────────────
  if (editMsgMatch && method === 'DELETE') {
    const [, chId, msgId] = editMsgMatch;
    const store = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId];
    if (store) {
      const idx = store.findIndex(m => m.id === msgId);
      if (idx !== -1) store.splice(idx, 1);
    }
    return noContent();
  }

  // ── Reactions ────────────────────────────────────────────────
  const reactionMatch = p.match(/^\/channels\/([\w-]+)\/messages\/([\w-]+)\/reactions\/([^/]+)(?:\/@me)?$/);
  if (reactionMatch && (method === 'POST' || method === 'PUT')) {
    const [, chId, msgId, emoji] = reactionMatch;
    const decodedEmoji = decodeURIComponent(emoji);
    const store = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId] || [];
    const msg = store.find(m => m.id === msgId);
    if (!msg) return notFound();
    if (!msg.reactions) msg.reactions = {};
    if (!msg.reactions[decodedEmoji]) msg.reactions[decodedEmoji] = [];
    if (!msg.reactions[decodedEmoji].includes(MOCK_USER.id)) {
      msg.reactions[decodedEmoji].push(MOCK_USER.id);
    }
    return ok(msg);
  }

  if (reactionMatch && method === 'DELETE') {
    const [, chId, msgId, emoji] = reactionMatch;
    const decodedEmoji = decodeURIComponent(emoji);
    const store = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId] || [];
    const msg = store.find(m => m.id === msgId);
    if (!msg) return notFound();
    if (msg.reactions && msg.reactions[decodedEmoji]) {
      msg.reactions[decodedEmoji] = msg.reactions[decodedEmoji].filter(u => u !== MOCK_USER.id);
      if (msg.reactions[decodedEmoji].length === 0) delete msg.reactions[decodedEmoji];
    }
    return noContent();
  }

  if (reactionMatch && method === 'GET') {
    const [, chId, msgId, emoji] = reactionMatch;
    const decodedEmoji = decodeURIComponent(emoji);
    const store = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId] || [];
    const msg = store.find(m => m.id === msgId);
    if (!msg) return ok([]);
    return ok(msg.reactions?.[decodedEmoji]?.map(uid => ({ id: uid })) || []);
  }

  // ── Bans ────────────────────────────────────────────────────
  const bansMatch = p.match(/^\/servers\/([\w-]+)\/bans$/);
  if (bansMatch && method === 'GET') return ok([]);

  const banUserMatch = p.match(/^\/servers\/([\w-]+)\/bans\/([\w-]+)$/);
  if (banUserMatch && method === 'PUT') {
    return ok({ user_id: banUserMatch[2], reason: body.reason || '', server_id: banUserMatch[1] }, 201);
  }
  if (banUserMatch && method === 'DELETE') return noContent();

  // ── Fallback ─────────────────────────────────────────────────
  ok({});
}

// ── WebSocket Mock ────────────────────────────────────────────────

let wss;
try {
  wss = new WebSocketServer({ server });

  wss.on('connection', ws => {
    console.log('[WS] Client connected');
    let userId = null;

    ws.send(
      JSON.stringify({
        op: 'hello',
        d: { heartbeat_interval: 45000, server_version: '1.0.0-mock' },
      })
    );

    ws.on('message', raw => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      // ── Authenticate ──────────────────────────────────────────
      if (msg.op === 'authenticate') {
        userId = 'usr-001';
        ws.send(
          JSON.stringify({
            op: 'authenticated',
            d: {
              user: MOCK_USER,
              servers: MOCK_SERVERS,
              session_id: crypto.randomUUID(),
            },
          })
        );
        console.log('[WS] User authenticated');

        setTimeout(() => {
          ['usr-002', 'usr-003', 'usr-007'].forEach(uid => {
            ws.send(
              JSON.stringify({
                op: 'presence_update',
                d: { user_id: uid, status: 'online' },
              })
            );
          });
        }, 2000);
      }

      // ── Heartbeat ─────────────────────────────────────────────
      if (msg.op === 'heartbeat') {
        ws.send(
          JSON.stringify({
            op: 'heartbeat_ack',
            d: { seq: (msg.d?.seq || 0) + 1 },
          })
        );
      }

      // ── Send Message ──────────────────────────────────────────
      if (msg.op === 'send_message') {
        const message = {
          id: 'msg-ws-' + Date.now(),
          channel_id: msg.d.channel_id,
          author: { id: MOCK_USER.id, username: MOCK_USER.username },
          content: msg.d.content,
          created_at: new Date().toISOString(),
          reactions: {},
        };

        if (!MOCK_MESSAGES[msg.d.channel_id]) MOCK_MESSAGES[msg.d.channel_id] = [];
        MOCK_MESSAGES[msg.d.channel_id].push(message);

        ws.send(JSON.stringify({ op: 'message_created', d: { message } }));

        simulateReply(ws, msg.d.channel_id);
      }

      // ── Edit Message ──────────────────────────────────────────
      if (msg.op === 'edit_message') {
        const chId = msg.d.channel_id;
        const msgId = msg.d.message_id;
        const store = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId] || [];
        const found = store.find(m => m.id === msgId);
        if (found) {
          found.content = msg.d.content ?? found.content;
          found.edited_at = new Date().toISOString();
          ws.send(JSON.stringify({ op: 'message_updated', d: { message: found } }));
        }
      }

      // ── Delete Message ────────────────────────────────────────
      if (msg.op === 'delete_message') {
        const chId = msg.d.channel_id;
        const msgId = msg.d.message_id;
        const store = MOCK_MESSAGES[chId] || MOCK_DM_MESSAGES[chId];
        if (store) {
          const idx = store.findIndex(m => m.id === msgId);
          if (idx !== -1) store.splice(idx, 1);
        }
        ws.send(
          JSON.stringify({
            op: 'message_deleted',
            d: { channel_id: chId, message_id: msgId },
          })
        );
      }

      // ── Typing ────────────────────────────────────────────────
      if (msg.op === 'start_typing') {
        ws.send(
          JSON.stringify({
            op: 'typing_started',
            d: {
              channel_id: msg.d.channel_id,
              user_id: userId,
              username: MOCK_USER.username,
              timestamp: new Date().toISOString(),
            },
          })
        );
      }

      // ── Update Status ─────────────────────────────────────────
      if (msg.op === 'update_status') {
        MOCK_USER.status = msg.d.status || MOCK_USER.status;
        ws.send(
          JSON.stringify({
            op: 'presence_update',
            d: { user_id: MOCK_USER.id, status: MOCK_USER.status },
          })
        );
      }
    });

    ws.on('close', () => console.log('[WS] Client disconnected'));
  });

  console.log('[WS] WebSocket server ready');
} catch (e) {
  console.log('[WS] ws package not available, WebSocket disabled. Run: npm install ws');
}

// ── Simulated typing + reply ──────────────────────────────────────

function simulateReply(ws, channelId) {
  if (Math.random() > 0.6) return;

  const user = SIMULATED_USERS[Math.floor(Math.random() * SIMULATED_USERS.length)];
  const reply = SIMULATED_REPLIES[Math.floor(Math.random() * SIMULATED_REPLIES.length)];

  setTimeout(() => {
    if (ws.readyState !== 1) return;
    ws.send(
      JSON.stringify({
        op: 'typing_started',
        d: { channel_id: channelId, user_id: user.id, username: user.username, timestamp: new Date().toISOString() },
      })
    );
  }, 1000);

  setTimeout(() => {
    if (ws.readyState !== 1) return;
    const message = {
      id: 'msg-sim-' + Date.now(),
      channel_id: channelId,
      author: user,
      content: reply,
      created_at: new Date().toISOString(),
      reactions: {},
    };

    if (!MOCK_MESSAGES[channelId]) MOCK_MESSAGES[channelId] = [];
    MOCK_MESSAGES[channelId].push(message);

    ws.send(JSON.stringify({ op: 'message_created', d: { message } }));
  }, 4000);
}

// ── Start ─────────────────────────────────────────────────────────

function onListen() {
  console.log('');
  console.log('  ╔══════════════════════════════════════╗');
  console.log('  ║   🟡 LIBERTY Dev Server              ║');
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log('  ╚══════════════════════════════════════╝');
  console.log('');
  console.log('  Servindo frontend + API mock');
  console.log('  Rotas: auth, users, servers, channels, messages,');
  console.log('         DMs, friends, pins, roles, reactions, invites');
  console.log('  WebSocket: authenticate, heartbeat, send/edit/delete,');
  console.log('             typing, status, simulated replies');
  console.log('');
  console.log('  Pressione Ctrl+C para encerrar');
  console.log('');
}

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    const next = PORT + 1;
    if (next > PORT + 10) {
      console.error(
        'Nenhuma porta livre entre ' +
          PORT_DEFAULT +
          ' e ' +
          next +
          '. Encerre o processo que usa a porta ou defina PORT=outra.'
      );
      process.exit(1);
    }
    console.log('Porta ' + PORT + ' em uso, a tentar ' + next + '...');
    PORT = next;
    server.listen(PORT, onListen);
  } else {
    console.error(err);
    process.exit(1);
  }
});

server.listen(PORT, onListen);
