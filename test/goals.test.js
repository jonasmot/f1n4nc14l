import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/infrastructure/db.js';
import { migrate } from '../src/infrastructure/migrator.js';
import { seedDatabase } from '../src/infrastructure/seed.js';
import { listTransactions } from '../src/infrastructure/repositories/transactions.js';
import { goalProgress, motorcycleSimulation } from '../src/application/goals.js';
import { transfer } from '../src/application/accounts.js';

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
    assert.equal(progress.targetCents, 350000);
    assert.equal(progress.balanceCents, 170000);
    assert.equal(progress.remainingCents, 180000);
    assert.equal(progress.percentage.toFixed(1), '48.6');
    assert.equal(progress.achieved, false);
    assert.equal(progress.monthlyContributionCents, 80000);
    assert.equal(progress.monthsUntilTarget, 16);
    assert.equal(progress.monthsToReach, 3);
    assert.equal(progress.projectedMonth, '2027-02');
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
    assert.equal(progress.balanceCents, 250000);
    assert.equal(progress.remainingCents, 100000);
    assert.equal(progress.percentage.toFixed(1), '71.4');
    assert.equal(progress.monthsToReach, 2);
    assert.equal(progress.projectedMonth, '2027-01');
    assert.equal(progress.contributionsCents, 80000);

    transfer(db, { amountCents: 10000, from: 'cofrinho', to: 'conta-corrente', date: '2026-12-12' });
    progress = goalProgress(db, { today: '2026-11-18' });
    assert.equal(progress.balanceCents, 240000);
    assert.equal(progress.withdrawalsCents, 10000);
    assert.equal(progress.netContributionsCents, 70000);
  } finally {
    db.close();
  }
});

test('meta atingida', () => {
  const db = memoryDatabase();
  try {
    transfer(db, { amountCents: 180000, from: 'conta-corrente', to: 'cofrinho', date: '2026-12-10' });
    const progress = goalProgress(db, { today: '2026-11-18' });
    assert.equal(progress.balanceCents, 350000);
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
    assert.equal(simulation.purchaseMonth, '2028-03');
    assert.equal(simulation.monthsUntilPurchase, 16);
    assert.equal(simulation.projectedSavingsCents, 1450000);
    assert.equal(simulation.purchaseOutlayCents, 428000);
    assert.equal(simulation.remainingSavingsCents, 1022000);
    assert.equal(simulation.monthlyFlowCents, 48700);
    assert.equal(simulation.flowWithContributionCents, -31300);
    assert.equal(simulation.lastInstallmentMonth, '2032-02');
    assert.equal(simulation.totalFinancedCents, 3744000);
    assert.equal(simulation.totalPurchaseCents, 4094000);

    assert.equal(listTransactions(db).length, before);
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
    assert.equal(simulation.projectedSavingsCents, 170000 + 13 * 50000);
    assert.equal(simulation.purchaseOutlayCents, 370000);
    assert.equal(simulation.lastInstallmentMonth, '2030-11');
  } finally {
    db.close();
  }
});
