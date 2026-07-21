const ExcelJS = require('exceljs');
const fs = require('fs');

// Relatorio "Informacoes do Veiculo": colunas F/G/H aparecem mescladas no
// cabecalho, mas o valor de verdade (SPE / Programacao de Transporte) fica na
// coluna G, e as coordenadas geograficas ("-25.09380 , -50.20050") na coluna I.
// Dados comecam na linha 2 (linha 1 e cabecalho). Usamos posicao fixa de coluna
// em vez de nome, porque o cabecalho mesclado nao da pra casar por palavra-chave.
const COL_SPE = 7; // G
const COL_COORDS = 9; // I

const COORD_REGEX = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/;

function parseCoords(value) {
  if (value === null || value === undefined) return null;
  const match = String(value).match(COORD_REGEX);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng, source: 'veiculo' };
}

/**
 * Le o relatorio de Informacoes do Veiculo e devolve um mapa
 * { [spe]: { lat, lng, source: 'veiculo' } } com as coordenadas precisas de
 * cada Programacao de Transporte (SPE), pra usar no lugar da geocodificacao
 * aproximada sempre que disponivel.
 */
async function readVeiculoCoords(filePath) {
  const coordsBySpe = {};
  if (!fs.existsSync(filePath)) return coordsBySpe;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return coordsBySpe;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // cabecalho

    const spe = String(row.getCell(COL_SPE).value ?? '').trim();
    if (!spe) return;

    const coords = parseCoords(row.getCell(COL_COORDS).value);
    if (coords) coordsBySpe[spe] = coords;
  });

  return coordsBySpe;
}

module.exports = { readVeiculoCoords, parseCoords };
