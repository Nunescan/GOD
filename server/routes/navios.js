const express = require('express');
const fs = require('fs');
const path = require('path');
const aisTracker = require('../services/aisTracker');

const router = express.Router();
const NAVIOS_FILE = path.resolve(__dirname, '../../config/navios.json');

router.get('/', (req, res) => {
  res.json({ navios: aisTracker.getShipsWithPositions() });
});

router.post('/lista', (req, res) => {
  const { navios } = req.body || {};
  if (!Array.isArray(navios)) return res.status(400).json({ ok: false, error: 'Envie a lista de navios' });

  const limpa = navios
    .map((n) => ({ nome: String(n.nome || '').trim(), spe: String(n.spe || '').trim() }))
    .filter((n) => n.nome);

  fs.mkdirSync(path.dirname(NAVIOS_FILE), { recursive: true });
  fs.writeFileSync(NAVIOS_FILE, JSON.stringify(limpa, null, 2));
  aisTracker.refreshWatchlist();
  res.json({ ok: true, navios: aisTracker.getShipsWithPositions() });
});

module.exports = router;
