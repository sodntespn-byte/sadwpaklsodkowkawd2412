/**
 * Netlify Function: roteia /api/* para os handlers em api/
 * Redirect na Netlify: /api/* -> /.netlify/functions/api?path=:splat
 */

function buildReq(event) {
  const q = event.queryStringParameters || {};
  const apiPath = '/' + (q.path || '').replace(/^\/+/, '');
  const fullPath = apiPath.startsWith('/api') ? apiPath : '/api' + (apiPath ? '/' + apiPath : '');
  const query = { ...q };
  delete query.path;
  const queryStr = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : '';
  let body = {};
  if (event.body) {
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch (_) {}
  }
  return {
    method: event.httpMethod,
    url: fullPath + queryStr,
    query: query,
    body: body
  };
}

function buildRes() {
  const headers = {};
  let statusCode = 200;
  let bodyStr = '';
  return {
    setHeader(k, v) {
      headers[k] = v;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(obj) {
      bodyStr = JSON.stringify(obj);
      return this;
    },
    end() {},
    getResult() {
      return { statusCode, headers, body: bodyStr };
    }
  };
}

function route(req) {
  const p = req.url.split('?')[0];
  if (p === '/api/health') return require('../../api/health');
  if (p === '/api/account/delete') return require('../../api/account/delete');
  if (p === '/api/friend-requests' && req.method === 'POST') return require('../../api/friend-requests/index');
  const frAccept = p.match(/^\/api\/friend-requests\/([^/]+)\/accept$/);
  if (frAccept) return require('../../api/friend-requests/[id]/accept');
  const frReceived = p.match(/^\/api\/friend-requests\/received\/(.+)$/);
  if (frReceived) return require('../../api/friend-requests/received/[username]');
  const friends = p.match(/^\/api\/friends\/([^/]+)$/);
  if (friends) return require('../../api/friends/[userId]');
  const channelMsg = p.match(/^\/api\/servers\/([^/]+)\/channels\/([^/]+)\/messages$/);
  if (channelMsg) return require('../../api/servers/[serverId]/channels/[channelId]/messages');
  const dmMsg = p.match(/^\/api\/dm\/([^/]+)\/messages$/);
  if (dmMsg) return require('../../api/dm/[conversationId]/messages');
  return null;
}

exports.handler = async function (event, context) {
  const req = buildReq(event);
  const res = buildRes();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204);
    return res.getResult();
  }

  const handlerModule = route(req);
  if (!handlerModule) {
    res.status(404).json({ error: 'Not found' });
    return res.getResult();
  }

  try {
    const handler = typeof handlerModule === 'function' ? handlerModule : handlerModule.handler;
    await handler(req, res);
  } catch (e) {
    console.error('API error:', e);
    res.status(500).json({ error: 'Erro interno' });
  }
  return res.getResult();
};
