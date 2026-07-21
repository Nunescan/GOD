const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const router = express.Router();
const CONFIG_FILE = path.resolve(__dirname, '../../config/launcher.json');

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

router.get('/apps', (req, res) => {
  res.json(readConfig());
});

// So abre caminhos que ja estao cadastrados em config/launcher.json (editado por
// voce mesmo localmente) - o corpo da requisicao manda so o "id", nunca um caminho
// livre, pra nao virar uma porta aberta de execucao de comando arbitrario.
router.post('/open', (req, res) => {
  const { id } = req.body || {};
  const item = readConfig().find((a) => a.id === id);
  if (!item) return res.status(404).json({ ok: false, error: 'App nao encontrado em config/launcher.json' });

  exec(`start "" "${item.path}"`, { shell: 'cmd.exe' }, (err) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true });
  });
});

module.exports = router;
