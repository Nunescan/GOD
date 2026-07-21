const ExcelJS = require('exceljs');
const fs = require('fs');

// Relatorios auxiliares (Situação Cadastral, Alocação/Programação de
// Transporte) cuja estrutura exata de colunas ainda nao foi mapeada. Em vez
// de arriscar adivinhar nomes de campo (o que ja gerou bug antes), lemos
// TODAS as colunas de forma generica e so tentamos achar automaticamente qual
// coluna serve de chave (SPE/Programacao ou Placa) pra vincular com o resto
// dos dados. Se a deteccao errar, da pra ajustar via config/columnMap.json
// como as outras planilhas, ou pedir pra eu ajustar quando o arquivo real
// for conferido.
// keywords curtas tipo "spe" bateriam por substring em coisas como "Despesas"
// ou "Especial" - por isso exigimos "spe" isolado (marcado com espacos) e
// nao qualquer substring, alem das variantes completas mais seguras.
const SPE_KEYWORDS = [' spe ', ' spe', 'spe ', 'programacao de transporte', 'programacao', 'nr programacao'];
const PLACA_KEYWORDS = { include: ['placa cavalo', 'placa do veiculo', 'placa'], exclude: ['carreta', 'reboque'] };

function normalize(str) {
  return ` ${String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()} `;
}

function detectKeyColumns(headers) {
  const normalized = headers.map(normalize);

  let speColumn = null;
  for (const kw of SPE_KEYWORDS) {
    const idx = normalized.findIndex((h) => h.includes(kw));
    if (idx !== -1) { speColumn = headers[idx]; break; }
  }

  let placaColumn = null;
  for (const kw of PLACA_KEYWORDS.include) {
    const idx = normalized.findIndex((h) => h.includes(kw) && !PLACA_KEYWORDS.exclude.some((ex) => h.includes(ex)));
    if (idx !== -1) { placaColumn = headers[idx]; break; }
  }

  return { speColumn, placaColumn };
}

function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    return v.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return v.text;
  }
  return v;
}

/**
 * Le um relatorio auxiliar (planilha qualquer) de forma generica e devolve
 * mapas pra vincular por SPE e por Placa, cada um apontando pro objeto
 * completo da linha (todas as colunas originais).
 */
async function readAuxReport(filePath) {
  const empty = { bySpe: {}, byPlaca: {}, rawHeaders: [], speColumn: null, placaColumn: null, total: 0 };
  if (!fs.existsSync(filePath)) return empty;

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return empty;

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

  const rawHeaders = headers.filter(Boolean);
  const { speColumn, placaColumn } = detectKeyColumns(rawHeaders);

  const bySpe = {};
  const byPlaca = {};
  rows.forEach((row) => {
    const spe = speColumn ? String(row[speColumn] || '').trim() : '';
    const placa = placaColumn ? String(row[placaColumn] || '').trim() : '';
    if (spe) bySpe[spe] = row;
    if (placa) byPlaca[placa] = row;
  });

  return { bySpe, byPlaca, rawHeaders, speColumn, placaColumn, total: rows.length };
}

module.exports = { readAuxReport };
