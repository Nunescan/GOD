const ExcelJS = require('exceljs');
const fs = require('fs');
const { parseCoords } = require('./veiculoParser');

// Relatorio "Espelhamento": ainda nao sabemos o layout exato das colunas (nao
// veio um exemplo da planilha), entao em vez de supor posicao fixa (o que ja
// gerou bug antes com outros relatorios), detectamos automaticamente: (1) a
// coluna de SPE/Programacao por palavra-chave no cabecalho, e (2) a coluna de
// coordenadas testando quem tem mais valores no formato "lat, lng" numa
// amostra das linhas. Se nao achar as duas, devolve vazio (nao quebra nada -
// so fica sem essa fonte extra de coordenadas).
const SPE_KEYWORDS = [' spe ', ' spe', 'spe ', 'programacao de transporte', 'programacao', 'nr programacao'];
const SAMPLE_SIZE = 30;

function normalize(str) {
  return ` ${String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()} `;
}

function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return v.text;
  }
  return v;
}

function detectSpeColumn(headers) {
  // headers[colNumber] ja e 1-indexado (igual ExcelJS); o indice do match
  // bate direto com o numero da coluna, sem precisar ajustar
  const normalized = headers.map(normalize);
  for (const kw of SPE_KEYWORDS) {
    const idx = normalized.findIndex((h) => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return null;
}

function detectCoordColumn(rows, columnCount) {
  let best = { col: null, hits: 0 };
  for (let col = 1; col <= columnCount; col += 1) {
    let hits = 0;
    for (const row of rows) {
      if (parseCoords(row[col])) hits += 1;
    }
    if (hits > best.hits) best = { col, hits };
  }
  return best.hits >= 3 ? best.col : null;
}

/**
 * Le o relatorio de Espelhamento e devolve um mapa
 * { [spe]: { lat, lng, source: 'espelhamento' } }, no mesmo formato do
 * relatorio de Informacoes do Veiculo - usado como fonte extra de coordenadas
 * precisas quando o veiculo nao tiver.
 */
async function readEspelhamentoCoords(filePath) {
  const coordsBySpe = {};
  if (!fs.existsSync(filePath)) return coordsBySpe;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return coordsBySpe;

  const headers = [''];
  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber] = String(cellValue(cell) || '').trim();
      });
      return;
    }
    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      obj[colNumber] = cellValue(cell);
    });
    rows.push(obj);
  });

  const speCol = detectSpeColumn(headers);
  if (!speCol) return coordsBySpe;

  const coordCol = detectCoordColumn(rows.slice(0, SAMPLE_SIZE), headers.length);
  if (!coordCol) return coordsBySpe;

  rows.forEach((row) => {
    const spe = String(row[speCol] || '').trim();
    if (!spe) return;
    const coords = parseCoords(row[coordCol]);
    if (coords) coordsBySpe[spe] = { ...coords, source: 'espelhamento' };
  });

  return coordsBySpe;
}

module.exports = { readEspelhamentoCoords };
