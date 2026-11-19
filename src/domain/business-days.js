import { daysInMonth, dateAtDay, isWeekend, splitMonth } from './dates.js';
import { DomainError } from './errors.js';

export const NATIONAL_HOLIDAYS = [
  { date: '2026-01-01', name: 'Confraternização Universal' },
  { date: '2026-04-03', name: 'Sexta-feira Santa' },
  { date: '2026-04-21', name: 'Tiradentes' },
  { date: '2026-05-01', name: 'Dia do Trabalho' },
  { date: '2026-09-07', name: 'Independência do Brasil' },
  { date: '2026-10-12', name: 'Nossa Senhora Aparecida' },
  { date: '2026-11-02', name: 'Finados' },
  { date: '2026-11-15', name: 'Proclamação da República' },
  { date: '2026-11-20', name: 'Consciência Negra' },
  { date: '2026-12-25', name: 'Natal' },
  { date: '2027-01-01', name: 'Confraternização Universal' },
  { date: '2027-03-26', name: 'Sexta-feira Santa' },
  { date: '2027-04-21', name: 'Tiradentes' },
  { date: '2027-05-01', name: 'Dia do Trabalho' },
  { date: '2027-09-07', name: 'Independência do Brasil' },
  { date: '2027-10-12', name: 'Nossa Senhora Aparecida' },
  { date: '2027-11-02', name: 'Finados' },
  { date: '2027-11-15', name: 'Proclamação da República' },
  { date: '2027-11-20', name: 'Consciência Negra' },
  { date: '2027-12-25', name: 'Natal' },
  { date: '2028-01-01', name: 'Confraternização Universal' },
  { date: '2028-04-14', name: 'Sexta-feira Santa' },
  { date: '2028-04-21', name: 'Tiradentes' },
  { date: '2028-05-01', name: 'Dia do Trabalho' },
  { date: '2028-09-07', name: 'Independência do Brasil' },
  { date: '2028-10-12', name: 'Nossa Senhora Aparecida' },
  { date: '2028-11-02', name: 'Finados' },
  { date: '2028-11-15', name: 'Proclamação da República' },
  { date: '2028-11-20', name: 'Consciência Negra' },
  { date: '2028-12-25', name: 'Natal' },
];

export function holidaySet(holidays = NATIONAL_HOLIDAYS) {
  return new Set(holidays.map((holiday) => (typeof holiday === 'string' ? holiday : holiday.date)));
}

export function isBusinessDay(dateISO, holidays = holidaySet()) {
  return !isWeekend(dateISO) && !holidays.has(dateISO);
}

export function nthBusinessDay(month, n, holidays = holidaySet()) {
  if (!Number.isInteger(n) || n < 1) {
    throw new DomainError('O número do dia útil deve ser inteiro e maior que zero.', 'INVALID_BUSINESS_DAY');
  }

  const { year, month: monthNumber } = splitMonth(month);
  const totalDays = daysInMonth(year, monthNumber);
  let count = 0;

  for (let day = 1; day <= totalDays; day += 1) {
    const date = dateAtDay(month, day);
    if (isBusinessDay(date, holidays)) {
      count += 1;
      if (count === n) return date;
    }
  }

  return null;
}

export function businessDaysInMonth(month, holidays = holidaySet()) {
  const { year, month: monthNumber } = splitMonth(month);
  const totalDays = daysInMonth(year, monthNumber);
  const dates = [];

  for (let day = 1; day <= totalDays; day += 1) {
    const date = dateAtDay(month, day);
    if (isBusinessDay(date, holidays)) dates.push(date);
  }

  return dates;
}
