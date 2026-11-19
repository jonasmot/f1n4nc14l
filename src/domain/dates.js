import { DomainError } from './errors.js';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export const TIME_ZONE = 'America/Sao_Paulo';

export function isValidDateISO(value) {
  if (typeof value !== 'string') return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function assertDateISO(value, label = 'data') {
  if (!isValidDateISO(value)) {
    throw new DomainError(`Data inválida: "${value}". Use o formato AAAA-MM-DD.`, 'INVALID_DATE');
  }
  return value;
}

export function isValidMonth(value) {
  if (typeof value !== 'string') return false;
  const match = MONTH_PATTERN.exec(value);
  if (!match) return false;
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function assertMonth(value) {
  if (!isValidMonth(value)) {
    throw new DomainError(`Mês inválido: "${value}". Use o formato AAAA-MM.`, 'INVALID_MONTH');
  }
  return value;
}

export function todayISO(now = new Date()) {
  const override = process.env.FIN_TODAY;
  if (override) {
    assertDateISO(override, 'FIN_TODAY');
    return override;
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function currentMonth(now = new Date()) {
  return todayISO(now).slice(0, 7);
}

export function monthOf(dateISO) {
  assertDateISO(dateISO);
  return dateISO.slice(0, 7);
}

export function splitDate(dateISO) {
  assertDateISO(dateISO);
  const [year, month, day] = dateISO.split('-').map(Number);
  return { year, month, day };
}

export function splitMonth(month) {
  assertMonth(month);
  const [year, monthNumber] = month.split('-').map(Number);
  return { year, month: monthNumber };
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function lastDayOfMonth(month) {
  const { year, month: monthNumber } = splitMonth(month);
  return `${month}-${String(daysInMonth(year, monthNumber)).padStart(2, '0')}`;
}

export function addMonths(month, amount) {
  const { year, month: monthNumber } = splitMonth(month);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function diffMonths(fromMonth, toMonth) {
  const from = splitMonth(fromMonth);
  const to = splitMonth(toMonth);
  return (to.year - from.year) * 12 + (to.month - from.month);
}

export function addDays(dateISO, amount) {
  const { year, month, day } = splitDate(dateISO);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return date.toISOString().slice(0, 10);
}

export function diffDays(fromDate, toDate) {
  const from = splitDate(fromDate);
  const to = splitDate(toDate);
  const fromUtc = Date.UTC(from.year, from.month - 1, from.day);
  const toUtc = Date.UTC(to.year, to.month - 1, to.day);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function weekday(dateISO) {
  const { year, month, day } = splitDate(dateISO);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function isWeekend(dateISO) {
  const day = weekday(dateISO);
  return day === 0 || day === 6;
}

export function dateAtDay(month, day) {
  const { year, month: monthNumber } = splitMonth(month);
  const safeDay = Math.min(Math.max(1, day), daysInMonth(year, monthNumber));
  return `${month}-${String(safeDay).padStart(2, '0')}`;
}

export function compareMonths(a, b) {
  return a.localeCompare(b);
}

export function minMonth(a, b) {
  return compareMonths(a, b) <= 0 ? a : b;
}

export function maxMonth(a, b) {
  return compareMonths(a, b) >= 0 ? a : b;
}

export function formatDateBR(dateISO) {
  if (!dateISO) return 'a definir';
  assertDateISO(dateISO);
  const [year, month, day] = dateISO.split('-');
  return `${day}/${month}/${year}`;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const SHORT_MONTH_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
  year: '2-digit',
  timeZone: 'UTC',
});

export function formatMonthBR(month) {
  const { year, month: monthNumber } = splitMonth(month);
  return MONTH_FORMATTER.format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace(
    ' de ',
    '/',
  );
}

export function formatMonthShortBR(month) {
  const { year, month: monthNumber } = splitMonth(month);
  return SHORT_MONTH_FORMATTER.format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace('.', '');
}

export function weekRange(dateISO) {
  assertDateISO(dateISO);
  const day = weekday(dateISO);
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  const start = addDays(dateISO, offsetToMonday);
  const end = addDays(start, 6);
  return { start, end };
}

export function monthKeyFromDate(date) {
  const iso = todayISO(date);
  return iso.slice(0, 7);
}
