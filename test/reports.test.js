import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/infrastructure/db.js';
import { migrate } from '../src/infrastructure/migrator.js';
import { seedDatabase } from '../src/infrastructure/seed.js';
import { openMonth } from '../src/application/planning.js';
import { quickExpense, addExpense } from '../src/application/transactions.js';
import { transfer } from '../src/application/accounts.js';
import {
  categoryReport,
  evolutionReport,
  monthlyReport,
  weekReport,
} from '../src/application/reports.js';
import { DomainError } from '../src/domain/errors.js';

function memoryDatabase() {
  const db = openDatabase({ path: ':memory:' });
  migrate(db);
  seedDatabase(db);
  return db;
}

test('resumo mensal de dezembro e janeiro', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    openMonth(db, { month: '2027-01' });

    const december = monthlyReport(db, { month: '2026-12' });
    assert.equal(december.incomePlannedCents, 280000);
    assert.equal(december.expensePlannedCents, 94389);
    assert.equal(december.flowPlannedCents, 185611);
    assert.equal(december.plannedContributionCents, 85000);
    assert.equal(december.availableAfterContributionCents, 100611);
    assert.equal(december.savingsBalanceCents, 150000);
    assert.equal(december.contractRemainingCents, 129021);
    assert.deepEqual(
      december.benefits.map((benefit) => [benefit.name, benefit.balanceCents]),
      [
        ['flash-va', 50000],
        ['flash-vt', 20000],
      ],
    );

    const january = monthlyReport(db, { month: '2027-01' });
    assert.equal(january.incomePlannedCents, 170000);
    assert.equal(january.expensePlannedCents, 57428);
    assert.equal(january.flowPlannedCents, 112572);
    assert.equal(january.availableAfterContributionCents, 27572);
    assert.equal(january.cashBalanceCents, 0);
  } finally {
    db.close();
  }
});

test('resumo separa realizado do previsto', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const salary = db
      .prepare("SELECT id FROM transactions WHERE description = 'Salário' AND month = '2026-12'")
      .get();
    db.prepare("UPDATE transactions SET status = 'recebido', paid_at = '2026-12-07' WHERE id = ?").run(
      salary.id,
    );

    const report = monthlyReport(db, { month: '2026-12' });
    assert.equal(report.incomePlannedCents, 280000);
    assert.equal(report.incomeRealizedCents, 170000);
    assert.equal(report.expenseRealizedCents, 0);
    assert.equal(report.flowRealizedCents, 170000);
    assert.equal(report.flowPlannedCents, 185611);
  } finally {
    db.close();
  }
});

test('categorias separam caixa e benefícios', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    quickExpense(db, {
      amountCents: 5000,
      category: 'mercado',
      description: 'Feira',
      account: 'flash-va',
      date: '2026-12-09',
    });
    quickExpense(db, {
      amountCents: 1500,
      category: 'lazer',
      description: 'Cinema',
      date: '2026-12-12',
    });

    const report = categoryReport(db, { month: '2026-12' });
    assert.equal(report.cash.grandTotalCents, 95889);
    assert.deepEqual(
      report.cash.rows.map((row) => [row.name, row.totalCents]),
      [
        ['Energia', 30000],
        ['Outros', 28000],
        ['Contratos', 23089],
        ['Internet', 13300],
        ['Lazer', 1500],
      ],
    );
    assert.equal(report.cash.rows[0].percentage.toFixed(1), '31.3');

    assert.equal(report.benefits.grandTotalCents, 5000);
    assert.equal(report.benefits.rows[0].name, 'Mercado');
    assert.equal(report.benefits.rows[0].percentage, 100);
  } finally {
    db.close();
  }
});

test('evolução mostra três meses com saldo do cofrinho', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const salary = db
      .prepare("SELECT id FROM transactions WHERE description = 'Salário' AND month = '2026-12'")
      .get();
    db.prepare("UPDATE transactions SET status = 'recebido', paid_at = '2026-12-07' WHERE id = ?").run(
      salary.id,
    );
    transfer(db, { amountCents: 80000, from: 'conta-corrente', to: 'cofrinho', date: '2026-12-10' });

    const evolution = evolutionReport(db, { month: '2026-12', months: 3 });
    assert.deepEqual(
      evolution.map((row) => [row.month, row.incomeCents, row.savingsBalanceCents]),
      [
        ['2026-10', 0, 150000],
        ['2026-11', 0, 150000],
        ['2026-12', 170000, 230000],
      ],
    );
  } finally {
    db.close();
  }
});

test('evolução rejeita quantidade inválida', () => {
  const db = memoryDatabase();
  try {
    assert.throws(() => evolutionReport(db, { months: 0 }), DomainError);
  } finally {
    db.close();
  }
});

test('resumo semanal com gastos, pendências e benefícios', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    quickExpense(db, {
      amountCents: 2590,
      category: 'mercado',
      description: 'Feira',
      date: '2026-12-09',
    });
    quickExpense(db, {
      amountCents: 2000,
      category: 'refeicoes',
      description: 'Padaria',
      account: 'flash-va',
      date: '2026-12-08',
    });

    const week = weekReport(db, { today: '2026-12-07' });
    assert.deepEqual([week.start, week.end], ['2026-12-07', '2026-12-13']);
    assert.equal(week.expenseCents, 2590);
    assert.equal(week.benefitExpenseCents, 2000);
    assert.equal(week.upcoming[0].description, 'Salário');
    assert.equal(week.upcoming[0].effectiveDate, '2026-12-07');
    assert.equal(week.upcoming.length, 2);
    assert.equal(week.upcoming[1].description, 'Contrato 2 (2/5)');
    assert.equal(week.upcoming[1].effectiveDate, '2026-12-10');
    assert.equal(week.availableAfterContributionCents, 98021);

    const afterReceipt = db
      .prepare("SELECT status FROM transactions WHERE description = 'Crédito VA'")
      .get();
    assert.equal(afterReceipt.status, 'recebido');
  } finally {
    db.close();
  }
});

test('resumo semanal sem gastos', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const week = weekReport(db, { today: '2026-12-14' });
    assert.equal(week.expenseCents, 0);
    assert.equal(week.expenses.length, 0);
    assert.equal(week.benefitExpenseCents, 0);
  } finally {
    db.close();
  }
});

test('resumo mensal considera despesa paga com valor ajustado', () => {
  const db = memoryDatabase();
  try {
    const energy = addExpense(db, {
      amountCents: 30000,
      category: 'energia',
      description: 'Energia',
      date: '2026-12-02',
    });
    db.prepare("UPDATE transactions SET status = 'pago', paid_at = '2026-12-20', amount_cents = 31245 WHERE id = ?").run(
      energy.id,
    );

    const report = monthlyReport(db, { month: '2026-12' });
    assert.equal(report.expensePlannedCents, 31245);
    assert.equal(report.expenseRealizedCents, 31245);
    assert.equal(report.flowPlannedCents, -31245);
  } finally {
    db.close();
  }
});
