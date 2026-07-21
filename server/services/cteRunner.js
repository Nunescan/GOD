const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// "CZAR" e o programa de CT-e (Streamlit) que ja existia antes deste painel -
// esse modulo so sabe ligar/desligar ele e capturar tudo que aparece no
// terminal (log, erros, progresso) pra mostrar na tela de CT-e do painel.
const CTE_DIR = path.resolve(__dirname, '../../cte-czar');
const VENV_PYTHON = path.join(CTE_DIR, 'venv', 'Scripts', 'python.exe');
const PORT = 8501;
const MAX_LOG_LINES = 500;

const state = {
  running: false,
  startedAt: null,
  pid: null,
  lastExitCode: null,
  log: [],
};

let proc = null;

function pushLog(chunk) {
  String(chunk)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((message) => state.log.push({ time: new Date().toISOString(), message }));

  if (state.log.length > MAX_LOG_LINES) {
    state.log.splice(0, state.log.length - MAX_LOG_LINES);
  }
}

function isInstalled() {
  return fs.existsSync(VENV_PYTHON);
}

function start() {
  if (state.running) return { ok: false, error: 'O CZAR já está rodando' };
  if (!isInstalled()) {
    return { ok: false, error: 'Ambiente Python do CZAR não encontrado (cte-czar/venv). Rode scripts/instalar-cte.bat primeiro.' };
  }

  state.log = [];
  state.lastExitCode = null;

  proc = spawn(
    VENV_PYTHON,
    ['-m', 'streamlit', 'run', 'main.py', '--server.headless', 'true', '--server.address', '127.0.0.1', `--server.port=${PORT}`, '--browser.gatherUsageStats', 'false'],
    { cwd: CTE_DIR }
  );

  state.running = true;
  state.startedAt = new Date().toISOString();
  state.pid = proc.pid;
  pushLog('Iniciando CZAR...');

  proc.stdout.on('data', pushLog);
  proc.stderr.on('data', pushLog);

  proc.on('exit', (code) => {
    state.running = false;
    state.lastExitCode = code;
    pushLog(`Processo encerrado (código ${code}).`);
    proc = null;
  });

  proc.on('error', (err) => {
    state.running = false;
    pushLog(`Erro ao iniciar: ${err.message}`);
    proc = null;
  });

  return { ok: true, port: PORT };
}

function stop() {
  if (!state.running || !proc) return { ok: false, error: 'O CZAR não está rodando' };
  proc.kill();
  return { ok: true };
}

function getStatus() {
  return { ...state, port: PORT, installed: isInstalled() };
}

module.exports = { start, stop, getStatus, PORT, CTE_DIR };
