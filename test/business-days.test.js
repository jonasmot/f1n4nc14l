import test from 'node:test';
import assert from 'node:assert/strict';
import {
  businessDaysInMonth,
  holidaySet,
  isBusinessDay,
  nthBusinessDay,
} from '../src/domain/business-days.js';

test('calcula o quinto dia útil com feriados nacionais', () => {
  assert.equal(nthBusinessDay('2026-12', 5), '2026-12-07');
  assert.equal(nthBusinessDay('2027-01', 5), '2027-01-08');
  assert.equal(nthBusinessDay('2027-02', 5), '2027-02-05');
  assert.equal(nthBusinessDay('2027-03', 5), '2027-03-05');
});

test('considera feriado cadastrado', () => {
  const holidays = holidaySet([...holidaySet(), '2026-12-07']);
  assert.equal(nthBusinessDay('2026-12', 5, holidays), '2026-12-08');
});

test('identifica dia útil', () => {
  assert.equal(isBusinessDay('2026-12-07'), true);
  assert.equal(isBusinessDay('2026-12-06'), false);
  assert.equal(isBusinessDay('2026-12-25'), false);
});

test('conta dias úteis do mês', () => {
  const days = businessDaysInMonth('2026-12');
  assert.equal(days.length, 22);
  assert.equal(days[0], '2026-12-01');
  assert.equal(days.at(-1), '2026-12-31');
});
