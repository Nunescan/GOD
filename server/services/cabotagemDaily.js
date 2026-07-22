const fs = require('fs');
const path = require('path');
const cteRunner = require('./cteRunner');
const speLookup = require('./speLookup');
const activityLog = require('./activityLog');

const DOWNLOADS_DIR = path.resolve(__dirname, '../../data/downloads');
const ANEXO_PATH = path.join(DOWNLOADS_DIR, 'cabotagem-anexo-latest.xlsx');
const CONFIG_FILE = path.resolve(__dirname, '../../config/cabotagemConfig.json');

const state = {
  running: false,
  step: null,
  log: [],
  lastResult: null,
};

function pushLog(message) {
  state.log.push({ time: new Date().toISOString(), message });
  if (state.log.length > 200) state.log.shift();
}

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function writeConfig(cfg) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

// espera o comando atual do cteRunner (buscar-anexo) terminar
function waitForCteRunner() {
  return new Promise((resolve) => {
    const poll = setInterval(() => {
      const s = cteRunner.getStatus();
      if (!s.running) {
        clearInterval(poll);
        resolve(s);
      }
    }, 1000);
  });
}

/**
 * Roda a verificacao diaria completa: busca o anexo mais recente na pasta
 * configurada do Outlook, filtra pela data de hoje, cruza as SPEs com os
 * dados do Ravex, e gera a planilha de resultado.
 */
async function rodar() {
  if (state.running) return { ok: false, error: 'Verificação diária já está em andamento' };
  const cfg = readConfig();
  if (!cfg || !cfg.pasta || !cfg.speColumn) {
    return { ok: false, error: 'Configure a pasta do Outlook e a coluna da SPE antes de rodar (aba Cabotagem > Verificação diária)' };
  }

  state.running = true;
  state.log = [];
  state.lastResult = null;

  (async () => {
    try {
      state.step = 'Buscando e-mail com planilha em anexo...';
      pushLog(state.step);
      const start = cteRunner.buscarAnexo(cfg.pasta, cfg.assunto || null, ANEXO_PATH);
      if (!start.ok) throw new Error(start.error);

      const runnerStatus = await waitForCteRunner();
      runnerStatus.log.forEach((l) => pushLog(l.message));

      if (runnerStatus.lastExitCode !== 0 || !runnerStatus.lastResult) {
        throw new Error('Não foi possível encontrar/baixar o anexo (veja o log acima).');
      }

      state.step = 'Filtrando pela data de hoje e cruzando as SPEs com o Ravex...';
      pushLog(state.step);

      const hoje = new Date().toISOString().slice(0, 10);
      const resultado = await speLookup.lookupSpes(ANEXO_PATH, cfg.speColumn, cfg.dateColumn || null, cfg.dateColumn ? hoje : null);
      if (!resultado.ok) throw new Error(resultado.error);

      const outputPath = path.join(DOWNLOADS_DIR, `cabotagem-resultado_${hoje}.xlsx`);
      await speLookup.writeResultSpreadsheet(resultado.resultados, outputPath);

      pushLog(`Planilha de resultado gerada: ${outputPath}`);
      pushLog(`${resultado.total} SPE(s) verificada(s): ${resultado.encontrados} alocada(s), ${resultado.naoEncontrados} não encontrada(s).`);

      state.lastResult = {
        ok: true,
        emailAssunto: runnerStatus.lastResult.assunto,
        emailRecebidoEm: runnerStatus.lastResult.recebidoEm,
        total: resultado.total,
        encontrados: resultado.encontrados,
        naoEncontrados: resultado.naoEncontrados,
        outputPath,
      };

      cfg.lastRunDate = hoje;
      cfg.lastResultPath = outputPath;
      writeConfig(cfg);

      activityLog.add({
        tipo: 'cabotagem',
        titulo: 'Verificação diária de cabotagem concluída',
        detalhe: `${resultado.total} SPE(s): ${resultado.encontrados} alocada(s), ${resultado.naoEncontrados} não encontrada(s).`,
        ok: true,
      });
    } catch (err) {
      pushLog(`Erro: ${err.message}`);
      state.lastResult = { ok: false, error: err.message };
      activityLog.add({ tipo: 'cabotagem', titulo: 'Falha na verificação diária de cabotagem', detalhe: err.message, ok: false });
    } finally {
      state.running = false;
      state.step = null;
    }
  })();

  return { ok: true };
}

function getStatus() {
  return { ...state, config: readConfig() };
}

module.exports = { rodar, getStatus, readConfig, writeConfig, ranAlreadyToday: () => {
  const cfg = readConfig();
  const today = new Date().toISOString().slice(0, 10);
  return Boolean(cfg && cfg.lastRunDate === today);
} };
