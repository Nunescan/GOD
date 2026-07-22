const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const activityLog = require('./activityLog');

// "CZAR" e o programa de CT-e que ja existia antes deste painel - agora e um
// unico CLI Python (cte-czar/cli.py) chamado por comando, sem servidor
// separado nem aba de navegador extra. Cada chamada roda, imprime log ao
// vivo (capturado aqui) e termina - nada fica rodando em segundo plano
// depois que o comando acaba.
const CTE_DIR = path.resolve(__dirname, '../../cte-czar');
const VENV_PYTHON = path.join(CTE_DIR, 'venv', 'Scripts', 'python.exe');
const CLI_PATH = path.join(CTE_DIR, 'cli.py');
const MAX_LOG_LINES = 500;

const state = {
  running: false,
  command: null,
  startedAt: null,
  finishedAt: null,
  lastExitCode: null,
  lastResult: null,
  log: [],
};

let proc = null;

function pushLog(chunk) {
  String(chunk)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((message) => {
      if (message.startsWith('RESULT:')) {
        try {
          state.lastResult = JSON.parse(message.slice('RESULT:'.length));
        } catch {
          // ignora linha RESULT: malformada, nao interrompe o log
        }
        return;
      }
      state.log.push({ time: new Date().toISOString(), message });
    });

  if (state.log.length > MAX_LOG_LINES) {
    state.log.splice(0, state.log.length - MAX_LOG_LINES);
  }
}

function isInstalled() {
  return fs.existsSync(VENV_PYTHON);
}

function run(commandArgs, label) {
  if (state.running) return { ok: false, error: 'Já existe um comando do CZAR em andamento' };
  if (!isInstalled()) {
    return { ok: false, error: 'Ambiente Python do CZAR não encontrado (cte-czar/venv). Rode scripts/instalar-cte.bat primeiro.' };
  }

  state.log = [];
  state.lastResult = null;
  state.lastExitCode = null;
  state.command = label;
  state.startedAt = new Date().toISOString();
  state.finishedAt = null;
  state.running = true;

  pushLog(`Executando: ${label}`);

  proc = spawn(VENV_PYTHON, [CLI_PATH, ...commandArgs], {
    cwd: CTE_DIR,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });

  proc.stdout.on('data', pushLog);
  proc.stderr.on('data', pushLog);

  proc.on('exit', (code) => {
    state.running = false;
    state.lastExitCode = code;
    state.finishedAt = new Date().toISOString();
    pushLog(code === 0 ? 'Concluído com sucesso.' : `Encerrado com erro (código ${code}).`);
    activityLog.add({
      tipo: 'cte',
      titulo: label,
      detalhe: code === 0 ? 'Concluído com sucesso.' : `Encerrado com erro (código ${code}).`,
      ok: code === 0,
    });
    proc = null;
  });

  proc.on('error', (err) => {
    state.running = false;
    state.finishedAt = new Date().toISOString();
    pushLog(`Erro ao iniciar: ${err.message}`);
    proc = null;
  });

  return { ok: true };
}

function stop() {
  if (!state.running || !proc) return { ok: false, error: 'Nada em execução no momento' };
  proc.kill();
  return { ok: true };
}

function getStatus() {
  return { ...state, installed: isInstalled() };
}

module.exports = {
  processar: (armador, origem, destino) => run(
    ['processar', '--armador', armador, '--origem', origem, ...(destino ? ['--destino', destino] : [])],
    `Processar arquivos - ${armador}`
  ),
  relatorio: (armador, pasta) => run(
    ['relatorio', '--armador', armador, '--pasta', pasta],
    `Gerar relatório - ${armador}`
  ),
  coletar: (dias) => run(['coletar', '--dias', String(dias || 9999)], 'Coleta do Outlook'),
  pastasOutlook: () => run(['pastas-outlook'], 'Escanear pastas do Outlook'),
  buscarAnexo: (pasta, assunto, destino) => run(
    ['buscar-anexo', '--pasta', pasta, ...(assunto ? ['--assunto', assunto] : []), '--destino', destino],
    `Buscar anexo de e-mail - ${pasta}`
  ),
  buscarEmails: (pasta, palavras, limite) => run(
    ['buscar-emails', '--pasta', pasta, ...(palavras ? ['--palavras', palavras] : []), '--limite', String(limite || 50)],
    `Buscar e-mails - ${pasta}`
  ),
  enviarEmail: (para, assunto, corpo, anexo) => run(
    ['enviar-email', ...(para ? ['--para', para] : []), ...(assunto ? ['--assunto', assunto] : []), ...(corpo ? ['--corpo', corpo] : []), ...(anexo ? ['--anexo', anexo] : [])],
    'Abrir rascunho de e-mail'
  ),
  stop,
  getStatus,
  isInstalled,
  CTE_DIR,
};
