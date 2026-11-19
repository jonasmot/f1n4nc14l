import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountBalanceCents,
  benefitBalanceCents,
  buildMonthlySummary,
  categoryBreakdown,
  savingsEvolution,
  weeklySummary,
} from '../src/domain/summary.js';

const accounts = [
  { id: 1, name: 'conta-corrente', type: 'corrente', initialBalanceCents: 0 },
  { id: 2, name: 'carteira', type: 'carteira', initialBalanceCents: 0 },
  { id: 3, name: 'cofrinho', type: 'cofrinho', initialBalanceCents: 170000 },
  { id: 4, name: 'flash-va', type: 'beneficio', initialBalanceCents: 0 },
  { id: 5, name: 'flash-vt', type: 'beneficio', initialBalanceCents: 0 },
];

const categories = [
  { id: 1, name: 'Salário' },
  { id: 2, name: '13º' },
  { id: 3, name: 'Energia' },
  { id: 4, name: 'Internet' },
  { id: 5, name: 'Contratos' },
  { id: 6, name: 'Outros' },
  { id: 7, name: 'Mercado' },
  { id: 8, name: 'VA' },
  { id: 9, name: 'VT' },
];

const base = {
  month: '2026-12',
  date: '2026-12-10',
  dueDate: null,
  counterAccountId: null,
  status: 'pago',
  origin: 'manual',
  originId: null,
};

const transactions = [
  { ...base, id: 1, type: 'receita', amountCents: 170000, accountId: 1, categoryId: 1, description: 'Salário', status: 'recebido', date: '2026-12-07' },
  { ...base, id: 2, type: 'receita', amountCents: 110000, accountId: 1, categoryId: 2, description: '13º', status: 'recebido', date: '2026-12-18' },
  { ...base, id: 3, type: 'despesa', amountCents: 30000, accountId: 1, categoryId: 3, description: 'Energia' },
  { ...base, id: 4, type: 'despesa', amountCents: 13300, accountId: 1, categoryId: 4, description: 'Internet' },
  { ...base, id: 5, type: 'despesa', amountCents: 4586, accountId: 1, categoryId: 5, description: 'Contrato 1' },
  { ...base, id: 6, type: 'despesa', amountCents: 1422, accountId: 1, categoryId: 5, description: 'Contrato 2' },
  { ...base, id: 7, type: 'despesa', amountCents: 6460, accountId: 1, categoryId: 5, description: 'Contrato 3' },
  { ...base, id: 8, type: 'despesa', amountCents: 1660, accountId: 1, categoryId: 5, description: 'Contrato 4' },
  { ...base, id: 9, type: 'despesa', amountCents: 8961, accountId: 1, categoryId: 5, description: 'Contrato 5' },
  { ...base, id: 10, type: 'despesa', amountCents: 28000, accountId: 1, categoryId: 6, description: 'Autoescola', date: '2026-12-15' },
  { ...base, id: 11, type: 'receita', amountCents: 50000, accountId: 4, categoryId: 8, description: 'Crédito VA', status: 'recebido', date: '2026-12-01' },
  { ...base, id: 12, type: 'receita', amountCents: 20000, accountId: 5, categoryId: 9, description: 'Crédito VT', status: 'recebido', date: '2026-12-01' },
  { ...base, id: 13, type: 'despesa', amountCents: 5000, accountId: 4, categoryId: 7, description: 'Mercado', status: 'pago', date: '2026-12-09' },
  { ...base, id: 14, type: 'transferencia', amountCents: 80000, accountId: 1, counterAccountId: 3, description: 'Aporte', date: '2026-12-10' },
  { ...base, id: 15, type: 'receita', amountCents: 170000, accountId: 1, categoryId: 1, description: 'Salário', status: 'recebido', month: '2027-01', date: '2027-01-08' },
  { ...base, id: 16, type: 'despesa', amountCents: 30000, accountId: 1, categoryId: 3, description: 'Energia', month: '2027-01', date: '2027-01-20' },
];

test('calcula saldo de conta com transferências', () => {
  assert.equal(accountBalanceCents(accounts[0], transactions), 245611);
  assert.equal(accountBalanceCents(accounts[2], transactions), 250000);
  assert.equal(accountBalanceCents(accounts[3], transactions), 45000);
});

test('calcula saldo mensal de benefício', () => {
  assert.equal(benefitBalanceCents(accounts[3], transactions, '2026-12'), 45000);
  assert.equal(benefitBalanceCents(accounts[4], transactions, '2026-12'), 20000);
});

test('monta resumo mensal de dezembro', () => {
  const summary = buildMonthlySummary({
    month: '2026-12',
    transactions,
    accounts,
    categories,
    plannedContributionCents: 80000,
    contractRemainingCents: 129021,
  });

  assert.equal(summary.incomePlannedCents, 280000);
  assert.equal(summary.incomeRealizedCents, 280000);
  assert.equal(summary.expensePlannedCents, 94389);
  assert.equal(summary.expenseRealizedCents, 94389);
  assert.equal(summary.flowPlannedCents, 185611);
  assert.equal(summary.flowRealizedCents, 185611);
  assert.equal(summary.availableBeforeContributionCents, 185611);
  assert.equal(summary.availableAfterContributionCents, 105611);
  assert.equal(summary.cashBalanceCents, 105611);
  assert.equal(summary.savingsBalanceCents, 250000);
  assert.equal(summary.totalPatrimonyCents, 420611);
  assert.equal(summary.contractRemainingCents, 129021);
  assert.deepEqual(
    summary.benefits.map((benefit) => [benefit.name, benefit.balanceCents]),
    [
      ['flash-va', 45000],
      ['flash-vt', 20000],
    ],
  );
});

test('separa gastos por categoria e benefícios', () => {
  const cash = categoryBreakdown({
    month: '2026-12',
    transactions,
    accounts,
    categories,
    scope: 'cash',
  });
  assert.equal(cash.grandTotalCents, 94389);
  assert.deepEqual(
    cash.rows.map((row) => [row.name, row.totalCents]),
    [
      ['Energia', 30000],
      ['Outros', 28000],
      ['Contratos', 23089],
      ['Internet', 13300],
    ],
  );

  const benefits = categoryBreakdown({
    month: '2026-12',
    transactions,
    accounts,
    categories,
    scope: 'benefit',
  });
  assert.equal(benefits.grandTotalCents, 5000);
  assert.equal(benefits.rows[0].name, 'Mercado');
});

test('monta evolução mensal', () => {
  const evo = savingsEvolution({
    months: ['2026-12', '2027-01', '2027-02'],
    transactions,
    accounts,
    savingsAccountId: 3,
  });

  assert.deepEqual(
    evo.map((row) => [row.month, row.incomeCents, row.expenseCents, row.flowCents, row.savingsBalanceCents]),
    [
      ['2026-12', 280000, 94389, 185611, 250000],
      ['2027-01', 170000, 30000, 140000, 250000],
      ['2027-02', 0, 0, 0, 250000],
    ],
  );
});

test('monta resumo semanal com benefícios e pendências', () => {
  const weeklyTransactions = [
    { ...base, id: 1, type: 'receita', amountCents: 170000, accountId: 1, categoryId: 1, description: 'Salário', status: 'recebido', month: '2026-12', date: '2026-12-07' },
    { ...base, id: 2, type: 'despesa', amountCents: 5000, accountId: 1, categoryId: 7, description: 'Feira', date: '2026-12-09' },
    { ...base, id: 3, type: 'despesa', amountCents: 7000, accountId: 1, categoryId: 7, description: 'Fora da semana', date: '2026-12-14' },
    { ...base, id: 4, type: 'receita', amountCents: 10000, accountId: 4, categoryId: 8, description: 'Crédito VA', status: 'recebido', date: '2026-12-01' },
    { ...base, id: 5, type: 'despesa', amountCents: 3000, accountId: 4, categoryId: 7, description: 'Padaria', date: '2026-12-08' },
    { ...base, id: 6, type: 'despesa', amountCents: 12000, accountId: 1, categoryId: 4, description: 'Internet', status: 'previsto', dueDate: '2026-12-10' },
    { ...base, id: 7, type: 'despesa', amountCents: 9000, accountId: 1, categoryId: 3, description: 'Energia', status: 'previsto', dueDate: '2026-12-20' },
  ];

  const week = weeklySummary({
    referenceDate: '2026-12-07',
    transactions: weeklyTransactions,
    accounts,
    categories,
  });

  assert.deepEqual([week.start, week.end], ['2026-12-07', '2026-12-13']);
  assert.equal(week.expenseCents, 5000);
  assert.equal(week.benefitExpenseCents, 3000);
  assert.equal(week.upcoming.length, 1);
  assert.equal(week.upcoming[0].description, 'Internet');
  assert.equal(week.availableAfterContributionCents, 137000);
  assert.deepEqual(
    week.benefits.map((benefit) => [benefit.name, benefit.balanceCents]),
    [
      ['flash-va', 7000],
      ['flash-vt', 0],
    ],
  );
});
