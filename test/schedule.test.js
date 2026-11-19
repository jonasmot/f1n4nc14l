import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contractEndMonth,
  contractRemainingCents,
  contractSchedule,
  hasInstallmentInMonth,
  installmentsForMonth,
  totalRemainingCents,
} from '../src/domain/schedule.js';

const plans = [
  {
    id: 1,
    description: 'Contrato 1',
    installmentCents: 4586,
    totalInstallments: 2,
    paidBeforeStart: 0,
    nextMonth: '2026-12',
    dueDay: null,
    active: true,
  },
  {
    id: 2,
    description: 'Contrato 2',
    installmentCents: 1422,
    totalInstallments: 5,
    paidBeforeStart: 1,
    nextMonth: '2026-12',
    dueDay: 10,
    active: true,
  },
  {
    id: 3,
    description: 'Contrato 3',
    installmentCents: 6460,
    totalInstallments: 20,
    paidBeforeStart: 5,
    nextMonth: '2026-12',
    dueDay: null,
    active: true,
  },
  {
    id: 4,
    description: 'Contrato 4',
    installmentCents: 1660,
    totalInstallments: 12,
    paidBeforeStart: 7,
    nextMonth: '2026-12',
    dueDay: null,
    active: true,
  },
  {
    id: 5,
    description: 'Contrato 5',
    installmentCents: 8961,
    totalInstallments: 1,
    paidBeforeStart: 0,
    nextMonth: '2026-12',
    dueDay: null,
    active: true,
  },
];

test('calcula saldo restante total', () => {
  assert.equal(totalRemainingCents(plans), 129021);
  assert.equal(contractRemainingCents(plans[0]), 9172);
  assert.equal(contractRemainingCents(plans[2]), 96900);
});

test('calcula mês de término', () => {
  assert.equal(contractEndMonth(plans[0]), '2027-01');
  assert.equal(contractEndMonth(plans[1]), '2027-03');
  assert.equal(contractEndMonth(plans[2]), '2028-02');
  assert.equal(contractEndMonth(plans[3]), '2027-04');
  assert.equal(contractEndMonth(plans[4]), '2026-12');
});

test('gera agenda de parcelas', () => {
  assert.deepEqual(contractSchedule(plans[0]), [
    { number: 1, month: '2026-12', dueDate: null },
    { number: 2, month: '2027-01', dueDate: null },
  ]);
  assert.deepEqual(contractSchedule(plans[1]).slice(0, 2), [
    { number: 2, month: '2026-12', dueDate: '2026-12-10' },
    { number: 3, month: '2027-01', dueDate: '2027-01-10' },
  ]);
});

test('identifica parcelas por mês', () => {
  assert.equal(hasInstallmentInMonth(plans[4], '2027-01'), false);
  assert.equal(hasInstallmentInMonth(plans[3], '2027-04'), true);
  assert.equal(installmentsForMonth(plans, '2026-12').length, 5);
  assert.equal(installmentsForMonth(plans, '2027-01').length, 4);
  assert.equal(installmentsForMonth(plans, '2027-05').length, 1);
});
