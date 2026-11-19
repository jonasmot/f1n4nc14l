import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/infrastructure/db.js';
import { migrate } from '../src/infrastructure/migrator.js';
import { seedDatabase } from '../src/infrastructure/seed.js';
import { listTransactions } from '../src/infrastructure/repositories/transactions.js';
import { goalProjection, goalProgress, motorcycleSimulation } from '../src/application/goals.js';
import { transfer } from '../src/application/accounts.js';
import { openMonth } from '../src/application/planning.js';

function memoryDatabase() {
  const db = openDatabase({ path: ':memory:' });
  migrate(db);
  seedDatabase(db);
  return db;
}

test('progresso inicial da meta', () => {
  const db = memoryDatabase();
  try {
    const progress = goalProgress(db, { today: '2026-11-18' });
    assert.equal(progress.targetCents, 488000);
    assert.equal(progress.balanceCents, 150000);
    assert.equal(progress.remainingCents, 338000);
    assert.equal(progress.percentage.toFixed(1), '30.7');
    assert.equal(progress.achieved, false);
    assert.equal(progress.monthlyContributionCents, 85000);
    assert.equal(progress.monthsUntilTarget, 4);
    assert.equal(progress.monthsToReach, 4);
    assert.equal(progress.projectedMonth, '2027-03');
    assert.equal(progress.behindSchedule, false);
    assert.equal(progress.contributionsCents, 0);
    assert.equal(progress.withdrawalsCents, 0);
  } finally {
    db.close();
  }
});

test('aportes e retiradas mudam o progresso', () => {
  const db = memoryDatabase();
  try {
    transfer(db, { amountCents: 80000, from: 'conta-corrente', to: 'cofrinho', date: '2026-12-10' });
    let progress = goalProgress(db, { today: '2026-11-18' });
    assert.equal(progress.balanceCents, 230000);
    assert.equal(progress.remainingCents, 258000);
    assert.equal(progress.percentage.toFixed(1), '47.1');
    assert.equal(progress.monthsToReach, 4);
    assert.equal(progress.projectedMonth, '2027-03');
    assert.equal(progress.contributionsCents, 80000);

    transfer(db, { amountCents: 10000, from: 'cofrinho', to: 'conta-corrente', date: '2026-12-12' });
    progress = goalProgress(db, { today: '2026-11-18' });
    assert.equal(progress.balanceCents, 220000);
    assert.equal(progress.withdrawalsCents, 10000);
    assert.equal(progress.netContributionsCents, 70000);
  } finally {
    db.close();
  }
});

test('meta atingida', () => {
  const db = memoryDatabase();
  try {
    transfer(db, { amountCents: 338000, from: 'conta-corrente', to: 'cofrinho', date: '2026-12-10' });
    const progress = goalProgress(db, { today: '2026-11-18' });
    assert.equal(progress.balanceCents, 488000);
    assert.equal(progress.remainingCents, 0);
    assert.equal(progress.achieved, true);
    assert.equal(progress.monthsToReach, 0);
  } finally {
    db.close();
  }
});

test('simula a moto sem gravar dados', () => {
  const db = memoryDatabase();
  try {
    const before = listTransactions(db).length;
    const simulation = motorcycleSimulation(db, {}, { today: '2026-11-18' });

    assert.equal(simulation.startMonth, '2026-12');
    assert.equal(simulation.purchaseMonth, '2027-03');
    assert.equal(simulation.monthsUntilPurchase, 4);
    assert.equal(simulation.projectedSavingsCents, 490000);
    assert.equal(simulation.cnhCents, 10000);
    assert.equal(simulation.entryCents, 350000);
    assert.equal(simulation.installmentCents, 78000);
    assert.equal(simulation.helmetCents, 50000);
    assert.equal(simulation.purchaseOutlayCents, 488000);
    assert.equal(simulation.remainingSavingsCents, 2000);
    assert.equal(simulation.contractsCents, 9542);
    assert.equal(simulation.monthlyFlowCents, 39158);
    assert.equal(simulation.flowWithContributionCents, -45842);
    assert.equal(simulation.lastContractMonth, '2028-02');
    assert.equal(simulation.lastInstallmentMonth, '2031-02');
    assert.equal(simulation.totalFinancedCents, 3744000);
    assert.equal(simulation.totalPurchaseCents, 4094000);

    assert.equal(listTransactions(db).length, before);
  } finally {
    db.close();
  }
});

test('projeta a meta mês a mês sem gravar dados', () => {
  const db = memoryDatabase();
  try {
    const before = listTransactions(db).length;
    const projection = goalProjection(db, { today: '2026-11-18' });

    assert.equal(projection.targetMonth, '2027-03');
    assert.equal(projection.goal.targetCents, 488000);
    assert.equal(projection.months.length, 4);
    assert.deepEqual(
      projection.months.map((row) => [
        row.month,
        row.incomeCents,
        row.fixedExpenseCents,
        row.contractExpenseCents,
        row.otherExpenseCents,
        row.availableCents,
        row.contributionCents,
        row.remainderCents,
        row.savingsBalanceCents,
      ]),
      [
        ['2026-12', 280000, 43300, 23089, 28000, 185611, 85000, 100611, 235000],
        ['2027-01', 170000, 43300, 14128, 0, 112572, 85000, 27572, 320000],
        ['2027-02', 170000, 43300, 9542, 0, 117158, 85000, 32158, 405000],
        ['2027-03', 170000, 43300, 9542, 0, 117158, 85000, 32158, 490000],
      ],
    );

    assert.equal(projection.totalIncomeCents, 790000);
    assert.equal(projection.totalFixedExpenseCents, 173200);
    assert.equal(projection.totalContractExpenseCents, 56301);
    assert.equal(projection.totalOtherExpenseCents, 28000);
    assert.equal(projection.totalAvailableCents, 532499);
    assert.equal(projection.totalContributionCents, 340000);
    assert.equal(projection.projectedSavingsCents, 490000);
    assert.equal(projection.remainingAfterTargetCents, 2000);
    assert.equal(listTransactions(db).length, before);
  } finally {
    db.close();
  }
});

test('projeção considera aporte já registrado no mês corrente', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    transfer(db, {
      amountCents: 30000,
      from: 'conta-corrente',
      to: 'cofrinho',
      date: '2026-12-10',
    });

    const projection = goalProjection(db, { today: '2026-12-15' });
    const december = projection.months.find((row) => row.month === '2026-12');

    assert.equal(december.contributionCents, 55000);
    assert.equal(december.remainderCents, 130611);
    assert.equal(december.savingsBalanceCents, 235000);
    assert.equal(projection.months.at(-1).savingsBalanceCents, 490000);
  } finally {
    db.close();
  }
});

test('simulação aceita parâmetros personalizados', () => {
  const db = memoryDatabase();
  try {
    const simulation = motorcycleSimulation(
      db,
      {
        entryCents: 300000,
        installmentCents: 70000,
        installments: 36,
        purchaseMonth: '2027-12',
        contributionCents: 50000,
      },
      { today: '2026-11-18' },
    );

    assert.equal(simulation.monthsUntilPurchase, 13);
    assert.equal(simulation.projectedSavingsCents, 150000 + 13 * 50000);
    assert.equal(simulation.purchaseOutlayCents, 430000);
    assert.equal(simulation.contractsCents, 6460);
    assert.equal(simulation.monthlyFlowCents, 50240);
    assert.equal(simulation.lastInstallmentMonth, '2030-11');
  } finally {
    db.close();
  }
});
