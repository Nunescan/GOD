const express = require('express');
const path = require('path');
const cteRunner = require('../services/cteRunner');
const speLookup = require('../services/speLookup');
const cabotagemDaily = require('../services/cabotagemDaily');
const activityLog = require('../services/activityLog');
const schedule = require('../services/schedule');
const { pickFile } = require('../services/nativePicker');

const router = express.Router();

// ---------- atividades ----------
router.get('/atividades', (req, res) => {
  res.json(activityLog.list(200));
});

router.get('/schedule', (req, res) => {
  res.json({ autoRefreshMinutes: schedule.getAutoRefreshMinutes() });
});

router.post('/schedule', (req, res) => {
  const { autoRefreshMinutes } = req.body || {};
  const minutos = parseInt(autoRefreshMinutes, 10);
  if (!Number.isFinite(minutos) || minutos < 1) {
    return res.status(400).json({ ok: false, error: 'Informe um número de minutos válido' });
  }
  schedule.setAutoRefreshMinutes(minutos);
  res.json({ ok: true });
});

// ---------- busca de SPE por planilha avulsa ----------
router.post('/spe/pick-file', async (req, res) => {
  try {
    const selected = await pickFile();
    res.json({ ok: true, path: selected });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/spe/preview', async (req, res) => {
  const { path: filePath } = req.body || {};
  if (!filePath) return res.status(400).json({ ok: false, error: 'Escolha um arquivo' });
  const result = await speLookup.previewSpreadsheet(filePath);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.post('/spe/buscar', async (req, res) => {
  const { path: filePath, speColumn, dateColumn, dateFilter } = req.body || {};
  if (!filePath || !speColumn) return res.status(400).json({ ok: false, error: 'Escolha o arquivo e a coluna da SPE' });
  const result = await speLookup.lookupSpes(filePath, speColumn, dateColumn, dateFilter);
  if (!result.ok) return res.status(400).json(result);

  activityLog.add({
    tipo: 'spe-lookup',
    titulo: 'Busca de SPE por planilha',
    detalhe: `${result.total} SPE(s): ${result.encontrados} encontrada(s), ${result.naoEncontrados} não encontrada(s).`,
    ok: true,
  });

  res.json(result);
});

router.post('/spe/exportar', async (req, res) => {
  const { resultados } = req.body || {};
  if (!Array.isArray(resultados)) return res.status(400).json({ ok: false, error: 'Sem resultados pra exportar' });
  try {
    const dataStr = new Date().toISOString().slice(0, 10);
    const outputPath = path.resolve(__dirname, '../../data/downloads', `busca-spe_${dataStr}_${Date.now()}.xlsx`);
    await speLookup.writeResultSpreadsheet(resultados, outputPath);
    res.json({ ok: true, path: outputPath });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- busca de e-mails ----------
router.post('/emails/buscar', (req, res) => {
  const { pasta, palavras, limite } = req.body || {};
  if (!pasta) return res.status(400).json({ ok: false, error: 'Escolha a pasta do Outlook' });
  const result = cteRunner.buscarEmails(pasta, palavras, limite);
  if (!result.ok) return res.status(409).json(result);
  res.json(result);
});

// ---------- verificacao diaria de cabotagem ----------
router.get('/diaria/config', (req, res) => {
  res.json(cabotagemDaily.readConfig() || {});
});

router.post('/diaria/config', (req, res) => {
  const { pasta, assunto, speColumn, dateColumn } = req.body || {};
  if (!pasta || !speColumn) return res.status(400).json({ ok: false, error: 'Pasta e coluna da SPE são obrigatórias' });
  const atual = cabotagemDaily.readConfig() || {};
  cabotagemDaily.writeConfig({ ...atual, pasta, assunto: assunto || '', speColumn, dateColumn: dateColumn || '' });
  res.json({ ok: true });
});

router.get('/diaria/status', (req, res) => {
  res.json(cabotagemDaily.getStatus());
});

router.post('/diaria/rodar', (req, res) => {
  cabotagemDaily.rodar().then((result) => {
    if (!result.ok && !res.headersSent) res.status(409).json(result);
  });
  res.json({ ok: true, started: true });
});

// "testar" = mesmo comando de achar anexo, so pra pre-visualizar as colunas
// antes de configurar a verificacao diaria de verdade
router.post('/diaria/testar-busca', (req, res) => {
  const { pasta, assunto } = req.body || {};
  if (!pasta) return res.status(400).json({ ok: false, error: 'Escolha a pasta do Outlook' });
  const destino = path.resolve(__dirname, '../../data/downloads/cabotagem-teste.xlsx');
  const result = cteRunner.buscarAnexo(pasta, assunto || null, destino);
  if (!result.ok) return res.status(409).json(result);
  res.json({ ok: true, destino });
});

router.post('/diaria/preview-teste', async (req, res) => {
  const destino = path.resolve(__dirname, '../../data/downloads/cabotagem-teste.xlsx');
  const result = await speLookup.previewSpreadsheet(destino);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

router.get('/status', (req, res) => {
  res.json(cteRunner.getStatus());
});

module.exports = router;
