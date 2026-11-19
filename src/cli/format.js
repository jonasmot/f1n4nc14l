import { formatDateBR, formatMonthBR } from '../domain/dates.js';
import { formatMoney } from '../domain/money.js';

export function normalizeText(text) {
  return String(text ?? '').replace(/\u00A0/g, ' ');
}

export function money(cents) {
  return normalizeText(formatMoney(cents));
}

export function signedMoney(type, cents) {
  if (type === 'despesa' || type === 'transferencia') {
    return money(-cents);
  }
  return money(cents);
}

export function percent(value) {
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export function date(dateISO) {
  return formatDateBR(dateISO);
}

export function month(monthKey) {
  return formatMonthBR(monthKey);
}

export function benefitLabel(name) {
  if (name === 'flash-va') return 'VA';
  if (name === 'flash-vt') return 'VT';
  return name;
}

export function renderTable(headers, rows, align = []) {
  const table = [headers.map((header) => String(header ?? '')), ...rows.map((row) =>
    row.map((cell) => String(cell ?? '')),
  )];
  const widths = headers.map((_, index) =>
    Math.max(...table.map((row) => (row[index] ?? '').length)),
  );

  const formatRow = (row) =>
    row
      .map((cell, index) => {
        const text = String(cell ?? '');
        return align[index] === 'right' ? text.padStart(widths[index]) : text.padEnd(widths[index]);
      })
      .join('  ')
      .trimEnd();

  const separator = widths.map((width) => '-'.repeat(width)).join('  ');
  return [formatRow(table[0]), separator, ...table.slice(1).map(formatRow)].join('\n');}

export function labelValue(label, value, width = 24) {
  return `${String(label).padEnd(width)} ${value}`;
}
