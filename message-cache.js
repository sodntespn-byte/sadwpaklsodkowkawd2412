/**
 * LIBERTY — Cache de mensagens (servidor)
 *
 * Estratégia: cache em memória para acesso rápido; persistência no DB garante
 * que os dados não se percam (refresh, restart ou cache limpo).
 *
 * Fluxo de leitura: 1) Buscar no cache. 2) Se vazio, buscar no DB e repopular o cache.
 * Fluxo de escrita: 1) Inserir no cache. 2) Garantir no DB (ensureMessageInDb, sem duplicar por id).
 *
 * Opcional: definir REDIS_URL para usar Redis em vez de memória (útil para múltiplas instâncias).
 * Para Redis, instale: npm install redis
 */

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
    redisClient.on('error', (err) => console.warn('[message-cache] Redis:', err.message));
    console.log('[LIBERTY] Cache de mensagens usando Redis');
    return redisClient;
  } catch (err) {
    console.warn('[message-cache] Redis indisponível, usando memória:', err.message);
    return null;
  }
}

/** Remove duplicados por id e mantém ordem por created_at */
function dedupeById(messages) {
  if (!Array.isArray(messages)) return [];
  const seen = new Set();
  return messages.filter((m) => {
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
async function getCachedMessages(chatId) {
  const key = PREFIX + (chatId || '');
  const r = await getRedisClient();
  if (r) {
    try {
      const raw = await r.get(key);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }
  return memory.get(chatId) || [];
}

/**
 * Define a lista de mensagens no cache (ex.: repopular a partir do DB).
 * Evita duplicados por id.
 */
async function setCachedMessages(chatId, messages) {
  if (!chatId || !Array.isArray(messages)) return;
  const list = cap(dedupeById(messages), MAX_CACHE_PER_CHANNEL);
  const key = PREFIX + chatId;
  const r = await getRedisClient();
  if (r) {
    try {
      await r.setEx(key, TTL_SEC, JSON.stringify(list));
    } catch (err) {
      console.warn('[message-cache] setCachedMessages Redis:', err.message);
    }
    return;
  }
  memory.set(chatId, list);
}

/**
 * Adiciona uma mensagem ao cache. Se o canal passar do limite, remove as mais antigas.
 */
async function addCachedMessage(chatId, msg) {
  if (!chatId || !msg) return;
  const list = await getCachedMessages(chatId);
  const id = msg.id || msg.message_id;
  const filtered = id ? list.filter((m) => (m.id || m.message_id) !== id) : list;
  const next = cap([...filtered, msg], MAX_CACHE_PER_CHANNEL);
  await setCachedMessages(chatId, next);
}

export default {
  getCachedMessages,
  setCachedMessages,
  addCachedMessage,
  MAX_CACHE_PER_CHANNEL,
};
