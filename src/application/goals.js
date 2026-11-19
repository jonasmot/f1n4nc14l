import { addMonths, compareMonths, diffMonths, todayISO } from '../domain/dates.js';
import { DomainError } from '../domain/errors.js';
import { simulateMotorcycle } from '../domain/goal.js';
import { contractEndMonth, hasInstallmentInMonth } from '../domain/schedule.js';
import { accountBalanceCents } from '../domain/summary.js';
import { getAccount } from '../infrastructure/repositories/accounts.js';
import { getActiveGoal } from '../infrastructure/repositories/goals.js';
import { listTransactions } from '../infrastructure/repositories/transactions.js';
import { listContracts } from './contracts.js';
import { forecastMonth } from './planning.js';

export function goalProgress(db, { today = todayISO() } = {}) {
  const goal = getActiveGoal(db);
  if (!goal) {
    throw new DomainError('Nenhuma meta ativa cadastrada.', 'GOAL_NOT_FOUND');
  }

  const account = getAccount(db, goal.accountId);
  if (!account) {
    throw new DomainError('A conta vinculada à meta não existe mais.', 'GOAL_ACCOUNT_NOT_FOUND');
  }

  const transactions = listTransactions(db);
  const balanceCents = accountBalanceCents(account, transactions);
  const remainingCents = Math.max(0, goal.targetCents - balanceCents);
  const percentage = goal.targetCents === 0 ? 0 : (balanceCents / goal.targetCents) * 100;
  const monthsUntilTarget = Math.max(0, diffMonths(today.slice(0, 7), goal.targetMonth));
  const monthsToReach =
    goal.monthlyContributionCents > 0
      ? Math.ceil(remainingCents / goal.monthlyContributionCents)
      : null;
  const projectedMonth =
    monthsToReach === null ? null : addMonths(today.slice(0, 7), monthsToReach);

  let contributionsCents = 0;
  let withdrawalsCents = 0;

  for (const transaction of transactions) {
    if (transaction.type !== 'transferencia' || transaction.status !== 'pago') continue;
    if (transaction.counterAccountId === account.id) contributionsCents += transaction.amountCents;
    if (transaction.accountId === account.id) withdrawalsCents += transaction.amountCents;
  }

  return {
    goal,
    account,
    balanceCents,
    targetCents: goal.targetCents,
    remainingCents,
    percentage,
    achieved: remainingCents === 0,
    monthlyContributionCents: goal.monthlyContributionCents,
    monthsUntilTarget,
    monthsToReach,
    projectedMonth,
    behindSchedule: monthsToReach !== null && monthsToReach > monthsUntilTarget,
    contributionsCents,
    withdrawalsCents,
    netContributionsCents: contributionsCents - withdrawalsCents,
  };
}

function activeContractsAt(contracts, month) {
  const active = contracts.filter(
    (contract) => contract.active && hasInstallmentInMonth(contract, month),
  );
  const monthlyCents = active.reduce((total, contract) => total + contract.installmentCents, 0);
  const endMonths = contracts
    .filter((contract) => contract.active)
    .map((contract) => contractEndMonth(contract))
    .filter((endMonth) => endMonth !== null)
    .sort();

  return {
    contractsCents: monthlyCents,
    lastContractMonth: endMonths.at(-1) ?? null,
  };
}

export function goalProjection(db, { today = todayISO() } = {}) {
  const goal = getActiveGoal(db);
  if (!goal) {
    throw new DomainError('Nenhuma meta ativa cadastrada.', 'GOAL_NOT_FOUND');
  }

  const forecast = forecastMonth(db, { month: goal.targetMonth, today });
  const rows = [];

  if (forecast.isFuture) {
    if (forecast.currentMonth) rows.push(forecast.currentMonth);
    rows.push(...forecast.months);
  } else {
    rows.push({
      month: goal.targetMonth,
      incomeCents: forecast.incomePlannedCents,
      fixedExpenseCents: forecast.fixedExpensePlannedCents,
      contractExpenseCents: forecast.contractExpensePlannedCents,
      otherExpenseCents: forecast.otherExpensePlannedCents,
      expenseCents: forecast.expensePlannedCents,
      availableCents: forecast.flowPlannedCents,
      plannedContributionCents: forecast.plannedContributionCents,
      contributionCents: forecast.plannedContributionCents,
      remainderCents: forecast.availableAfterContributionCents,
      cashBalanceCents: forecast.projectedBalanceCents,
      savingsBalanceCents: forecast.projectedSavingsCents,
    });
  }

  const byMonth = new Map();
  for (const row of rows) {
    if (compareMonths(row.month, goal.startMonth) < 0) continue;
    if (compareMonths(row.month, goal.targetMonth) > 0) continue;
    byMonth.set(row.month, row);
  }

  const months = [...byMonth.values()].sort((a, b) => compareMonths(a.month, b.month));
  const total = (key) => months.reduce((sum, row) => sum + (row[key] ?? 0), 0);
  const projectedSavingsCents = months.at(-1)?.savingsBalanceCents ?? 0;

  return {
    goal,
    months,
    targetMonth: goal.targetMonth,
    totalIncomeCents: total('incomeCents'),
    totalFixedExpenseCents: total('fixedExpenseCents'),
    totalContractExpenseCents: total('contractExpenseCents'),
    totalOtherExpenseCents: total('otherExpenseCents'),
    totalAvailableCents: total('availableCents'),
    totalContributionCents: total('contributionCents'),
    totalRemainderCents: total('remainderCents'),
    projectedSavingsCents,
    remainingAfterTargetCents: projectedSavingsCents - goal.targetCents,
  };
}

export function motorcycleSimulation(db, options = {}, { today = todayISO() } = {}) {
  const goal = getActiveGoal(db);
  const account = goal ? getAccount(db, goal.accountId) : null;
  const transactions = listTransactions(db);
  const cofrinhoCents = account ? accountBalanceCents(account, transactions) : 0;
  const currentMonthKey = today.slice(0, 7);
  const startMonth = goal
    ? (goal.startMonth > currentMonthKey ? goal.startMonth : currentMonthKey)
    : currentMonthKey;
  const purchaseMonth = options.purchaseMonth ?? goal?.targetMonth ?? undefined;
  const contracts = activeContractsAt(
    listContracts(db, { activeOnly: true }),
    purchaseMonth ?? startMonth,
  );

  const simulation = simulateMotorcycle({
    cofrinhoCents,
    startMonth,
    purchaseMonth,
    contributionCents: options.contributionCents ?? goal?.monthlyContributionCents,
    cnhCents: options.cnhCents,
    entryCents: options.entryCents,
    installmentCents: options.installmentCents,
    installments: options.installments,
    helmetCents: options.helmetCents,
    salaryCents: options.salaryCents,
    fixedCostsCents: options.fixedCostsCents,
    contractsCents: contracts.contractsCents,
    lastContractMonth: contracts.lastContractMonth,
  });

  return simulation;
}
