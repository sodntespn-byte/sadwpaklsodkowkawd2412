const db = require('../../lib/db');

function getId(req) {
  let id = (req.query && req.query.id) || '';
  if (!id && req.url) {
    const path = req.url.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 5) id = decodeURIComponent(parts[4]);
  }
  return id;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const id = getId(req);
  if (!id) return res.status(400).json({ error: 'id obrigatório' });
  try {
    const body = req.body || {};
    const acceptedByUserId = body.acceptedByUserId;
    const acceptedByUsername = (body.acceptedByUsername || '').trim();
    if (!acceptedByUserId || !acceptedByUsername) {
      return res.status(400).json({ error: 'acceptedByUserId e acceptedByUsername obrigatórios' });
    }
    const req_ = await db.acceptFriendRequest(id, acceptedByUserId, acceptedByUsername);
    if (!req_) return res.status(404).json({ error: 'Convite não encontrado ou já aceito' });
    return res.json({ ok: true, request: req_ });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao aceitar convite' });
  }
};
