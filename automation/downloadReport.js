require('dotenv').config();
const { loginAndExport } = require('./ravexClient');

(async () => {
  console.log('Iniciando login e exportacao do Ravex...');
  const result = await loginAndExport();
  if (result.ok) {
    console.log('Exportado com sucesso:', result.file);
    process.exit(0);
  } else {
    console.error('Falhou:', result.error);
    process.exit(1);
  }
})();
