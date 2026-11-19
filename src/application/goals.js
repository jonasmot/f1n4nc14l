import { addMonths, diffMonths, todayISO } from '../domain/dates.js';
import { DomainError } from '../domain/errors.js';
import { simulateMotorcycle } from '../domain/goal.js';
import { accountBalanceCents } from '../domain/summary.js';
import { getAccount } from '../infrastructure/repositories/accounts.js';
import { getActiveGoal } from '../infrastructure/repositories/goals.js';
import { listTransactions } from '../infrastructure/repositories/transactions.js';

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

export function motorcycleSimulation(db, options = {}, { today = todayISO() } = {}) {
  const goal = getActiveGoal(db);
  const account = goal ? getAccount(db, goal.accountId) : null;
  const transactions = listTransactions(db);
  const cofrinhoCents = account ? accountBalanceCents(account, transactions) : 0;
  const currentMonthKey = today.slice(0, 7);
  const startMonth = goal
    ? (goal.startMonth > currentMonthKey ? goal.startMonth : currentMonthKey)
    : currentMonthKey;

  const simulation = simulateMotorcycle({
    cofrinhoCents,
    startMonth,
    contributionCents: options.contributionCents ?? goal?.monthlyContributionCents,
    purchaseMonth: options.purchaseMonth,
    entryCents: options.entryCents,
    installmentCents: options.installmentCents,
    installments: options.installments,
    salaryCents: options.salaryCents,
    fixedCostsCents: options.fixedCostsCents,
  });

  return simulation;
}
