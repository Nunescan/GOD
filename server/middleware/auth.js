const crypto = require('crypto');

const SESSION_COOKIE = 'painel_session';

// sessoes validas ficam so em memoria: reiniciar o servidor derruba todo
// mundo pro login de novo, o que e o comportamento desejado (abrir o painel
// de manha = pedir senha, ja que o servidor sobe do zero nesse momento).
const sessions = new Set();

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const key = pair.slice(0, idx).trim();
    const val = pair.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function createSession() {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.add(token);
  return token;
}

function destroySession(token) {
  sessions.delete(token);
}

function isValidSession(token) {
  return Boolean(token) && sessions.has(token);
}

function isPublicPath(p) {
  return p === '/login.html' || p.startsWith('/css/') || p.startsWith('/js/') || p.startsWith('/api/auth/');
}

function requireAuth(req, res, next) {
  if (isPublicPath(req.path)) return next();

  const cookies = parseCookies(req.headers.cookie);
  if (isValidSession(cookies[SESSION_COOKIE])) return next();

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: 'Nao autenticado' });
  }
  return res.redirect(`/login.html?next=${encodeURIComponent(req.originalUrl)}`);
}

module.exports = { requireAuth, createSession, destroySession, isValidSession, SESSION_COOKIE, parseCookies };
