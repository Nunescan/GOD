const express = require('express');
const settings = require('../services/settings');

const router = express.Router();

router.get('/ravex', (req, res) => {
  const { username, password } = settings.getRavexCredentials();
  res.json({ username, hasPassword: Boolean(password) });
});

router.post('/ravex', (req, res) => {
  const { username, password } = req.body || {};
  if (!username) return res.status(400).json({ ok: false, error: 'Informe o usuário/e-mail' });
  settings.setRavexCredentials(username, password);
  res.json({ ok: true });
});

router.post('/app-password', (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ ok: false, error: 'A nova senha precisa ter pelo menos 4 caracteres' });
  }
  if (settings.isAppPasswordConfigured()) {
    if (!currentPassword || !settings.verifyAppPassword(currentPassword)) {
      return res.status(401).json({ ok: false, error: 'Senha atual incorreta' });
    }
  }
  settings.setAppPassword(newPassword);
  res.json({ ok: true });
});

module.exports = router;
