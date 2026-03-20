const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const chalk = require('chalk');
const crypto = require('crypto');
const { PassThrough } = require('stream');
require('dotenv').config();

const PORT = process.env.VOICE_PORT || 4100;
const AUDIO_TOKEN = process.env.AUDIO_TOKEN || '';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '';

const app = express();
const server = http.createServer(app);

function log(label, msg) {
  console.log(
    chalk.bgBlack.yellow.bold(' ' + label + ' ') +
      ' ' +
      String(msg || '')
  );
}

function verifyToken(req) {
  if (!AUDIO_TOKEN) return true;
  const h = req.headers || {};
  const url = req.url || '';
  const fromHeader = h['x-audio-token'] || h['x-audio-token'.toLowerCase()] || '';
  if (fromHeader && fromHeader === AUDIO_TOKEN) return true;
  const idx = url.indexOf('?');
  if (idx === -1) return false;
  const qs = url.slice(idx + 1).split('&');
  for (let i = 0; i < qs.length; i++) {
    const p = qs[i].split('=');
    if (p[0] === 'token' && decodeURIComponent(p[1] || '') === AUDIO_TOKEN) return true;
  }
  return false;
}

const wss = new WebSocket.Server({
  server,
  path: '/voice',
  verifyClient: function (info, done) {
    if (!verifyToken(info.req)) {
      done(false, 401, 'Unauthorized');
      return;
    }
    done(true);
  }
});

function createState(ws) {
  return {
    id: crypto.randomBytes(8).toString('hex'),
    ws: ws,
    callId: null,
    sessionId: null,
    lang: 'pt',
    sttStream: null,
    sttBuffer: new PassThrough(),
    sttClosed: false,
    llmBusy: false,
    ttsStream: null,
    aiSpeaking: false,
    destroyed: false
  };
}

function closeTts(state) {
  if (state.ttsStream && state.ttsStream.destroy) {
    try { state.ttsStream.destroy(); } catch (e) {}
  }
  state.ttsStream = null;
  state.aiSpeaking = false;
}

function sendJson(ws, obj) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (e) {}
}

function startSttStream(state) {
  state.sttStream = new PassThrough();
  state.sttClosed = false;
}

function pushAudioToStt(state, chunk) {
  if (!state.sttStream) startSttStream(state);
  try {
    state.sttStream.write(chunk);
  } catch (e) {}
}

function fakeSttFlush(state, cb) {
  if (!state.sttStream) {
    cb(null, '');
    return;
  }
  let text = '';
  try {
    const buf = state.sttStream.read() || Buffer.alloc(0);
    if (buf.length > 0) text = '[voz ' + buf.length + ' bytes]';
  } catch (e) {
    text = '';
  }
  state.sttStream = null;
  cb(null, text);
}

function fakeLlm(text, cb) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    cb(null, '');
    return;
  }
  const reply = 'Você disse: ' + trimmed;
  cb(null, reply);
}

function fakeTts(text, cb) {
  const s = new PassThrough();
  const buf = Buffer.from('FAKE_AUDIO:' + text, 'utf8');
  s.end(buf);
  cb(null, s);
}

wss.on('connection', function (ws, req) {
  const state = createState(ws);
  const url = req.url || '';
  const idx = url.indexOf('?');
  if (idx !== -1) {
    const qs = url.slice(idx + 1).split('&');
    for (let i = 0; i < qs.length; i++) {
      const p = qs[i].split('=');
      if (p[0] === 'callId') state.callId = decodeURIComponent(p[1] || '') || null;
      if (p[0] === 'sessionId') state.sessionId = decodeURIComponent(p[1] || '') || null;
      if (p[0] === 'lang') state.lang = decodeURIComponent(p[1] || '') || 'pt';
    }
  }
  if (!state.callId) state.callId = 'call_' + state.id;
  log('CALL_STARTED', 'conexão ' + state.id + ' callId=' + state.callId);
  sendJson(ws, { type: 'CALL_READY', callId: state.callId, sessionId: state.sessionId });

  ws.on('message', function (data, isBinary) {
    if (state.destroyed) return;
    if (isBinary) {
      if (state.aiSpeaking) {
        closeTts(state);
        sendJson(ws, { type: 'INTERRUPT', callId: state.callId });
        log('USER_SPEAKING', 'barge-in ' + state.id);
      } else {
        log('USER_SPEAKING', 'chunk de áudio ' + state.id + ' (' + data.length + ' bytes)');
      }
      pushAudioToStt(state, data);
      fakeSttFlush(state, function (errSTT, text) {
        if (state.destroyed) return;
        if (errSTT || !text) return;
        sendJson(ws, { type: 'STT_TEXT', text: text, callId: state.callId });
        if (state.llmBusy) return;
        state.llmBusy = true;
        fakeLlm(text, function (errLLM, answer) {
          state.llmBusy = false;
          if (state.destroyed) return;
          if (errLLM || !answer) return;
          log('AI_RESPONDING', 'respondendo para ' + state.id);
          sendJson(ws, { type: 'LLM_TEXT', text: answer, callId: state.callId });
          fakeTts(answer, function (errTTS, audioStream) {
            if (state.destroyed) return;
            if (errTTS || !audioStream) return;
            closeTts(state);
            state.ttsStream = audioStream;
            state.aiSpeaking = true;
            sendJson(ws, { type: 'AI_AUDIO_START', callId: state.callId });
            audioStream.on('data', function (chunk) {
              if (state.destroyed || !state.aiSpeaking) return;
              try {
                ws.send(chunk, { binary: true });
              } catch (e) {}
            });
            audioStream.on('end', function () {
              if (state.destroyed) return;
              state.aiSpeaking = false;
              state.ttsStream = null;
              sendJson(ws, { type: 'AI_AUDIO_END', callId: state.callId });
            });
            audioStream.on('error', function () {
              state.aiSpeaking = false;
              state.ttsStream = null;
            });
          });
        });
      });
      return;
    }
    let msg = null;
    try {
      msg = JSON.parse(data.toString('utf8'));
    } catch (e) {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'PING') {
      sendJson(ws, { type: 'PONG', t: Date.now() });
      return;
    }
    if (msg.type === 'STOP_AI') {
      closeTts(state);
      sendJson(ws, { type: 'AI_AUDIO_END', callId: state.callId });
      return;
    }
  });

  ws.on('close', function () {
    state.destroyed = true;
    closeTts(state);
    if (state.sttStream && state.sttStream.destroy) {
      try { state.sttStream.destroy(); } catch (e) {}
    }
    log('CALL_ENDED', 'conexão ' + state.id + ' encerrada');
  });

  ws.on('error', function () {});
});

app.get('/health', function (req, res) {
  res.json({ ok: true });
});

server.listen(PORT, function () {
  log('VOICE_SERVER', 'escutando em ws://localhost:' + PORT + '/voice');
});

process.on('SIGINT', function () {
  log('VOICE_SERVER', 'SIGINT recebido, encerrando');
  try { wss.close(); } catch (e) {}
  try {
    server.close(function () {
      process.exit(0);
    });
  } catch (e) {
    process.exit(0);
  }
});

process.on('SIGTERM', function () {
  log('VOICE_SERVER', 'SIGTERM recebido, encerrando');
  try { wss.close(); } catch (e) {}
  try {
    server.close(function () {
      process.exit(0);
    });
  } catch (e) {
    process.exit(0);
  }
});

