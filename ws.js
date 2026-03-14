/**
 * Liberty — WebSocket (tempo real) — ESM
 * Path: /ws. Mensagens: { type: 'subscribe', chat_id } / { type: 'unsubscribe', chat_id }
 */

import WebSocket, { WebSocketServer } from 'ws';
import * as auth from './auth.js';
const subscriptions = new Map();
const userConnections = new Map();

function addUserConnection(userId, ws) {
  if (!userId) return;
  let set = userConnections.get(userId);
  if (!set) {
    set = new Set();
    userConnections.set(userId, set);
  }
  set.add(ws);
}

function removeUserConnection(userId, ws) {
  const set = userConnections.get(userId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) userConnections.delete(userId);
  }
}

function subscribe(chatId, ws) {
  if (!chatId) return;
  let set = subscriptions.get(chatId);
  if (!set) {
    set = new Set();
    subscriptions.set(chatId, set);
  }
  set.add(ws);
}

function unsubscribe(chatId, ws) {
  const set = subscriptions.get(chatId);
  if (set) {
    set.delete(ws);
    if (set.size === 0) subscriptions.delete(chatId);
  }
}

function unsubscribeAll(ws) {
  subscriptions.forEach((set) => set.delete(ws));
}

function sendToUser(userId, payload) {
  const set = userConnections.get(userId);
  if (!set) return;
  const str = typeof payload === 'string' ? payload : JSON.stringify(payload);
  set.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(str);
  });
}

export function emitMessage(message) {
  const chatId = message && message.chat_id;
  if (!chatId) return;
  const set = subscriptions.get(chatId);
  if (!set) return;
  const payload = JSON.stringify({ type: 'message', data: message });
  set.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

export function attach(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token') || (req.headers['sec-websocket-protocol'] && req.headers['sec-websocket-protocol'].split(',').map(s => s.trim())[0]);
    const payload = token ? auth.verify(token) : null;
    const userId = payload ? payload.sub : null;

    ws.userId = userId;
    ws.subscribedChats = new Set();
    addUserConnection(userId, ws);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'subscribe' && msg.chat_id) {
          ws.subscribedChats.add(msg.chat_id);
          subscribe(msg.chat_id, ws);
        } else if (msg.type === 'unsubscribe' && msg.chat_id) {
          ws.subscribedChats.delete(msg.chat_id);
          unsubscribe(msg.chat_id, ws);
        } else if (msg.type === 'webrtc_offer' || msg.type === 'webrtc_answer' || msg.type === 'webrtc_ice') {
          const target = msg.target_user_id || msg.to;
          if (target && msg.payload !== undefined) {
            sendToUser(target, { type: msg.type, from_user_id: userId, payload: msg.payload });
          }
        } else if (msg.type === 'stream_started') {
          const target = msg.target_user_id || msg.to;
          if (target) {
            sendToUser(target, { type: 'stream_started', from_user_id: userId, stream_type: msg.stream_type || 'screen' });
          }
        } else if (msg.type === 'stream_stopped') {
          const target = msg.target_user_id || msg.to;
          if (target) {
            sendToUser(target, { type: 'stream_stopped', from_user_id: userId });
          }
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      removeUserConnection(userId, ws);
      if (ws.subscribedChats) ws.subscribedChats.forEach((chatId) => unsubscribe(chatId, ws));
      unsubscribeAll(ws);
    });
  });

  return wss;
}
