import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  addMonths,
  currentMonth,
  dateAtDay,
  diffDays,
  diffMonths,
  formatDateBR,
  formatMonthBR,
  isValidDateISO,
  isValidMonth,
  lastDayOfMonth,
  todayISO,
  weekRange,
} from '../src/domain/dates.js';
import { DomainError } from '../src/domain/errors.js';

test('valida datas e meses', () => {
  assert.equal(isValidDateISO('2026-12-07'), true);
  assert.equal(isValidDateISO('2026-02-29'), false);
  assert.equal(isValidDateISO('2028-02-29'), true);
  assert.equal(isValidDateISO('2026-13-01'), false);
  assert.equal(isValidMonth('2026-12'), true);
  assert.equal(isValidMonth('2026-13'), false);
  assert.throws(() => lastDayOfMonth('2026-13'), DomainError);
});

test('calcula último dia e somas de meses', () => {
  assert.equal(lastDayOfMonth('2026-02'), '2026-02-28');
  assert.equal(lastDayOfMonth('2028-02'), '2028-02-29');
  assert.equal(lastDayOfMonth('2026-12'), '2026-12-31');
  assert.equal(addMonths('2026-12', 2), '2027-02');
  assert.equal(addMonths('2027-01', -1), '2026-12');
  assert.equal(addMonths('2027-12', 1), '2028-01');
  assert.equal(diffMonths('2026-12', '2028-03'), 15);
});

test('soma dias e calcula diferença', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(diffDays('2026-12-01', '2026-12-31'), 30);
});

test('limita o dia ao último do mês', () => {
  assert.equal(dateAtDay('2026-02', 31), '2026-02-28');
  assert.equal(dateAtDay('2026-12', 10), '2026-12-10');
});

test('formata data e mês em pt-BR', () => {
  assert.equal(formatDateBR('2026-12-07'), '07/12/2026');
  assert.equal(formatDateBR(null), 'a definir');
  assert.match(formatMonthBR('2026-12'), /dezembro/);
  assert.match(formatMonthBR('2026-12'), /2026/);
});

test('usa o fuso de São Paulo para hoje', () => {
  assert.equal(todayISO(new Date('2026-11-18T12:00:00Z')), '2026-11-18');
  assert.equal(todayISO(new Date('2026-11-19T02:00:00Z')), '2026-11-18');
  assert.equal(currentMonth(new Date('2026-11-19T02:00:00Z')), '2026-11');
});

test('calcula a semana de segunda a domingo', () => {
  assert.deepEqual(weekRange('2026-12-07'), { start: '2026-12-07', end: '2026-12-13' });
  assert.deepEqual(weekRange('2026-12-13'), { start: '2026-12-07', end: '2026-12-13' });
  assert.deepEqual(weekRange('2026-12-14'), { start: '2026-12-14', end: '2026-12-20' });
});
