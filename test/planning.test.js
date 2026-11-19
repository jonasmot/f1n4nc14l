import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/infrastructure/db.js';
import { migrate } from '../src/infrastructure/migrator.js';
import { seedDatabase } from '../src/infrastructure/seed.js';
import { listTransactions } from '../src/infrastructure/repositories/transactions.js';
import { getAccount } from '../src/infrastructure/repositories/accounts.js';
import { buildMonthlySummary, collectMonthlyTotals } from '../src/domain/summary.js';
import { listAccounts } from '../src/infrastructure/repositories/accounts.js';
import { getActiveGoal } from '../src/infrastructure/repositories/goals.js';
import { forecastMonth, openMonth } from '../src/application/planning.js';
import { transfer } from '../src/application/accounts.js';

function memoryDatabase() {
  const db = openDatabase({ path: ':memory:' });
  migrate(db);
  seedDatabase(db);
  return db;
}

function monthSummary(db, month) {
  const accounts = listAccounts(db);
  const transactions = listTransactions(db);
  const goal = getActiveGoal(db);
  return buildMonthlySummary({
    month,
    transactions,
    accounts,
    plannedContributionCents: goal.monthlyContributionCents,
  });
}

test('abre dezembro de 2026 com 12 previstos', () => {
  const db = memoryDatabase();
  try {
    const result = openMonth(db, { month: '2026-12' });
    assert.equal(result.created, 12);
    assert.equal(result.total, 12);
    assert.equal(result.expected, 12);

    const transactions = listTransactions(db, { month: '2026-12' });
    const byDescription = Object.fromEntries(
      transactions.map((transaction) => [transaction.description, transaction]),
    );

    assert.equal(byDescription['Salário'].date, '2026-12-07');
    assert.equal(byDescription['Salário'].status, 'previsto');
    assert.equal(byDescription['13º salário'].date, '2026-12-18');
    assert.equal(byDescription['Crédito VA'].date, '2026-12-01');
    assert.equal(byDescription['Crédito VA'].status, 'recebido');
    assert.equal(byDescription['Crédito VT'].amountCents, 20000);
    assert.equal(byDescription['Energia elétrica'].dueDate, null);
    assert.equal(byDescription['Contrato 1 (1/2)'].amountCents, 4586);
    assert.equal(byDescription['Contrato 5 (1/1)'].amountCents, 8961);
    assert.equal(byDescription.Autoescola.amountCents, 28000);

    const contractsTotal = transactions
      .filter((transaction) => transaction.origin === 'contrato')
      .reduce((total, transaction) => total + transaction.amountCents, 0);
    assert.equal(contractsTotal, 23089);

    const summary = monthSummary(db, '2026-12');
    assert.equal(summary.incomePlannedCents, 280000);
    assert.equal(summary.expensePlannedCents, 94389);
    assert.equal(summary.flowPlannedCents, 185611);
    assert.equal(summary.availableAfterContributionCents, 100611);
  } finally {
    db.close();
  }
});

test('reabrir dezembro não duplica', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const result = openMonth(db, { month: '2026-12' });
    assert.equal(result.created, 0);
    assert.equal(result.total, 12);
    assert.equal(result.alreadyOpen, true);
  } finally {
    db.close();
  }
});

test('abre janeiro de 2027 com 9 previstos e sem contrato 5', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const result = openMonth(db, { month: '2027-01' });
    assert.equal(result.created, 9);
    assert.equal(result.total, 9);

    const transactions = listTransactions(db, { month: '2027-01' });
    const descriptions = transactions.map((transaction) => transaction.description);
    assert.equal(descriptions.includes('Autoescola'), false);
    assert.equal(descriptions.includes('13º salário'), false);
    assert.equal(descriptions.filter((description) => description.startsWith('Contrato')).length, 4);
    assert.equal(transactions.find((transaction) => transaction.description === 'Salário').date, '2027-01-08');

    const contractsTotal = transactions
      .filter((transaction) => transaction.origin === 'contrato')
      .reduce((total, transaction) => total + transaction.amountCents, 0);
    assert.equal(contractsTotal, 14128);

    const summary = monthSummary(db, '2027-01');
    assert.equal(summary.incomePlannedCents, 170000);
    assert.equal(summary.expensePlannedCents, 57428);
    assert.equal(summary.flowPlannedCents, 112572);
    assert.equal(summary.availableAfterContributionCents, 27572);
  } finally {
    db.close();
  }
});

test('previsão de janeiro não grava e mostra os números do plano', () => {
  const db = memoryDatabase();
  try {
    assert.equal(listTransactions(db).length, 0);

    const forecast = forecastMonth(db, { month: '2027-01', today: '2026-11-18' });
    assert.equal(forecast.incomePlannedCents, 170000);
    assert.equal(forecast.fixedExpensePlannedCents, 43300);
    assert.equal(forecast.contractExpensePlannedCents, 14128);
    assert.equal(forecast.otherExpensePlannedCents, 0);
    assert.equal(forecast.expensePlannedCents, 57428);
    assert.equal(forecast.flowPlannedCents, 112572);
    assert.equal(forecast.plannedContributionCents, 85000);
    assert.equal(forecast.availableAfterContributionCents, 27572);
    assert.equal(forecast.projectedBalanceCents, 128183);
    assert.equal(forecast.projectedSavingsCents, 320000);
    assert.equal(forecast.isFuture, true);
    assert.equal(listTransactions(db).length, 0);
  } finally {
    db.close();
  }
});

test('previsão de dezembro e fevereiro', () => {
  const db = memoryDatabase();
  try {
    const december = forecastMonth(db, { month: '2026-12', today: '2026-11-18' });
    assert.equal(december.incomePlannedCents, 280000);
    assert.equal(december.fixedExpensePlannedCents, 43300);
    assert.equal(december.contractExpensePlannedCents, 23089);
    assert.equal(december.otherExpensePlannedCents, 28000);
    assert.equal(december.expensePlannedCents, 94389);
    assert.equal(december.availableAfterContributionCents, 100611);
    assert.equal(december.projectedBalanceCents, 100611);
    assert.equal(december.projectedSavingsCents, 235000);

    const february = forecastMonth(db, { month: '2027-02', today: '2026-11-18' });
    assert.equal(february.incomePlannedCents, 170000);
    assert.equal(february.expensePlannedCents, 52842);
    assert.equal(february.availableAfterContributionCents, 32158);
    assert.equal(february.projectedBalanceCents, 160341);
    assert.equal(february.projectedSavingsCents, 405000);
  } finally {
    db.close();
  }
});

test('previsão usa o saldo real quando o mês corrente já tem dados', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const forecast = forecastMonth(db, { month: '2027-01', today: '2026-11-18' });
    assert.equal(forecast.projectedBalanceCents, 128183);

    const afterTransfer = forecastMonth(db, { month: '2027-01', today: '2026-11-18' });
    assert.equal(afterTransfer.projectedBalanceCents, 128183);
  } finally {
    db.close();
  }
});

test('aporte planejado não vira transferência automática', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const before = getAccount(db, 3);
    assert.equal(before.initialBalanceCents, 150000);

    const summaryBefore = monthSummary(db, '2026-12');
    assert.equal(summaryBefore.savingsBalanceCents, 150000);
    assert.equal(summaryBefore.plannedContributionCents, 85000);

    transfer(db, { amountCents: 50000, from: 'conta-corrente', to: 'cofrinho', date: '2026-12-10' });
    const summaryAfter = monthSummary(db, '2026-12');
    assert.equal(summaryAfter.savingsBalanceCents, 200000);
    assert.equal(summaryAfter.plannedContributionCents, 85000);
  } finally {
    db.close();
  }
});

test('abertura preserva lançamentos manuais', () => {
  const db = memoryDatabase();
  try {
    const accounts = listAccounts(db);
    const transactions = listTransactions(db);
    assert.equal(collectMonthlyTotals(transactions, new Map(accounts.map((a) => [a.id, a])), '2026-12').incomePlannedCents, 0);
  } finally {
    db.close();
  }
});
