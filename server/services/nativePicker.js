const { spawn } = require('child_process');

// Abre a caixa de dialogo nativa do Windows (Explorer) pra escolher um
// arquivo ou uma pasta, via PowerShell + Windows Forms. So funciona numa
// sessao de desktop interativa (que e sempre o caso aqui: e o proprio PC do
// usuario que roda o servidor).
function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    let out = '';
    let err = '';
    ps.stdout.on('data', (d) => { out += d.toString(); });
    ps.stderr.on('data', (d) => { err += d.toString(); });
    ps.on('error', reject);
    ps.on('close', (code) => {
      if (code !== 0 && err) return reject(new Error(err.trim()));
      resolve(out.trim());
    });
  });
}

async function pickFile() {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    $f = New-Object System.Windows.Forms.OpenFileDialog
    $f.Title = 'Selecione um arquivo'
    $f.Filter = 'Todos os arquivos (*.*)|*.*'
    if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }
  `;
  const result = await runPowerShell(script);
  return result || null;
}

async function pickFolder() {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    $f = New-Object System.Windows.Forms.FolderBrowserDialog
    $f.Description = 'Selecione uma pasta'
    if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }
  `;
  const result = await runPowerShell(script);
  return result || null;
}

module.exports = { pickFile, pickFolder };
