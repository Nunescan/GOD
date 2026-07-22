const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// Modelo unico de "Controle de Pagamento CT-e", sintetizado a partir das 4
// planilhas reais que ja existiam (uma por armador: Aliança, Login, Mercosul,
// Norcoast) - cada uma tinha ~30 colunas parecidas, com pequenas variacoes de
// nome. Como o modelo agora e escrito por nos, a leitura casa por nome exato
// de coluna (sem precisar adivinhar/detectar por palavra-chave).
const TEMPLATE_HEADERS = [
  'Armador', 'Mês/Data Lançamento', 'CTE', 'Nota Fiscal', 'Validação NF',
  'Container', 'Validação Container', 'Tomador', 'CNPJ Seara', 'Origem', 'Destino',
  'Filial', 'Unidade', 'Valor Frete Líquido', 'Valor Frete Bruto', 'Valor Mercadoria',
  'Alíquota Ad-Valorem', 'Ad-Valorem', 'Ad-Valorem + Imposto', 'ICMS',
  'Frete + Imposto', 'Valor BAF', 'BAF s/ Imposto', 'BAF c/ Imposto',
  'Taxa Seca / Tx Infraestrutura', 'Frete Total (Valor CTE)', 'Diferença (Validação)',
  'Observação',
];

const NUMERIC_FIELDS = new Set([
  'Valor Frete Líquido', 'Valor Frete Bruto', 'Valor Mercadoria', 'Alíquota Ad-Valorem',
  'Ad-Valorem', 'Ad-Valorem + Imposto', 'ICMS', 'Frete + Imposto', 'Valor BAF',
  'BAF s/ Imposto', 'BAF c/ Imposto', 'Taxa Seca / Tx Infraestrutura',
  'Frete Total (Valor CTE)', 'Diferença (Validação)',
]);

const ARMADORES = ['Aliança', 'Login', 'Mercosul', 'Norcoast'];

function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    return v.toLocaleDateString('pt-BR');
  }
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return v.text;
  }
  return v;
}

function toNumber(value) {
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Gera o modelo "bonito" (cabeçalho estilizado, largura de coluna, painel
 * congelado) pronto pra você preencher com os CT-e do período.
 */
async function gerarModelo(outputPath) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Pagamentos CT-e');

  sheet.addRow(TEMPLATE_HEADERS);
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2030' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 32;

  sheet.columns.forEach((col, idx) => {
    const header = TEMPLATE_HEADERS[idx];
    col.width = header && header.length > 18 ? 22 : 16;
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + TEMPLATE_HEADERS.length)}1` };

  // aba de ajuda com os valores esperados pra "Armador"
  const ajuda = workbook.addWorksheet('Ajuda');
  ajuda.addRow(['Preencha "Armador" com um destes valores:']);
  ARMADORES.forEach((a) => ajuda.addRow([a]));
  ajuda.getColumn(1).width = 30;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

async function readRows(filePath) {
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
    if (Object.values(obj).some((v) => String(v).trim() !== '')) rows.push(obj);
  });

  return rows;
}

/**
 * Le a planilha preenchida e monta os dados do dashboard: totais gerais,
 * por armador, por filial, e a lista de CT-e com diferença de validação
 * (precisam de atenção antes de pagar).
 */
async function montarDashboard(filePath) {
  if (!fs.existsSync(filePath)) return { ok: false, error: 'Arquivo não encontrado' };

  const rows = await readRows(filePath);
  if (rows.length === 0) return { ok: false, error: 'Planilha vazia ou sem dados' };

  const somar = (campo) => rows.reduce((acc, r) => acc + toNumber(r[campo]), 0);

  const porArmador = new Map();
  const porFilial = new Map();
  rows.forEach((r) => {
    const armador = String(r['Armador'] || 'Sem armador').trim() || 'Sem armador';
    const filial = String(r['Filial'] || 'Sem filial').trim() || 'Sem filial';
    porArmador.set(armador, (porArmador.get(armador) || 0) + 1);
    porFilial.set(filial, (porFilial.get(filial) || 0) + 1);
  });

  const comDiferenca = rows.filter((r) => Math.abs(toNumber(r['Diferença (Validação)'])) > 0.01);

  return {
    ok: true,
    totalCtes: rows.length,
    valorFreteTotal: somar('Valor Frete Líquido') || somar('Valor Frete Bruto'),
    valorMercadoriaTotal: somar('Valor Mercadoria'),
    adValoremTotal: somar('Ad-Valorem'),
    bafTotal: somar('Valor BAF'),
    freteTotalGeral: somar('Frete Total (Valor CTE)'),
    porArmador: [...porArmador.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    porFilial: [...porFilial.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })),
    comDiferenca: comDiferenca.map((r) => ({
      cte: r['CTE'],
      armador: r['Armador'],
      tomador: r['Tomador'],
      diferenca: toNumber(r['Diferença (Validação)']),
    })),
    totalComDiferenca: comDiferenca.length,
  };
}

module.exports = { TEMPLATE_HEADERS, NUMERIC_FIELDS, ARMADORES, gerarModelo, readRows, montarDashboard };
