startClock(document.getElementById('clock'), document.getElementById('dateLabel'));

const EMOJI_OPTIONS = [
  '📧', '🌐', '📊', '📁', '📂', '📈', '📑', '🧾',
  '🚚', '🗺️', '⚙️', '💻', '📞', '🔧', '📌', '🖥️',
  '📅', '💬', '🔗', '📄', '📋', '🧮', '📦', '⭐',
];

// ---------- credenciais do ravex ----------
const ravexForm = document.getElementById('ravexForm');
const ravexUsername = document.getElementById('ravexUsername');
const ravexPassword = document.getElementById('ravexPassword');
const ravexMsg = document.getElementById('ravexMsg');
const testBtn = document.getElementById('testBtn');
const testLog = document.getElementById('testLog');

async function loadRavexSettings() {
  try {
    const data = await fetchJSON('/api/settings/ravex');
    ravexUsername.value = data.username || '';
    ravexPassword.placeholder = data.hasPassword
      ? '•••••••• (deixe em branco pra manter a atual)'
      : 'Digite a senha do Ravex';
  } catch (err) {
    ravexMsg.textContent = `Erro ao carregar: ${err.message}`;
    ravexMsg.classList.add('error');
  }
}

ravexForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  ravexMsg.textContent = '';
  ravexMsg.classList.remove('error');
  try {
    await fetchJSON('/api/settings/ravex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ravexUsername.value.trim(), password: ravexPassword.value }),
    });
    ravexPassword.value = '';
    ravexMsg.textContent = 'Salvo!';
    await loadRavexSettings();
  } catch (err) {
    ravexMsg.textContent = err.message;
    ravexMsg.classList.add('error');
  }
});

// ---------- API key do AIS (rastreamento de navios) ----------
const aisForm = document.getElementById('aisForm');
const aisApiKey = document.getElementById('aisApiKey');
const aisMsg = document.getElementById('aisMsg');

async function loadAisSettings() {
  try {
    const data = await fetchJSON('/api/settings/ais-key');
    aisApiKey.placeholder = data.hasKey
      ? '•••••••• (deixe em branco pra manter a atual)'
      : 'Cole aqui a API key do aisstream.io';
  } catch {
    // silencioso
  }
}

aisForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!aisApiKey.value.trim()) return;
  aisMsg.textContent = '';
  aisMsg.classList.remove('error');
  try {
    await fetchJSON('/api/settings/ais-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: aisApiKey.value.trim() }),
    });
    aisApiKey.value = '';
    aisMsg.textContent = 'Salvo! Conectando ao rastreamento de navios...';
    await loadAisSettings();
  } catch (err) {
    aisMsg.textContent = err.message;
    aisMsg.classList.add('error');
  }
});

testBtn.addEventListener('click', async () => {
  testBtn.disabled = true;
  testLog.textContent = 'Abrindo o navegador pra você acompanhar...';
  try {
    await fetchJSON('/api/automation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible: true }),
    });
    const poll = setInterval(async () => {
      const state = await fetchJSON('/api/automation/status');
      const last = state.log[state.log.length - 1];
      if (last) testLog.textContent = last.message;
      if (!state.running) {
        clearInterval(poll);
        testBtn.disabled = false;
        testLog.textContent = state.lastResult && state.lastResult.ok
          ? 'Funcionou! Planilha baixada com sucesso.'
          : `Falhou: ${state.lastResult ? state.lastResult.error : 'erro desconhecido'}`;
      }
    }, 1500);
  } catch (err) {
    testLog.textContent = `Erro: ${err.message}`;
    testBtn.disabled = false;
  }
});

// ---------- mapeamento de colunas ----------
const FIELD_LABELS = {
  programacao: 'Programação de Transporte',
  origem: 'Origem',
  destino: 'Destino',
  posicaoAtual: 'Posição Atual',
  status: 'Status',
  motorista: 'Motorista',
  placa: 'Placa',
  transportadora: 'Transportadora',
  previsaoChegada: 'Previsão de Chegada',
  dataSaida: 'Data de Saída',
};

const columnMapForm = document.getElementById('columnMapForm');
const columnMapMsg = document.getElementById('columnMapMsg');

async function loadColumnMap() {
  try {
    const data = await fetchJSON('/api/settings/columns');
    if (!data.rawHeaders || data.rawHeaders.length === 0) {
      columnMapForm.innerHTML = '<div class="empty-state">Nenhuma planilha carregada ainda — atualize o monitoramento primeiro.</div>';
      return;
    }
    columnMapForm.innerHTML = data.fields.map((field) => {
      const current = data.overrides[field] || '';
      const detected = data.detected[field] || '';
      const autoLabel = detected ? `Automático (${detected})` : 'Automático (não detectado)';
      const options = data.rawHeaders.map((h) =>
        `<option value="${h}" ${h === current ? 'selected' : ''}>${h}</option>`
      ).join('');
      return `
        <div class="field" style="margin-bottom:10px;">
          <label>${FIELD_LABELS[field] || field}</label>
          <select data-field="${field}">
            <option value="">${autoLabel}</option>
            ${options}
          </select>
        </div>
      `;
    }).join('');
  } catch (err) {
    columnMapForm.innerHTML = `<div class="empty-state">Erro: ${err.message}</div>`;
  }
}

document.getElementById('saveColumnMapBtn').addEventListener('click', async () => {
  const overrides = {};
  columnMapForm.querySelectorAll('select[data-field]').forEach((sel) => {
    if (sel.value) overrides[sel.dataset.field] = sel.value;
  });
  columnMapMsg.textContent = 'Reprocessando...';
  columnMapMsg.classList.remove('error');
  try {
    await fetchJSON('/api/settings/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(overrides),
    });
    columnMapMsg.textContent = 'Salvo e reprocessado!';
    loadColumnMap();
  } catch (err) {
    columnMapMsg.textContent = err.message;
    columnMapMsg.classList.add('error');
  }
});

// ---------- senha do painel ----------
const appPasswordForm = document.getElementById('appPasswordForm');
const currentPasswordField = document.getElementById('currentPasswordField');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const appPasswordMsg = document.getElementById('appPasswordMsg');

async function loadAppPasswordState() {
  const status = await fetchJSON('/api/auth/status');
  currentPasswordField.style.display = status.configured ? 'flex' : 'none';
}

appPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  appPasswordMsg.textContent = '';
  appPasswordMsg.classList.remove('error');
  try {
    await fetchJSON('/api/settings/app-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPasswordInput.value, newPassword: newPasswordInput.value }),
    });
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    appPasswordMsg.textContent = 'Senha atualizada!';
    await loadAppPasswordState();
  } catch (err) {
    appPasswordMsg.textContent = err.message;
    appPasswordMsg.classList.add('error');
  }
});

// ---------- atalhos ----------
const shortcutList = document.getElementById('shortcutList');
const emojiPicker = document.getElementById('emojiPicker');
const iconPreviewBtn = document.getElementById('iconPreviewBtn');
const shortcutName = document.getElementById('shortcutName');
const shortcutPath = document.getElementById('shortcutPath');
const shortcutMsg = document.getElementById('shortcutMsg');
const editingId = document.getElementById('editingId');
const formTitle = document.getElementById('formTitle');
const cancelEditBtn = document.getElementById('cancelEditBtn');

let selectedIcon = '🔗';

emojiPicker.innerHTML = EMOJI_OPTIONS.map((e) => `<button type="button" class="emoji-option" data-emoji="${e}">${e}</button>`).join('');
emojiPicker.querySelectorAll('.emoji-option').forEach((btn) => {
  btn.addEventListener('click', () => selectIcon(btn.dataset.emoji));
});

function selectIcon(emoji) {
  selectedIcon = emoji;
  iconPreviewBtn.textContent = emoji;
  emojiPicker.querySelectorAll('.emoji-option').forEach((b) => {
    b.classList.toggle('selected', b.dataset.emoji === emoji);
  });
}

function resetShortcutForm() {
  editingId.value = '';
  shortcutName.value = '';
  shortcutPath.value = '';
  selectIcon('🔗');
  formTitle.textContent = 'Adicionar atalho';
  cancelEditBtn.style.display = 'none';
  shortcutMsg.textContent = '';
}

cancelEditBtn.addEventListener('click', resetShortcutForm);

async function loadShortcuts() {
  try {
    const apps = await fetchJSON('/api/launcher/apps');
    if (apps.length === 0) {
      shortcutList.innerHTML = '<div class="empty-state">Nenhum atalho cadastrado ainda.</div>';
      return;
    }
    shortcutList.innerHTML = apps.map((a) => `
      <div class="shortcut-row" data-id="${a.id}">
        <div class="icon-preview">${a.icon || '🔗'}</div>
        <div>
          <div class="name">${a.name}</div>
          <div class="path">${a.path}</div>
        </div>
        <div class="actions">
          <button type="button" class="icon-btn edit-btn" title="Editar">✏️</button>
          <button type="button" class="icon-btn danger delete-btn" title="Remover">🗑️</button>
        </div>
      </div>
    `).join('');

    shortcutList.querySelectorAll('.edit-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.shortcut-row');
        const app = apps.find((a) => a.id === row.dataset.id);
        editingId.value = app.id;
        shortcutName.value = app.name;
        shortcutPath.value = app.path;
        selectIcon(app.icon || '🔗');
        formTitle.textContent = `Editando "${app.name}"`;
        cancelEditBtn.style.display = 'inline-block';
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      });
    });

    shortcutList.querySelectorAll('.delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('.shortcut-row');
        if (!confirm('Remover este atalho?')) return;
        await fetchJSON(`/api/launcher/apps/${row.dataset.id}`, { method: 'DELETE' });
        loadShortcuts();
      });
    });
  } catch (err) {
    shortcutList.innerHTML = `<div class="empty-state">Erro ao carregar atalhos: ${err.message}</div>`;
  }
}

async function pick(type) {
  shortcutMsg.textContent = 'Abrindo janela de seleção... (pode aparecer atrás, veja a barra de tarefas)';
  try {
    const result = await fetchJSON('/api/launcher/pick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    if (result.path) shortcutPath.value = result.path;
    shortcutMsg.textContent = '';
  } catch (err) {
    shortcutMsg.textContent = `Erro: ${err.message}`;
  }
}

document.getElementById('pickFileBtn').addEventListener('click', () => pick('file'));
document.getElementById('pickFolderBtn').addEventListener('click', () => pick('folder'));
iconPreviewBtn.addEventListener('click', () => emojiPicker.scrollIntoView({ behavior: 'smooth' }));

document.getElementById('saveShortcutBtn').addEventListener('click', async () => {
  const name = shortcutName.value.trim();
  const pathValue = shortcutPath.value.trim();
  if (!name || !pathValue) {
    shortcutMsg.textContent = 'Preencha nome e caminho.';
    shortcutMsg.classList.add('error');
    return;
  }
  shortcutMsg.classList.remove('error');

  const body = JSON.stringify({ name, path: pathValue, icon: selectedIcon });
  try {
    if (editingId.value) {
      await fetchJSON(`/api/launcher/apps/${editingId.value}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    } else {
      await fetchJSON('/api/launcher/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
    }
    resetShortcutForm();
    loadShortcuts();
  } catch (err) {
    shortcutMsg.textContent = err.message;
    shortcutMsg.classList.add('error');
  }
});

selectIcon('🔗');
loadRavexSettings();
loadAisSettings();
loadColumnMap();
loadAppPasswordState();
loadShortcuts();
