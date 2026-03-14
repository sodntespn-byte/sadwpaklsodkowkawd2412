const db = require('../../lib/db');

function getUsername(req) {
  let username = (req.query && req.query.username) || '';
  if (!username && req.url) {
    const path = req.url.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 5) username = decodeURIComponent(parts[4]);
  }
  return username;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const username = getUsername(req);
  try {
    const list = await db.getFriendRequestsReceived(username);
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao buscar convites' });
  }
};
