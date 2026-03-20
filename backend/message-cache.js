/**
 * LIBERTY — Cache de mensagens (servidor)
 *
 * Estratégia: cache em memória para acesso rápido; persistência no DB garante
 * que os dados não se percam (refresh, restart ou cache limpo).
 * Cache e conteúdo em DB são criptografados com AES-256-GCM quando MESSAGE_ENCRYPTION_KEY está definida.
 *
 * Fluxo de leitura: 1) Buscar no cache (descriptografar). 2) Se vazio, buscar no DB e repopular o cache.
 * Fluxo de escrita: 1) Inserir no cache (criptografar). 2) Garantir no DB (ensureMessageInDb, content criptografado).
 *
 * Opcional: definir REDIS_URL para usar Redis em vez de memória (útil para múltiplas instâncias).
 * Para Redis, instale: npm install redis
 */
import { logger } from './src/lib/logger.js';
import { encrypt, decrypt } from './src/lib/message-crypto.js';

const MAX_CACHE_PER_CHANNEL = 300;
const PREFIX = 'liberty:msg:';
const TTL_SEC = 86400; // 24h

/** Cache em memória: chatId -> array de mensagens */
const memory = new Map();

/** Redis client (lazy init quando REDIS_URL está definida) */
let redisClient = null;

async function getRedisClient() {
  if (typeof process.env.REDIS_URL !== 'string' || !process.env.REDIS_URL.trim()) return null;
  if (redisClient) return redisClient;
  try {
    const redis = await import('redis');
    redisClient = redis.createClient({ url: process.env.REDIS_URL });
    await redisClient.connect();
    redisClient.on('error', err => logger.warn('[message-cache] Redis:', err.message));
    logger.info('[LIBERTY] Cache de mensagens usando Redis');
    return redisClient;
  } catch (err) {
    logger.warn('[message-cache] Redis indisponível, usando memória:', err.message);
    return null;
  }
}

/** Remove duplicados por id e mantém ordem por created_at */
function dedupeById(messages) {
  if (!Array.isArray(messages)) return [];
  const seen = new Set();
  return messages.filter(m => {
    const id = m.id || m.message_id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Limita tamanho do array (mantém as mais recentes) */
function cap(list, max) {
  if (list.length <= max) return list;
  return list.slice(-max);
}

/**
 * Retorna mensagens em cache para o chat.
 * Se usar Redis, retorna Promise; senão retorna Promise resolvida com o array.
 */
function parseCached(raw) {
  if (!raw) return [];
  const decoded = decrypt(raw);
  try {
    const list = typeof decoded === 'string' ? JSON.parse(decoded) : decoded;
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function getCachedMessages(chatId) {
  const key = PREFIX + (chatId || '');
  const r = await getRedisClient();
  if (r) {
    try {
      const raw = await r.get(key);
      return parseCached(raw);
    } catch {
      return [];
    }
  }
  const stored = memory.get(chatId);
  return stored ? parseCached(stored) : [];
}

/**
 * Define a lista de mensagens no cache (ex.: repopular a partir do DB).
 * Evita duplicados por id.
 */
async function setCachedMessages(chatId, messages) {
  if (!chatId || !Array.isArray(messages)) return;
  const list = cap(dedupeById(messages), MAX_CACHE_PER_CHANNEL);
  const payload = encrypt(JSON.stringify(list));
  const key = PREFIX + chatId;
  const r = await getRedisClient();
  if (r) {
    try {
      await r.setEx(key, TTL_SEC, payload);
    } catch (err) {
      logger.warn('[message-cache] setCachedMessages Redis:', err.message);
    }
    return;
  }
  memory.set(chatId, payload);
}

/**
 * Adiciona uma mensagem ao cache. Se o canal passar do limite, remove as mais antigas.
 */
async function addCachedMessage(chatId, msg) {
  if (!chatId || !msg) return;
  const list = await getCachedMessages(chatId);
  const id = msg.id || msg.message_id;
  const filtered = id ? list.filter(m => (m.id || m.message_id) !== id) : list;
  const next = cap([...filtered, msg], MAX_CACHE_PER_CHANNEL);
  await setCachedMessages(chatId, next);
}

/**
 * Retorna todas as listas de mensagens em cache (para ranking XP por conteúdo).
 * Memória: values do Map. Redis: keys com PREFIX e depois GET de cada uma.
 */
async function getAllMessageLists() {
  const r = await getRedisClient();
  if (r) {
    try {
      const keys = await r.keys(PREFIX + '*');
      if (!keys.length) return [];
      const lists = await Promise.all(
        keys.map(k =>
          r
            .get(k)
            .then(raw => parseCached(raw))
            .catch(() => [])
        )
      );
      return lists.filter(arr => Array.isArray(arr) && arr.length > 0);
    } catch {
      return [];
    }
  }
  return Array.from(memory.values()).map(raw => parseCached(raw)).filter(arr => Array.isArray(arr) && arr.length > 0);
}

export default {
  getCachedMessages,
  setCachedMessages,
  addCachedMessage,
  getAllMessageLists,
  MAX_CACHE_PER_CHANNEL,
};
