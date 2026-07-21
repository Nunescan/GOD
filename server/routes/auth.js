const express = require('express');
const settings = require('../services/settings');
const { createSession, destroySession, SESSION_COOKIE, parseCookies } = require('../middleware/auth');

const router = express.Router();

const COOKIE_OPTS = { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 };

router.get('/status', (req, res) => {
  res.json({ configured: settings.isAppPasswordConfigured() });
});

// so funciona uma vez - a primeira pessoa a abrir o painel define a senha
router.post('/setup', (req, res) => {
  if (settings.isAppPasswordConfigured()) {
    return res.status(409).json({ ok: false, error: 'Já existe uma senha configurada. Altere em Configurações.' });
  }
  const { password } = req.body || {};
  if (!password || password.length < 4) {
    return res.status(400).json({ ok: false, error: 'A senha precisa ter pelo menos 4 caracteres' });
  }
  settings.setAppPassword(password);
  res.cookie(SESSION_COOKIE, createSession(), COOKIE_OPTS);
  res.json({ ok: true });
});

router.post('/login', (req, res) => {
  if (!settings.isAppPasswordConfigured()) {
    return res.status(409).json({ ok: false, error: 'Nenhuma senha configurada ainda' });
  }
  const { password } = req.body || {};
  if (!password || !settings.verifyAppPassword(password)) {
    return res.status(401).json({ ok: false, error: 'Senha incorreta' });
  }
  res.cookie(SESSION_COOKIE, createSession(), COOKIE_OPTS);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  destroySession(cookies[SESSION_COOKIE]);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

module.exports = router;
