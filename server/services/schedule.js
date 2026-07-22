const fs = require('fs');
const path = require('path');

const SCHEDULE_FILE = path.resolve(__dirname, '../../config/schedule.json');

function readSchedule() {
  if (!fs.existsSync(SCHEDULE_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSchedule(data) {
  fs.mkdirSync(path.dirname(SCHEDULE_FILE), { recursive: true });
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(data, null, 2));
}

// minutos entre atualizacoes automaticas do Ravex - prioriza o que foi
// configurado pela tela; cai pro .env e depois pro padrao de 10 min
function getAutoRefreshMinutes() {
  const saved = readSchedule().autoRefreshMinutes;
  if (Number.isFinite(saved) && saved > 0) return saved;
  return parseInt(process.env.AUTO_REFRESH_MINUTES || '10', 10);
}

function setAutoRefreshMinutes(minutes) {
  const atual = readSchedule();
  writeSchedule({ ...atual, autoRefreshMinutes: minutes });
}

module.exports = { getAutoRefreshMinutes, setAutoRefreshMinutes };
