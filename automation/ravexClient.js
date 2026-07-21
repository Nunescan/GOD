const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DOWNLOAD_DIR = path.resolve(__dirname, '../data/downloads');
const LOGIN_SELECTOR = 'input[formcontrolname="username"]';
const PASSWORD_SELECTOR = 'input[formcontrolname="password"]';
const SEARCH_SELECTOR = 'input[placeholder="Pesquisar no menu"]';
const EXPORT_SELECTOR = '[aria-label="Exportar todos os dados"], span:has-text("Exportar todos os dados")';

function log(onProgress, message) {
  console.log(`[ravex] ${message}`);
  if (onProgress) onProgress(message);
}

/**
 * Faz login no Ravex, abre Monitoramento e baixa a planilha ("Exportar todos os dados").
 * onProgress(mensagem) e opcional, usado pra mandar status pro dashboard em tempo real.
 */
async function loginAndExport(onProgress) {
  const headless = process.env.RAVEX_HEADLESS !== 'false';
  const url = process.env.RAVEX_URL || 'https://longopercurso.sistema.ravex.com.br/login';
  const username = process.env.RAVEX_USERNAME;
  const password = process.env.RAVEX_PASSWORD;

  if (!username || !password) {
    return { ok: false, error: 'RAVEX_USERNAME/RAVEX_PASSWORD nao configurados no arquivo .env' };
  }

  const browser = await chromium.launch({ headless });
  // viewport largo evita que a toolbar do grid colapse o botao de exportar num menu "...",
  // mas ainda assim aplicamos o zoom 80% pedido, pra ficar igual ao uso manual
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  try {
    log(onProgress, 'Abrindo pagina de login...');
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
    log(onProgress, 'Aguardando a grade carregar...');
    await page.waitForSelector('.dx-datagrid', { timeout: 60000 });
    await page.waitForTimeout(2500); // da tempo dos dados do grid preencherem de fato

    // zoom 80%: com isso a toolbar do grid tem espaco de sobra e o botao de exportar
    // fica sempre visivel (sem cair no menu de overflow "...")
    await page.evaluate(() => {
      document.body.style.zoom = '0.8';
    });
    await page.waitForTimeout(500);

    log(onProgress, 'Exportando planilha...');
    const exportLocator = page.locator(EXPORT_SELECTOR).first();
    await exportLocator.waitFor({ state: 'visible', timeout: 30000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      exportLocator.click(),
    ]);

    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const dateStamp = new Date().toISOString().slice(0, 10);
    const savedPath = path.join(DOWNLOAD_DIR, `monitoramento_${dateStamp}.xlsx`);
    await download.saveAs(savedPath);

    // "latest.xlsx" e sempre a copia mais recente, e o que o dashboard le
    const latestPath = path.join(DOWNLOAD_DIR, 'latest.xlsx');
    fs.copyFileSync(savedPath, latestPath);

    log(onProgress, 'Planilha baixada com sucesso.');
    return { ok: true, file: savedPath, timestamp: new Date().toISOString() };
  } catch (err) {
    log(onProgress, `Erro: ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    await browser.close();
  }
}

module.exports = { loginAndExport, DOWNLOAD_DIR };
