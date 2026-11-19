import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTORCYCLE_DEFAULTS, simulateMotorcycle } from '../src/domain/goal.js';
import { DomainError } from '../src/domain/errors.js';

test('simula a moto com os parâmetros padrão', () => {
  const simulation = simulateMotorcycle({
    cofrinhoCents: 170000,
    startMonth: '2026-12',
  });

  assert.equal(simulation.purchaseMonth, '2028-03');
  assert.equal(simulation.monthsUntilPurchase, 16);
  assert.equal(simulation.projectedSavingsCents, 1450000);
  assert.equal(simulation.purchaseOutlayCents, 428000);
  assert.equal(simulation.remainingSavingsCents, 1022000);
  assert.equal(simulation.monthlyFlowCents, 48700);
  assert.equal(simulation.flowWithContributionCents, -31300);
  assert.equal(simulation.coverageMonths, 32);
  assert.equal(simulation.lastInstallmentMonth, '2032-02');
  assert.equal(simulation.totalFinancedCents, 3744000);
  assert.equal(simulation.totalPurchaseCents, 4094000);
});

test('simulação com aporte maior', () => {
  const simulation = simulateMotorcycle({
    cofrinhoCents: 170000,
    contributionCents: 100000,
    startMonth: '2026-12',
  });

  assert.equal(simulation.projectedSavingsCents, 1770000);
  assert.equal(simulation.flowWithContributionCents, -51300);
  assert.equal(simulation.coverageMonths, 26);
});

test('simulação que começa depois', () => {
  const simulation = simulateMotorcycle({
    cofrinhoCents: 170000,
    startMonth: '2027-01',
  });

  assert.equal(simulation.monthsUntilPurchase, 15);
  assert.equal(simulation.projectedSavingsCents, 1370000);
});

test('rejeita parcelas inválidas', () => {
  assert.throws(() => simulateMotorcycle({ cofrinhoCents: 0, startMonth: '2026-12', installments: 0 }), DomainError);
  assert.throws(() => simulateMotorcycle({ cofrinhoCents: 0, startMonth: '2026-12', installments: 49 }), DomainError);
});

test('padrões batem com o plano', () => {
  assert.equal(MOTORCYCLE_DEFAULTS.entryCents, 350000);
  assert.equal(MOTORCYCLE_DEFAULTS.installmentCents, 78000);
  assert.equal(MOTORCYCLE_DEFAULTS.installments, 48);
});
