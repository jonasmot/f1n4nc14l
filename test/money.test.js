import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCentsAsInput, formatMoney, parseMoneyToCents, sumCents } from '../src/domain/money.js';
import { DomainError } from '../src/domain/errors.js';

const brl = (cents) => formatMoney(cents).replace(/\u00A0/g, ' ');

test('parseMoneyToCents aceita inteiros, ponto e vírgula', () => {
  assert.equal(parseMoneyToCents('25'), 2500);
  assert.equal(parseMoneyToCents('25.90'), 2590);
  assert.equal(parseMoneyToCents('25,90'), 2590);
  assert.equal(parseMoneyToCents('1.234,56'), 123456);
  assert.equal(parseMoneyToCents('R$ 1.244,35'), 124435);
  assert.equal(parseMoneyToCents('0'), 0);
  assert.equal(parseMoneyToCents(25.9), 2590);
});

test('parseMoneyToCents rejeita valores inválidos e negativos', () => {
  for (const value of ['', 'abc', '-1', '1.234', '10,999', 'R$', null]) {
    assert.throws(() => parseMoneyToCents(value), DomainError);
  }
});

test('formatMoney formata em reais', () => {
  assert.equal(brl(124435), 'R$ 1.244,35');
  assert.equal(brl(0), 'R$ 0,00');
  assert.equal(brl(-13300), '-R$ 133,00');
});

test('formatCentsAsInput usa vírgula decimal', () => {
  assert.equal(formatCentsAsInput(2590), '25,90');
  assert.equal(formatCentsAsInput(123456), '1234,56');
});

test('sumCents soma inteiros', () => {
  assert.equal(sumCents([100, 250, 1]), 351);
});
