const subtitle = document.getElementById('subtitle');
const form = document.getElementById('loginForm');
const passwordInput = document.getElementById('password');
const confirmField = document.getElementById('confirmField');
const confirmInput = document.getElementById('confirmPassword');
const errorMsg = document.getElementById('errorMsg');
const submitBtn = document.getElementById('submitBtn');

let isSetupMode = false;

async function init() {
  try {
    const status = await fetchJSON('/api/auth/status');
    isSetupMode = !status.configured;
    if (isSetupMode) {
      subtitle.textContent = 'Primeiro acesso: crie uma senha para proteger o painel';
      confirmField.style.display = 'flex';
      submitBtn.textContent = 'Criar senha e entrar';
    }
  } catch (err) {
    errorMsg.textContent = `Servidor indisponível: ${err.message}`;
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorMsg.textContent = '';

  const password = passwordInput.value;
  if (!password) {
    errorMsg.textContent = 'Digite uma senha.';
    return;
  }

  if (isSetupMode) {
    if (password.length < 4) {
      errorMsg.textContent = 'A senha precisa ter pelo menos 4 caracteres.';
      return;
    }
    if (password !== confirmInput.value) {
      errorMsg.textContent = 'As senhas não conferem.';
      return;
    }
  }

  submitBtn.disabled = true;
  try {
    await fetchJSON(isSetupMode ? '/api/auth/setup' : '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const next = getSearchParam('next') || 'index.html';
    window.location.href = next;
  } catch (err) {
    errorMsg.textContent = err.message;
    submitBtn.disabled = false;
  }
});

init();
