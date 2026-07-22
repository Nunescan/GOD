const fs = require('fs');
const path = require('path');

// Historico do que o painel ja fez (automacao do Ravex, comandos do CT-e,
// verificacoes de cabotagem...). Fica salvo em disco pra sobreviver a
// reinicios do servidor - diferente do log de execucao "ao vivo" de cada
// automacao (que e só o que aconteceu NAQUELA rodada), isso aqui e o
// historico completo, pra responder "o que já foi feito".
const LOG_FILE = path.resolve(__dirname, '../../data/cache/activity-log.json');
const MAX_ENTRIES = 500;

function readAll() {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function add(entry) {
  const all = readAll();
  all.unshift({
    time: new Date().toISOString(),
    ...entry,
  });
  if (all.length > MAX_ENTRIES) all.length = MAX_ENTRIES;
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(all, null, 2));
}

function list(limit) {
  const all = readAll();
  return limit ? all.slice(0, limit) : all;
}

// verifica se ja rodou algo com essa "chave" hoje (usado pra rodar a
// verificacao diaria de cabotagem uma vez por dia, na primeira vez que o
// painel abre, sem repetir se o servidor reiniciar de novo no mesmo dia)
function ranToday(key) {
  const today = new Date().toISOString().slice(0, 10);
  return readAll().some((e) => e.key === key && e.time.slice(0, 10) === today);
}

module.exports = { add, list, ranToday };
