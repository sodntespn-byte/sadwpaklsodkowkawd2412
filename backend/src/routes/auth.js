import bcrypt from 'bcrypt';
import { validateBody, schemas } from '../middleware/validate.js';
import { sanitizeUsername } from '../lib/sanitize.js';
import logger from '../lib/logger.js';

/**
 * Regista rotas de autenticação no router.
 * @param {express.Router} router
 * @param {{ db: object, auth: object, ensureLibertyServer: function, ensureUserInLibertyServer: function }} deps
 */
export function registerAuthRoutes(router, deps) {
  const { db, auth, ensureLibertyServer, ensureUserInLibertyServer } = deps;

  router.post('/register', validateBody(schemas.register), async (req, res) => {
    if (!db.isConfigured()) {
      return res.status(503).json({ message: 'Banco de dados indisponível. Defina DATABASE_URL no ambiente.' });
    }
    const ok = await db.ensureConnected();
    if (!ok) {
      return res.status(503).json({ message: 'Banco de dados indisponível. Tente mais tarde.' });
    }

    const { username, email, password } = req.body;
    const name = sanitizeUsername(username) || '';
    if (!name || name.length < 2) {
      return res.status(400).json({ message: 'username é obrigatório (mín. 2 caracteres)' });
    }

    try {
      await ensureLibertyServer();
      const emailVal = email && String(email).trim() ? String(email).trim().toLowerCase() : null;
      const rawPassword = password && String(password).trim();
      if (rawPassword && rawPassword.length < 8) {
        return res.status(400).json({ message: 'A senha deve ter pelo menos 8 caracteres' });
      }
      const password_hash = rawPassword ? await bcrypt.hash(rawPassword, 12) : null;
      const r = await db.query(
        `INSERT INTO users (username, email, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, username, email, created_at`,
        [name, emailVal, password_hash]
      );
      const row = r.rows[0];
      const user = {
        id: String(row.id),
        username: row.username,
        email: row.email,
        has_password: Boolean(password_hash),
      };
      await ensureUserInLibertyServer(row.id);
      const access_token = auth.sign(user);
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('liberty_token', access_token, {
        path: '/',
        maxAge: 90 * 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        httpOnly: true,
        secure: isProduction,
      });

      return res.status(201).json({
        success: true,
        user,
        access_token,
        refresh_token: access_token,
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ message: 'Nome de usuário (ou email) já em uso' });
      }
      logger.error('register', err);
      return res.status(500).json({ message: err.message || 'Erro ao criar conta' });
    }
  });

  router.post('/refresh', validateBody(schemas.refresh), async (req, res) => {
    const token =
      req.body && (req.body.refresh_token || req.body.token || req.body.access_token)
        ? String(req.body.refresh_token || req.body.token || req.body.access_token).trim()
        : null;
    if (!token) {
      return res.status(401).json({ message: 'Token ausente' });
    }
    const payload = auth.verify(token);
    if (!payload || !payload.sub) {
      return res.status(401).json({ message: 'Token inválido ou expirado' });
    }
    try {
      const r = await db.query(`SELECT id, username, email, password_hash FROM users WHERE id = $1::uuid LIMIT 1`, [
        payload.sub,
      ]);
      const row = r.rows[0];
      if (!row) {
        return res.status(401).json({ message: 'Usuário não encontrado' });
      }
      const user = {
        id: String(row.id),
        username: row.username,
        email: row.email,
        has_password: Boolean(row.password_hash),
      };
      const access_token = auth.sign(user);
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('liberty_token', access_token, {
        path: '/',
        maxAge: 90 * 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        httpOnly: true,
        secure: isProduction,
      });
      return res.status(200).json({
        access_token,
        refresh_token: access_token,
        user,
      });
    } catch (err) {
      logger.error('refresh', err);
      return res.status(500).json({ message: err.message || 'Erro ao renovar sessão' });
    }
  });

  router.post('/login', validateBody(schemas.login), async (req, res) => {
    if (!db.isConfigured()) {
      return res.status(503).json({ message: 'Banco de dados indisponível. Defina DATABASE_URL no ambiente.' });
    }
    const ok = await db.ensureConnected();
    if (!ok) {
      return res.status(503).json({ message: 'Banco de dados indisponível.' });
    }
    const { username, password } = req.body || {};
    const name = sanitizeUsername(username) || '';
    if (!name) {
      return res.status(400).json({ message: 'username é obrigatório' });
    }
    try {
      const r = await db.query(`SELECT id, username, email, password_hash FROM users WHERE username = $1 LIMIT 1`, [
        name,
      ]);
      const row = r.rows[0];
      if (!row) {
        return res.status(401).json({ message: 'Usuário ou senha inválidos' });
      }
      if (row.password_hash) {
        if (!password || !(await bcrypt.compare(String(password), row.password_hash))) {
          return res.status(401).json({ message: 'Usuário ou senha inválidos' });
        }
      }
      await ensureLibertyServer();
      await ensureUserInLibertyServer(row.id);
      const user = {
        id: String(row.id),
        username: row.username,
        email: row.email,
        has_password: Boolean(row.password_hash),
      };
      const access_token = auth.sign(user);
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('liberty_token', access_token, {
        path: '/',
        maxAge: 90 * 24 * 60 * 60 * 1000,
        sameSite: 'strict',
        httpOnly: true,
        secure: isProduction,
      });
      return res.status(200).json({
        success: true,
        user,
        access_token,
        refresh_token: access_token,
      });
    } catch (err) {
      logger.error('login', err);
      return res.status(500).json({ message: err.message || 'Erro ao fazer login' });
    }
  });

  router.post('/logout', (req, res) => {
    try {
      res.clearCookie('liberty_token', { path: '/' });
    } catch (_) {}
    return res.status(200).json({ success: true });
  });
}
