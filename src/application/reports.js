import { addMonths, todayISO } from '../domain/dates.js';
import { buildMonthlySummary, categoryBreakdown, savingsEvolution, weeklySummary } from '../domain/summary.js';
import { DomainError } from '../domain/errors.js';
import { listAccounts } from '../infrastructure/repositories/accounts.js';
import { listCategories } from '../infrastructure/repositories/categories.js';
import { getActiveGoal } from '../infrastructure/repositories/goals.js';
import { listTransactions } from '../infrastructure/repositories/transactions.js';
import { listContracts } from './contracts.js';

function loadContext(db) {
  const accounts = listAccounts(db, { activeOnly: false });
  const categories = listCategories(db, { activeOnly: false });
  const transactions = listTransactions(db);
  const contracts = listContracts(db, { activeOnly: true });
  const goal = getActiveGoal(db);

  return {
    accounts,
    categories,
    transactions,
    contracts,
    goal,
    plannedContributionCents: goal?.monthlyContributionCents ?? 0,
    contractRemainingCents: contracts.reduce(
      (total, contract) => total + contract.remainingCents,
      0,
    ),
  };
}

export function monthlyReport(db, { month, today = todayISO() } = {}) {
  const selectedMonth = month ?? today.slice(0, 7);
  const context = loadContext(db);

  return buildMonthlySummary({
    month: selectedMonth,
    transactions: context.transactions,
    accounts: context.accounts,
    categories: context.categories,
    plannedContributionCents: context.plannedContributionCents,
    contractRemainingCents: context.contractRemainingCents,
  });
}

export function categoryReport(db, { month, today = todayISO() } = {}) {
  const selectedMonth = month ?? today.slice(0, 7);
  const context = loadContext(db);

  return {
    month: selectedMonth,
    cash: categoryBreakdown({
      month: selectedMonth,
      transactions: context.transactions,
      accounts: context.accounts,
      categories: context.categories,
      scope: 'cash',
    }),
    benefits: categoryBreakdown({
      month: selectedMonth,
      transactions: context.transactions,
      accounts: context.accounts,
      categories: context.categories,
      scope: 'benefit',
    }),
  };
}

export function evolutionReport(db, { months = 6, month, today = todayISO() } = {}) {
  if (!Number.isInteger(months) || months < 1) {
    throw new DomainError('A quantidade de meses deve ser um número inteiro maior que zero.', 'INVALID_MONTHS');
  }

  const context = loadContext(db);
  const endMonth = month ?? today.slice(0, 7);
  const labels = [];
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    labels.push(addMonths(endMonth, -offset));
  }

  return savingsEvolution({
    months: labels,
    transactions: context.transactions,
    accounts: context.accounts,
    savingsAccountId: context.goal?.accountId ?? null,
  });
}

export function weekReport(db, { today = todayISO() } = {}) {
  const context = loadContext(db);

  return weeklySummary({
    referenceDate: today,
    transactions: context.transactions,
    accounts: context.accounts,
    categories: context.categories,
    plannedContributionCents: context.plannedContributionCents,
    contractRemainingCents: context.contractRemainingCents,
  });
}

export function currentMonthReport(db, { today = todayISO() } = {}) {
  return monthlyReport(db, { month: today.slice(0, 7), today });
}
