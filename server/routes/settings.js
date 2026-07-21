const express = require('express');
const fs = require('fs');
const path = require('path');
const settings = require('../services/settings');
const { readCache, rebuildCache } = require('../services/pipeline');

const router = express.Router();

const COLUMN_MAP_FILE = path.resolve(__dirname, '../../config/columnMap.json');
const LOGICAL_FIELDS = [
  'programacao', 'origem', 'destino', 'posicaoAtual', 'status',
  'motorista', 'placa', 'transportadora', 'previsaoChegada', 'dataSaida',
];

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

// Mapeamento de colunas: mostra o que foi detectado automaticamente na
// ultima planilha carregada, pra voce corrigir manualmente se a deteccao
// por palavra-chave acertar a coluna errada (ex: pegar uma coluna de data
// no lugar da "Posição Atual").
router.get('/columns', (req, res) => {
  const cache = readCache();
  let overrides = {};
  if (fs.existsSync(COLUMN_MAP_FILE)) {
    try { overrides = JSON.parse(fs.readFileSync(COLUMN_MAP_FILE, 'utf-8')); } catch { overrides = {}; }
  }
  res.json({
    fields: LOGICAL_FIELDS,
    rawHeaders: cache ? cache.rawHeaders : [],
    detected: cache ? cache.columnMap : {},
    overrides,
  });
});

router.post('/columns', async (req, res) => {
  const overrides = {};
  LOGICAL_FIELDS.forEach((field) => {
    const value = (req.body || {})[field];
    if (value) overrides[field] = value;
  });

  fs.mkdirSync(path.dirname(COLUMN_MAP_FILE), { recursive: true });
  fs.writeFileSync(COLUMN_MAP_FILE, JSON.stringify(overrides, null, 2));

  try {
    const cache = await rebuildCache();
    res.json({ ok: true, updatedAt: cache.updatedAt, columnMap: cache.columnMap });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
