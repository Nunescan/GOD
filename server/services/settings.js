const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Guarda credenciais do Ravex e a senha de acesso ao painel. Fica fora do git
// (config/secrets.json esta no .gitignore) - so existe na maquina do usuario.
const SECRETS_FILE = path.resolve(__dirname, '../../config/secrets.json');

function readSecrets() {
  if (!fs.existsSync(SECRETS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function writeSecrets(data) {
  fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(data, null, 2));
}

// --- credenciais do Ravex ---
// se ainda nao foram salvas pela tela de Configuracoes, cai pro .env (compatibilidade)
function getRavexCredentials() {
  const s = readSecrets();
  return {
    username: s.ravexUsername || process.env.RAVEX_USERNAME || '',
    password: s.ravexPassword || process.env.RAVEX_PASSWORD || '',
  };
}

function setRavexCredentials(username, password) {
  const s = readSecrets();
  if (username !== undefined && username !== null) s.ravexUsername = username;
  if (password) s.ravexPassword = password; // string vazia = manter a atual
  writeSecrets(s);
}

// --- senha de acesso ao painel ---
function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { salt: usedSalt, hash };
}

function isAppPasswordConfigured() {
  const s = readSecrets();
  return Boolean(s.appAuth && s.appAuth.hash);
}

function setAppPassword(password) {
  const s = readSecrets();
  s.appAuth = hashPassword(password);
  writeSecrets(s);
}

function verifyAppPassword(password) {
  const s = readSecrets();
  if (!s.appAuth || !s.appAuth.hash) return false;
  const attempt = hashPassword(password, s.appAuth.salt);
  const a = Buffer.from(attempt.hash, 'hex');
  const b = Buffer.from(s.appAuth.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  getRavexCredentials,
  setRavexCredentials,
  isAppPasswordConfigured,
  setAppPassword,
  verifyAppPassword,
};
