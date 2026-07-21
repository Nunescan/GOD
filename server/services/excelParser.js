const ExcelJS = require('exceljs');
const fs = require('fs');

// Palavras-chave usadas pra descobrir automaticamente qual coluna da planilha
// corresponde a cada campo, mesmo que o cabecalho real varie um pouco
// (ex: "Posição Atual", "Posicao atual do veiculo" etc caem no mesmo campo).
const FIELD_KEYWORDS = {
  programacao: ['programacao de transporte', 'programacao', 'nr programacao', 'numero da viagem', 'viagem'],
  origem: ['origem'],
  destino: ['destino'],
  posicaoAtual: ['posicao atual', 'posicao'],
  status: ['status', 'situacao'],
  motorista: ['motorista'],
  placa: ['placa'],
  transportadora: ['transportadora'],
  previsaoChegada: ['previsao de chegada', 'previsao chegada', 'data prevista', 'eta'],
  dataSaida: ['data de saida', 'data saida', 'saida'],
};

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function detectColumnMap(headers) {
  const normalizedHeaders = headers.map(normalize);
  const map = {};
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    let found = null;
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (keywords.some((kw) => normalizedHeaders[i].includes(kw))) {
        found = headers[i];
        break;
      }
    }
    map[field] = found;
  }
  return map;
}

// Converte o valor de uma celula do exceljs (que pode ser texto simples, rich
// text, formula ou data) num valor "plano" pronto pra usar.
function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return v.text;
  }
  return v;
}

async function readSheetRows(filePath) {
  if (!fs.existsSync(filePath)) return [];

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headers = [];
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
      const key = headers[colNumber];
      if (key) obj[key] = cellValue(cell);
    });
    rows.push(obj);
  });

  return rows;
}

/**
 * Le a planilha exportada do Ravex e devolve linhas normalizadas com os campos
 * de interesse (programacao, origem, destino, posicaoAtual, status, etc).
 * O mapeamento de colunas fica disponivel em columnMap para conferencia/ajuste.
 */
async function normalizeRows(filePath) {
  const rawRows = await readSheetRows(filePath);
  if (rawRows.length === 0) return { rows: [], columnMap: {}, rawHeaders: [] };

  const rawHeaders = Object.keys(rawRows[0]);
  const columnMap = detectColumnMap(rawHeaders);

  const rows = rawRows.map((row, idx) => {
    const get = (field) => (columnMap[field] ? row[columnMap[field]] : '');
    return {
      _rowIndex: idx,
      programacao: String(get('programacao') || '').trim(),
      origem: String(get('origem') || '').trim(),
      destino: String(get('destino') || '').trim(),
      posicaoAtual: String(get('posicaoAtual') || '').trim(),
      status: String(get('status') || '').trim(),
      motorista: String(get('motorista') || '').trim(),
      placa: String(get('placa') || '').trim(),
      transportadora: String(get('transportadora') || '').trim(),
      previsaoChegada: String(get('previsaoChegada') || '').trim(),
      dataSaida: String(get('dataSaida') || '').trim(),
      raw: row,
    };
  });

  return { rows, columnMap, rawHeaders };
}

module.exports = { normalizeRows, detectColumnMap };
