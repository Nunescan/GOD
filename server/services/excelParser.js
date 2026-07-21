const ExcelJS = require('exceljs');
const fs = require('fs');

// Palavras-chave usadas pra descobrir automaticamente qual coluna da planilha
// corresponde a cada campo, mesmo que o cabecalho real varie um pouco
// (ex: "Posição Atual", "Posicao atual do veiculo" etc caem no mesmo campo).
// "include": palavras-chave que precisam aparecer no cabecalho (por
// substring). "exclude" (opcional): se aparecer, descarta esse cabecalho pro
// campo, mesmo que tenha batido no include - evita colisao entre campos
// parecidos (ex: "Placa Carreta" nao pode virar o campo "placa" do cavalo).
// Cuidado com keywords curtas: "eta" bate em "carreta" por substring, entao
// evitamos abreviacoes assim.
const FIELD_KEYWORDS = {
  programacao: { include: ['programacao de transporte', 'programacao', 'nr programacao', 'numero da viagem', 'viagem'] },
  origem: { include: ['origem'] },
  destino: { include: ['destino'] },
  posicaoAtual: { include: ['posicao atual', 'posicao'] },
  status: { include: ['status', 'situacao'] },
  motorista: { include: ['motorista'] },
  // "placa" no Ravex e a placa do cavalo (unidade tratora) - exclui headers
  // de carreta pra nao roubar a coluna errada quando os dois tem "placa" no nome
  placa: { include: ['placa cavalo', 'placa'], exclude: ['carreta', 'reboque'] },
  carreta: { include: ['carreta', 'reboque', 'placa carreta'] },
  transportadora: { include: ['transportadora'] },
  previsaoChegada: { include: ['previsao de chegada', 'previsao chegada', 'data prevista', 'data de chegada'] },
  dataSaida: { include: ['data de saida', 'data saida', 'saida'] },
};

// Campos que sao datas de verdade - os demais nunca devem receber um valor
// de data (se receberem, e sinal de que a coluna errada foi detectada).
const DATE_FIELDS = new Set(['previsaoChegada', 'dataSaida']);

function normalize(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// overrides (opcional): { campo: "Nome exato da coluna" } - definido manualmente
// em Configuracoes quando a deteccao automatica erra. Tem prioridade sobre as
// palavras-chave.
function detectColumnMap(headers, overrides = {}) {
  const normalizedHeaders = headers.map(normalize);
  const map = {};
  for (const field of Object.keys(FIELD_KEYWORDS)) {
    if (overrides[field] && headers.includes(overrides[field])) {
      map[field] = overrides[field];
      continue;
    }
    const { include, exclude = [] } = FIELD_KEYWORDS[field];
    let found = null;
    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      const matches = include.some((kw) => header.includes(kw));
      const blocked = exclude.some((kw) => header.includes(kw));
      if (matches && !blocked) {
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

// Formata o valor final de um campo. Campos de texto (programacao, origem,
// destino, posicaoAtual, status...) nunca podem virar uma data - se a celula
// mapeada tiver uma data, e sinal de coluna errada, entao fica vazio em vez
// de virar um texto tipo "Mon Jul 20 2026 21:29:40 GMT-0300..." (o que,
// alem de feio, ainda gerava buscas de geocoding inuteis e lentas).
function formatField(value, field) {
  if (value instanceof Date) {
    if (!DATE_FIELDS.has(field)) return '';
    return value.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
  return String(value ?? '').trim();
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
 * overrides: ver detectColumnMap.
 */
async function normalizeRows(filePath, overrides = {}) {
  const rawRows = await readSheetRows(filePath);
  if (rawRows.length === 0) return { rows: [], columnMap: {}, rawHeaders: [] };

  const rawHeaders = Object.keys(rawRows[0]);
  const columnMap = detectColumnMap(rawHeaders, overrides);

  const rows = rawRows.map((row, idx) => {
    const get = (field) => (columnMap[field] ? row[columnMap[field]] : '');
    return {
      _rowIndex: idx,
      programacao: formatField(get('programacao'), 'programacao'),
      origem: formatField(get('origem'), 'origem'),
      destino: formatField(get('destino'), 'destino'),
      posicaoAtual: formatField(get('posicaoAtual'), 'posicaoAtual'),
      status: formatField(get('status'), 'status'),
      motorista: formatField(get('motorista'), 'motorista'),
      placa: formatField(get('placa'), 'placa'),
      carreta: formatField(get('carreta'), 'carreta'),
      transportadora: formatField(get('transportadora'), 'transportadora'),
      previsaoChegada: formatField(get('previsaoChegada'), 'previsaoChegada'),
      dataSaida: formatField(get('dataSaida'), 'dataSaida'),
      raw: row,
    };
  });

  return { rows, columnMap, rawHeaders };
}

module.exports = { normalizeRows, detectColumnMap };
