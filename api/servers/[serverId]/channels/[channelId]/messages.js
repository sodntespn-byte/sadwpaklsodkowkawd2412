const db = require('../../lib/db');

function getParams(req) {
  let { serverId, channelId } = req.query || {};
  if (!serverId || !channelId) {
    const path = (req.url || '').split('?')[0];
    const parts = path.split('/').filter(Boolean);
    if (parts.length >= 7) {
      serverId = decodeURIComponent(parts[3]);
      channelId = decodeURIComponent(parts[5]);
    }
  }
  return { serverId, channelId };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const { serverId, channelId } = getParams(req);
  if (!serverId || !channelId) return res.status(400).json({ error: 'serverId e channelId obrigatórios' });
  try {
    if (req.method === 'GET') {
      const limit = Math.min(parseInt((req.query && req.query.limit) || '500', 10) || 500, 1000);
      const list = await db.getChannelMessages(serverId, channelId, limit);
      return res.json(list);
    }
    if (req.method === 'POST') {
      const body = req.body || {};
      const msg = {
        id: body.id,
        serverId,
        channelId,
        author: body.author,
        avatar: body.avatar,
        text: body.text != null ? body.text : '(arquivo)',
        attachments: Array.isArray(body.attachments) ? body.attachments : []
      };
      if (!msg.id || !msg.author) return res.status(400).json({ error: 'id e author obrigatórios' });
      const row = await db.addChannelMessage(msg);
      return res.status(201).json({ ok: true, time: row.time });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao processar mensagens' });
  }
};
