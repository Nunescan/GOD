const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { pickFile, pickFolder } = require('../services/nativePicker');

const router = express.Router();
const CONFIG_FILE = path.resolve(__dirname, '../../config/launcher.json');
const EXAMPLE_FILE = path.resolve(__dirname, '../../config/launcher.example.json');

function readConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    if (fs.existsSync(EXAMPLE_FILE)) fs.copyFileSync(EXAMPLE_FILE, CONFIG_FILE);
    else return [];
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeConfig(list) {
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(list, null, 2));
}

function slugify(name) {
  return String(name || 'atalho')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'atalho';
}

function makeId(name, existing) {
  const base = slugify(name);
  let id = base;
  let n = 2;
  while (existing.some((a) => a.id === id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

router.get('/apps', (req, res) => {
  res.json(readConfig());
});

router.post('/apps', (req, res) => {
  const { name, path: itemPath, icon } = req.body || {};
  if (!name || !itemPath) return res.status(400).json({ ok: false, error: 'Nome e caminho são obrigatórios' });

  const apps = readConfig();
  const item = { id: makeId(name, apps), name, path: itemPath, icon: icon || '🔗' };
  apps.push(item);
  writeConfig(apps);
  res.json({ ok: true, item, apps });
});

router.put('/apps/:id', (req, res) => {
  const apps = readConfig();
  const item = apps.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: 'Atalho não encontrado' });

  const { name, path: itemPath, icon } = req.body || {};
  if (name) item.name = name;
  if (itemPath) item.path = itemPath;
  if (icon) item.icon = icon;
  writeConfig(apps);
  res.json({ ok: true, item, apps });
});

router.delete('/apps/:id', (req, res) => {
  const apps = readConfig();
  const next = apps.filter((a) => a.id !== req.params.id);
  if (next.length === apps.length) return res.status(404).json({ ok: false, error: 'Atalho não encontrado' });
  writeConfig(next);
  res.json({ ok: true, apps: next });
});

// Abre a caixa de dialogo nativa do Windows pra escolher um arquivo/pasta do PC
// e devolve o caminho, pronto pra colar no formulario de atalho.
router.post('/pick', async (req, res) => {
  const { type } = req.body || {};
  try {
    const selected = type === 'folder' ? await pickFolder() : await pickFile();
    res.json({ ok: true, path: selected });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// So abre caminhos ja cadastrados em config/launcher.json (editados por voce
// mesmo, localmente) - nunca um caminho livre vindo do corpo da requisicao.
router.post('/open', (req, res) => {
  const { id } = req.body || {};
  const item = readConfig().find((a) => a.id === id);
  if (!item) return res.status(404).json({ ok: false, error: 'App não encontrado' });

  exec(`start "" "${item.path}"`, { shell: 'cmd.exe' }, (err) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });
    res.json({ ok: true });
  });
});

module.exports = router;
