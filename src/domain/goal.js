import { addMonths, diffMonths } from './dates.js';
import { DomainError } from './errors.js';

export const MOTORCYCLE_DEFAULTS = {
  entryCents: 350_000,
  installmentCents: 78_000,
  installments: 48,
  purchaseMonth: '2028-03',
  contributionCents: 80_000,
  salaryCents: 170_000,
  fixedCostsCents: 43_300,
};

export function simulateMotorcycle({
  cofrinhoCents,
  contributionCents = MOTORCYCLE_DEFAULTS.contributionCents,
  startMonth,
  purchaseMonth = MOTORCYCLE_DEFAULTS.purchaseMonth,
  entryCents = MOTORCYCLE_DEFAULTS.entryCents,
  installmentCents = MOTORCYCLE_DEFAULTS.installmentCents,
  installments = MOTORCYCLE_DEFAULTS.installments,
  salaryCents = MOTORCYCLE_DEFAULTS.salaryCents,
  fixedCostsCents = MOTORCYCLE_DEFAULTS.fixedCostsCents,
}) {
  if (!Number.isInteger(installments) || installments < 1) {
    throw new DomainError('A quantidade de parcelas deve ser maior que zero.', 'INVALID_SIMULATION');
  }
  if (installments > 48) {
    throw new DomainError('O MVP simula no máximo 48 parcelas.', 'INVALID_SIMULATION');
  }
  if (cofrinhoCents < 0 || contributionCents < 0 || entryCents < 0 || installmentCents < 0) {
    throw new DomainError('Os valores da simulação não podem ser negativos.', 'INVALID_SIMULATION');
  }

  const monthsUntilPurchase = Math.max(0, diffMonths(startMonth, purchaseMonth) + 1);
  const projectedSavingsCents = cofrinhoCents + contributionCents * monthsUntilPurchase;
  const purchaseOutlayCents = entryCents + installmentCents;
  const remainingSavingsCents = projectedSavingsCents - purchaseOutlayCents;
  const monthlyFlowCents = salaryCents - fixedCostsCents - installmentCents;
  const flowWithContributionCents = monthlyFlowCents - contributionCents;
  const lastInstallmentMonth = addMonths(purchaseMonth, installments - 1);

  const coverageMonths =
    remainingSavingsCents <= 0 || flowWithContributionCents >= 0
      ? null
      : Math.floor(remainingSavingsCents / Math.abs(flowWithContributionCents));

  return {
    startMonth,
    purchaseMonth,
    monthsUntilPurchase,
    contributionCents,
    projectedSavingsCents,
    entryCents,
    installmentCents,
    installments,
    purchaseOutlayCents,
    remainingSavingsCents,
    monthlyFlowCents,
    flowWithContributionCents,
    coverageMonths,
    lastInstallmentMonth,
    totalFinancedCents: installmentCents * installments,
    totalPurchaseCents: entryCents + installmentCents * installments,
  };
}
