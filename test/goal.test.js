import test from 'node:test';
import assert from 'node:assert/strict';
import { MOTORCYCLE_DEFAULTS, simulateMotorcycle } from '../src/domain/goal.js';
import { DomainError } from '../src/domain/errors.js';

test('simula a moto com os parâmetros padrão', () => {
  const simulation = simulateMotorcycle({
    cofrinhoCents: 150000,
    startMonth: '2026-12',
  });

  assert.equal(simulation.purchaseMonth, '2027-03');
  assert.equal(simulation.monthsUntilPurchase, 4);
  assert.equal(simulation.projectedSavingsCents, 490000);
  assert.equal(simulation.purchaseOutlayCents, 488000);
  assert.equal(simulation.remainingSavingsCents, 2000);
  assert.equal(simulation.monthlyFlowCents, 48700);
  assert.equal(simulation.flowWithContributionCents, -36300);
  assert.equal(simulation.coverageMonths, 0);
  assert.equal(simulation.lastInstallmentMonth, '2031-02');
  assert.equal(simulation.totalFinancedCents, 3744000);
  assert.equal(simulation.totalPurchaseCents, 4094000);
});

test('aporte menor deixa a meta descoberta', () => {
  const simulation = simulateMotorcycle({
    cofrinhoCents: 150000,
    contributionCents: 100000,
    startMonth: '2026-12',
  });

  assert.equal(simulation.projectedSavingsCents, 550000);
  assert.equal(simulation.remainingSavingsCents, 62000);
  assert.equal(simulation.flowWithContributionCents, -51300);
  assert.equal(simulation.coverageMonths, 1);
});

test('simulação que começa depois', () => {
  const simulation = simulateMotorcycle({
    cofrinhoCents: 150000,
    startMonth: '2027-01',
  });

  assert.equal(simulation.monthsUntilPurchase, 3);
  assert.equal(simulation.projectedSavingsCents, 405000);
});

test('compra adiada aumenta a cobertura do restante', () => {
  const simulation = simulateMotorcycle({
    cofrinhoCents: 150000,
    startMonth: '2026-12',
    purchaseMonth: '2028-03',
  });

  assert.equal(simulation.projectedSavingsCents, 1510000);
  assert.equal(simulation.remainingSavingsCents, 1022000);
  assert.equal(simulation.coverageMonths, 28);
});

test('rejeita parcelas inválidas', () => {
  assert.throws(() => simulateMotorcycle({ cofrinhoCents: 0, startMonth: '2026-12', installments: 0 }), DomainError);
  assert.throws(() => simulateMotorcycle({ cofrinhoCents: 0, startMonth: '2026-12', installments: 49 }), DomainError);
});

test('padrões batem com o plano', () => {
  assert.equal(MOTORCYCLE_DEFAULTS.cnhCents, 10000);
  assert.equal(MOTORCYCLE_DEFAULTS.entryCents, 350000);
  assert.equal(MOTORCYCLE_DEFAULTS.installmentCents, 78000);
  assert.equal(MOTORCYCLE_DEFAULTS.installments, 48);
  assert.equal(MOTORCYCLE_DEFAULTS.helmetCents, 50000);
  assert.equal(MOTORCYCLE_DEFAULTS.purchaseMonth, '2027-03');
  assert.equal(MOTORCYCLE_DEFAULTS.contributionCents, 85000);
});
