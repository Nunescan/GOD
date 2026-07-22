const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { getRavexCredentials } = require('../server/services/settings');

const DOWNLOAD_DIR = path.resolve(__dirname, '../data/downloads');
const DEBUG_DIR = path.resolve(__dirname, '../data/downloads/debug');
const LOGIN_SELECTOR = 'input[formcontrolname="username"]';
const PASSWORD_SELECTOR = 'input[formcontrolname="password"]';
const SEARCH_SELECTOR = 'input[placeholder="Pesquisar no menu"]';
const EXPORT_SELECTOR = '[aria-label="Exportar todos os dados"], span:has-text("Exportar todos os dados")';
const OVERFLOW_SELECTOR = '.dx-toolbar-menu-container .dx-button, .dx-dropdownmenu-button';
const VEICULO_URL = 'https://longopercurso.sistema.ravex.com.br/relatorio-informacoes-veiculo';
const ALOCACAO_URL = 'https://longopercurso.sistema.ravex.com.br/programacao-transporte';
const ESPELHAMENTO_URL = 'https://longopercurso.sistema.ravex.com.br/espelhamento';

// relatorios extras: cada um e uma URL direta + exporta igual ao Monitoramento.
// Se algum falhar, nao derruba os outros - so fica sem aquele dado nessa rodada.
const EXTRA_REPORTS = [
  { url: VEICULO_URL, savePrefix: 'veiculos', latestName: 'veiculos-latest.xlsx', label: 'informações do veículo (coordenadas)' },
  { url: ALOCACAO_URL, savePrefix: 'alocacao', latestName: 'alocacao-latest.xlsx', label: 'programação de transporte (alocação)' },
  { url: ESPELHAMENTO_URL, savePrefix: 'espelhamento', latestName: 'espelhamento-latest.xlsx', label: 'espelhamento (coordenadas)' },
];

function log(onProgress, message) {
  console.log(`[ravex] ${message}`);
  if (onProgress) onProgress(message);
}

/**
 * Espera a grade (DevExtreme) da pagina atual carregar e clica em "Exportar
 * todos os dados", salvando o arquivo baixado. Reaproveitado tanto pro
 * relatorio de Monitoramento quanto pro de Informacoes do Veiculo.
 */
async function exportGrid(page, context, { onProgress, savePrefix, latestName }) {
  log(onProgress, `Aguardando a grade carregar (${savePrefix})...`);
  await page.waitForSelector('.dx-datagrid', { timeout: 60000 });
  // espera os dados de verdade aparecerem (nao so o esqueleto do grid) e
  // qualquer indicador de carregamento sumir, antes de tentar exportar
  await page.waitForSelector('.dx-data-row', { timeout: 30000 }).catch(() => {});
  await page.locator('.dx-loadpanel-content').waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);

  log(onProgress, `Exportando planilha (${savePrefix})...`);
  let exportLocator = page.locator(EXPORT_SELECTOR).first();

  // se o botao nao estiver visivel, a toolbar provavelmente colapsou ele
  // no menu de overflow ("...") - abre esse menu antes de tentar de novo
  if (!(await exportLocator.isVisible().catch(() => false))) {
    const overflow = page.locator(OVERFLOW_SELECTOR).first();
    if (await overflow.count() > 0) {
      await overflow.click();
      await page.waitForTimeout(300);
      exportLocator = page.locator(EXPORT_SELECTOR).first();
    }
  }

  await exportLocator.waitFor({ state: 'visible', timeout: 30000 });
  await exportLocator.scrollIntoViewIfNeeded();

  // as vezes o export abre numa aba nova em vez de disparar o evento de
  // download direto na mesma pagina - escuta os dois casos ao mesmo tempo
  const popupPromise = context.waitForEvent('page', { timeout: 60000 }).catch(() => null);
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 }).catch(() => null);
  await exportLocator.click();

  let download = await downloadPromise;
  if (!download) {
    const popup = await popupPromise;
    if (popup) download = await popup.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  }

  if (!download) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
    const shot = path.join(DEBUG_DIR, `falha_${savePrefix}_${Date.now()}.png`);
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    throw new Error(`Download (${savePrefix}) não iniciou a tempo. Print salvo em ${shot} para investigar.`);
  }

  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const dateStamp = new Date().toISOString().slice(0, 10);
  const savedPath = path.join(DOWNLOAD_DIR, `${savePrefix}_${dateStamp}.xlsx`);
  await download.saveAs(savedPath);

  const latestPath = path.join(DOWNLOAD_DIR, latestName);
  fs.copyFileSync(savedPath, latestPath);

  log(onProgress, `Planilha (${savePrefix}) baixada com sucesso.`);
  return { savedPath, latestPath };
}

/**
 * Faz login no Ravex e baixa dois relatorios: Monitoramento (via menu) e
 * Informacoes do Veiculo (URL direta, tem as coordenadas geograficas).
 * onProgress(mensagem) e opcional, usado pra mandar status pro dashboard em tempo real.
 * opts.headless (opcional) sobrescreve o padrao do .env - usado pelo botao "ver funcionando".
 */
async function loginAndExport(onProgress, opts = {}) {
  const headless = opts.headless !== undefined ? opts.headless : process.env.RAVEX_HEADLESS !== 'false';
  const url = process.env.RAVEX_URL || 'https://longopercurso.sistema.ravex.com.br/login';
  const { username, password } = getRavexCredentials();

  if (!username || !password) {
    return { ok: false, error: 'Credenciais do Ravex nao configuradas. Preencha em Configurações.' };
  }

  const browser = await chromium.launch({ headless });
  // viewport largo evita que a toolbar do grid colapse o botao de exportar num menu "...".
  // (nao usamos zoom de CSS aqui: em paginas controladas pelo Playwright ele pode
  // desalinhar as coordenadas de clique do Chromium e o clique erra o alvo real)
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    log(onProgress, 'Abrindo página de login...');
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    await page.fill(LOGIN_SELECTOR, username);
    await page.fill(PASSWORD_SELECTOR, password);

    log(onProgress, 'Autenticando...');
    const loginButton = page.locator(
      'button[type="submit"], button:has-text("Entrar"), button:has-text("Login"), button:has-text("Acessar")'
    ).first();
    if (await loginButton.count() > 0) {
      await loginButton.click();
    } else {
      await page.locator(PASSWORD_SELECTOR).press('Enter');
    }

    await page.waitForLoadState('networkidle', { timeout: 60000 });

    log(onProgress, 'Abrindo Monitoramento...');
    const searchInput = page.locator(SEARCH_SELECTOR);
    await searchInput.waitFor({ state: 'visible', timeout: 60000 });
    await searchInput.click();
    await searchInput.fill('monitoramento');
    await page.waitForTimeout(800); // tempo pra lista de sugestoes do menu aparecer
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: 60000 });

    const monitoramentoResult = await exportGrid(page, context, {
      onProgress,
      savePrefix: 'monitoramento',
      latestName: 'latest.xlsx',
    });

    // relatorios extras (URL direta cada um): veiculo/coordenadas, situação
    // cadastral, alocação. Cada falha e isolada - nao derruba o Monitoramento
    // nem os outros relatorios extras.
    const extraFiles = {};
    for (const report of EXTRA_REPORTS) {
      try {
        log(onProgress, `Abrindo relatório de ${report.label}...`);
        await page.goto(report.url, { waitUntil: 'networkidle', timeout: 60000 });
        const result = await exportGrid(page, context, {
          onProgress,
          savePrefix: report.savePrefix,
          latestName: report.latestName,
        });
        extraFiles[report.savePrefix] = result.savedPath;
      } catch (err) {
        log(onProgress, `Aviso: falha ao exportar ${report.label}: ${err.message}`);
      }
    }

    return {
      ok: true,
      file: monitoramentoResult.savedPath,
      extraFiles,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    log(onProgress, `Erro: ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    await browser.close();
  }
}

module.exports = { loginAndExport, DOWNLOAD_DIR };
