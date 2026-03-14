const db = require('../lib/db');

function getUserId(req) {
  let userId = (req.query && req.query.userId) || '';
  if (!userId && req.url) {
    const path = req.url.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 4) userId = decodeURIComponent(parts[3]);
  }
  return userId;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const userId = getUserId(req);
  if (!userId) return res.status(400).json({ error: 'userId obrigatório' });
  try {
    const list = await db.getFriendsForUser(userId);
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao buscar amigos' });
  }
};
