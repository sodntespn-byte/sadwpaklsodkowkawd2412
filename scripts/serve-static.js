/**
 * Servidor estático local — testar o site (HTML/CSS/JS) antes de fazer push.
 * Usa apenas Node.js built-in; não precisa de npm install.
 *
 * Uso: npm run test:local
 *      ou: node scripts/serve-static.js
 *      ou: node scripts/serve-static.js 5000
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const STATIC_DIR = path.join(ROOT, 'static');
const PORT = Number(process.argv[2]) || Number(process.env.PORT) || 8080;

const MIMES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let p = req.url === '/' ? '/index.html' : req.url;
  p = path.join(STATIC_DIR, path.normalize(p.replace(/^\//, '')).replace(/^(\.\.(\/|\\|$))+/, ''));
  const ext = path.extname(p);
  const mime = MIMES[ext] || 'application/octet-stream';

  fs.readFile(p, (err, data) => {
    if (err) {
      const notFound = path.join(STATIC_DIR, '404.html');
      fs.readFile(notFound, (e2, data404) => {
        res.writeHead(e2 ? 404 : 200, { 'Content-Type': 'text/html' });
        res.end(e2 ? 'Not found' : data404);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  LIBERTY — servidor estático local');
  console.log('  ---------------------------------');
  console.log(`  URL:  http://localhost:${PORT}`);
  console.log('  (Apenas UI; login/API não funcionam sem o servidor principal.)');
  console.log('');
});
