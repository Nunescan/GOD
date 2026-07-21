const express = require('express');
const fs = require('fs');
const path = require('path');
const cteRunner = require('../services/cteRunner');
const { buildCteDashboard } = require('../services/cteDashboard');
const { pickFile, pickFolder } = require('../services/nativePicker');

const router = express.Router();

const VINCULOS_FILE = path.join(cteRunner.CTE_DIR, 'config', 'vinculos.json');

router.get('/status', (req, res) => {
  res.json(cteRunner.getStatus());
});

router.post('/stop', (req, res) => {
  const result = cteRunner.stop();
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

router.post('/processar', (req, res) => {
  const { armador, origem, destino } = req.body || {};
  if (!armador || !origem) return res.status(400).json({ ok: false, error: 'Escolha o armador e a pasta de origem' });
  const result = cteRunner.processar(armador, origem, destino);
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

router.post('/relatorio', (req, res) => {
  const { armador, pasta } = req.body || {};
  if (!armador || !pasta) return res.status(400).json({ ok: false, error: 'Escolha o armador e a pasta processada' });
  const result = cteRunner.relatorio(armador, pasta);
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

router.post('/coletar', (req, res) => {
  const { dias } = req.body || {};
  const result = cteRunner.coletar(dias);
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

router.post('/pastas-outlook', (req, res) => {
  const result = cteRunner.pastasOutlook();
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

// vinculos: qual pasta do Outlook pertence a qual armador
router.get('/vinculos', (req, res) => {
  if (!fs.existsSync(VINCULOS_FILE)) return res.json({});
  try {
    res.json(JSON.parse(fs.readFileSync(VINCULOS_FILE, 'utf-8')));
  } catch {
    res.json({});
  }
});

router.post('/vinculos', (req, res) => {
  const vinculos = req.body || {};
  fs.mkdirSync(path.dirname(VINCULOS_FILE), { recursive: true });
  fs.writeFileSync(VINCULOS_FILE, JSON.stringify(vinculos, null, 2));
  res.json({ ok: true });
});

// seletor nativo do Windows - usado pra escolher pastas de origem/destino e
// o arquivo de relatorio pro dashboard, sem precisar de upload por navegador
router.post('/pick-folder', async (req, res) => {
  try {
    const selected = await pickFolder();
    res.json({ ok: true, path: selected });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/pick-file', async (req, res) => {
  try {
    const selected = await pickFile();
    res.json({ ok: true, path: selected });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/dashboard', async (req, res) => {
  const { path: filePath } = req.body || {};
  if (!filePath) return res.status(400).json({ ok: false, error: 'Escolha um arquivo de relatório' });
  try {
    const result = await buildCteDashboard(filePath);
    if (!result.ok) return res.status(400).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
