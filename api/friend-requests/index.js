const db = require('../lib/db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = req.body || {};
    const fromUserId = body.fromUserId;
    const fromUsername = (body.fromUsername || '').trim();
    const toUsername = (body.toUsername || '').trim();
    if (!fromUserId || !fromUsername || !toUsername) {
      return res.status(400).json({ error: 'fromUserId, fromUsername e toUsername obrigatórios' });
    }
    const req_ = await db.addFriendRequest(fromUserId, fromUsername, toUsername);
    if (!req_) return res.status(409).json({ error: 'Convite já enviado para este usuário' });
    return res.status(201).json({ ok: true, request: req_ });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao enviar convite' });
  }
};
