require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { loginAndExport } = require('../automation/ravexClient');
const { rebuildCache, readCache } = require('./services/pipeline');
const { estimateRemaining } = require('./services/route');
const { requireAuth } = require('./middleware/auth');
const launcherRoutes = require('./routes/launcher');
const authRoutes = require('./routes/auth');
const settingsRoutes = require('./routes/settings');
const cteRoutes = require('./routes/cte');

const app = express();
const PORT = parseInt(process.env.PORT || '4173', 10);
const AUTO_REFRESH_MINUTES = parseInt(process.env.AUTO_REFRESH_MINUTES || '10', 10);

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(requireAuth);
app.use(express.static(path.resolve(__dirname, '../public')));

// ---------- estado da automacao (em memoria) ----------
const automationState = {
  running: false,
  log: [],
  lastResult: null,
};

function pushLog(message) {
  automationState.log.push({ time: new Date().toISOString(), message });
  if (automationState.log.length > 200) automationState.log.shift();
}

async function runAutomationAndRefresh(opts = {}) {
  if (automationState.running) return { ok: false, error: 'Automacao ja esta em andamento' };
  automationState.running = true;
  automationState.log = [];
  try {
    pushLog(opts.visible ? 'Iniciando automacao (modo visivel)...' : 'Iniciando automacao (login + exportacao)...');
    const result = await loginAndExport((msg) => pushLog(msg), { headless: !opts.visible });
    automationState.lastResult = result;
    if (result.ok) {
      pushLog('Processando planilha e atualizando mapa...');
      await rebuildCache();
      pushLog('Concluido.');
    }
    return result;
  } catch (err) {
    pushLog(`Erro inesperado: ${err.message}`);
    automationState.lastResult = { ok: false, error: err.message };
    return automationState.lastResult;
  } finally {
    automationState.running = false;
  }
}

// ---------- rotas ----------
app.post('/api/automation/run', (req, res) => {
  if (automationState.running) {
    return res.status(409).json({ ok: false, error: 'Automacao ja esta em andamento' });
  }
  const visible = Boolean((req.body || {}).visible);
  runAutomationAndRefresh({ visible }); // roda em segundo plano; o front acompanha via /status
  res.json({ ok: true, started: true });
});

app.get('/api/automation/status', (req, res) => {
  res.json(automationState);
});

app.get('/api/data', (req, res) => {
  const cache = readCache();
  res.json(cache || { updatedAt: null, total: 0, rows: [] });
});

app.get('/api/data/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const cache = readCache();
  if (!cache) return res.json({ updatedAt: null, total: 0, rows: [] });
  if (!q) return res.json(cache);

  const rows = cache.rows.filter((r) =>
    [r.programacao, r.origem, r.destino, r.posicaoAtual, r.placa, r.motorista, r.status]
      .some((field) => String(field || '').toLowerCase().includes(q))
  );
  res.json({ updatedAt: cache.updatedAt, total: rows.length, rows });
});

app.get('/api/map', (req, res) => {
  const cache = readCache();
  if (!cache) return res.json({ updatedAt: null, total: 0, points: [] });

  const points = cache.rows
    .filter((r) => r.posicaoAtualGeo)
    .map((r) => ({
      programacao: r.programacao,
      placa: r.placa,
      motorista: r.motorista,
      status: r.status,
      origem: r.origem,
      destino: r.destino,
      posicaoAtual: r.posicaoAtual,
      lat: r.posicaoAtualGeo.lat,
      lng: r.posicaoAtualGeo.lng,
      origemGeo: r.origemGeo,
      destinoGeo: r.destinoGeo,
      previsaoChegada: r.previsaoChegada,
    }));

  res.json({ updatedAt: cache.updatedAt, total: points.length, points });
});

// Detalhe de uma carga especifica: origem, destino e quanto falta pra chegar
// (usado quando o usuario busca por uma Programacao de Transporte).
app.get('/api/route', async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) return res.status(400).json({ ok: false, error: 'informe ?q=<programacao>' });

  const cache = readCache();
  if (!cache) return res.status(404).json({ ok: false, error: 'Nenhuma planilha carregada ainda' });

  const row = cache.rows.find((r) => r.programacao.toLowerCase() === q)
    || cache.rows.find((r) => r.programacao.toLowerCase().includes(q));

  if (!row) return res.status(404).json({ ok: false, error: 'Programacao nao encontrada' });

  const remaining = await estimateRemaining(row.posicaoAtualGeo, row.destinoGeo);
  res.json({ ok: true, row, remaining });
});

app.post('/api/data/reprocess', async (req, res) => {
  try {
    const cache = await rebuildCache();
    res.json({ ok: true, updatedAt: cache.updatedAt, total: cache.total });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use('/api/launcher', launcherRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/cte', cteRoutes);

// binda so em localhost: este servidor guarda dados internos da empresa e
// nao deve ficar acessivel por outros dispositivos na mesma rede
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);

  if (AUTO_REFRESH_MINUTES > 0) {
    setInterval(() => {
      console.log(`[scheduler] Atualizando automaticamente a cada ${AUTO_REFRESH_MINUTES} min...`);
      runAutomationAndRefresh().catch((err) => console.error('[scheduler] erro:', err.message));
    }, AUTO_REFRESH_MINUTES * 60 * 1000);
  }
});
