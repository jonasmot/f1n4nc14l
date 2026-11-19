import { DomainError } from '../domain/errors.js';
import { addMonths, assertMonth, compareMonths, todayISO } from '../domain/dates.js';
import { contractOccurrence, ruleOccurrence } from '../domain/recurring.js';
import { collectMonthlyTotals, accountBalanceThroughMonth } from '../domain/summary.js';
import { listAccounts } from '../infrastructure/repositories/accounts.js';
import { listInstallmentPlans } from '../infrastructure/repositories/contracts.js';
import { holidaySetFromDatabase } from '../infrastructure/repositories/holidays.js';
import { listRecurringRules } from '../infrastructure/repositories/recurring.js';
import { insertTransaction, listTransactions } from '../infrastructure/repositories/transactions.js';
import { getActiveGoal } from '../infrastructure/repositories/goals.js';

export function generateMonthTransactions(db, month) {
  assertMonth(month);

  const holidays = holidaySetFromDatabase(db);
  const rules = listRecurringRules(db, { activeOnly: true });
  const plans = listInstallmentPlans(db, { activeOnly: true });

  const occurrences = [];

  for (const rule of rules) {
    const occurrence = ruleOccurrence(rule, month, holidays);
    if (occurrence) occurrences.push(occurrence);
  }

  for (const plan of plans) {
    const occurrence = contractOccurrence(plan, month);
    if (occurrence) occurrences.push(occurrence);
  }

  return occurrences;
}

export function openMonth(db, { month }) {
  assertMonth(month);

  const occurrences = generateMonthTransactions(db, month);
  let created = 0;

  db.exec('BEGIN');
  try {
    for (const occurrence of occurrences) {
      const result = insertTransaction(db, occurrence, { ignoreDuplicate: true });
      created += result.changes;
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const total = listTransactions(db, { month }).length;

  return {
    month,
    created,
    total,
    expected: occurrences.length,
    alreadyOpen: created === 0 && total > 0,
  };
}

function cashAccounts(accounts) {
  return accounts.filter((account) => account.type === 'corrente' || account.type === 'carteira');
}

function savingsAccount(accounts, accountsById, savingsAccountId) {
  return savingsAccountId ? accountsById.get(savingsAccountId) ?? null : null;
}

function cashBalanceAt(accounts, transactions, month) {
  return cashAccounts(accounts).reduce(
    (total, account) => total + accountBalanceThroughMonth(account, transactions, month),
    0,
  );
}

function savingsBalanceAt(accounts, accountsById, transactions, month, savingsAccountId) {
  const savings = savingsAccount(accounts, accountsById, savingsAccountId);
  return savings ? accountBalanceThroughMonth(savings, transactions, month) : 0;
}

function unrealizedCashNet(transactions, accountsById, month) {
  let total = 0;

  for (const transaction of transactions) {
    if (transaction.month !== month || transaction.status !== 'previsto') continue;
    if (transaction.type !== 'receita' && transaction.type !== 'despesa') continue;
    const account = accountsById.get(transaction.accountId);
    if (!account || account.type === 'beneficio' || account.type === 'cofrinho') continue;
    total += transaction.type === 'receita' ? transaction.amountCents : -transaction.amountCents;
  }

  return total;
}

function contributionsInMonth(transactions, savingsAccountId, month) {
  if (!savingsAccountId) return 0;
  return transactions
    .filter(
      (transaction) =>
        transaction.month === month &&
        transaction.type === 'transferencia' &&
        transaction.status === 'pago' &&
        transaction.counterAccountId === savingsAccountId,
    )
    .reduce((total, transaction) => total + transaction.amountCents, 0);
}

export function projectedMonthTransactions(db, month) {
  const existing = listTransactions(db, { month });
  const generatedExisting = existing.filter(
    (transaction) => transaction.origin === 'contrato' || transaction.origin === 'recorrencia',
  );

  if (generatedExisting.length > 0) return existing;

  const generated = generateMonthTransactions(db, month);
  return [...existing, ...generated];
}

export function forecastMonth(db, { month, today = todayISO() } = {}) {
  assertMonth(month);

  const currentMonthKey = today.slice(0, 7);
  const accounts = listAccounts(db);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const transactions = listTransactions(db);
  const goal = getActiveGoal(db);
  const savingsAccountId = goal?.accountId ?? null;
  const plannedContributionCents = goal?.monthlyContributionCents ?? 0;

  const monthTotals = (targetMonth) => {
    const monthTransactions =
      compareMonths(targetMonth, currentMonthKey) <= 0
        ? transactions.filter((transaction) => transaction.month === targetMonth)
        : projectedMonthTransactions(db, targetMonth);
    return collectMonthlyTotals(monthTransactions, accountsById, targetMonth);
  };

  if (compareMonths(month, currentMonthKey) <= 0) {
    const totals = monthTotals(month);
    const contribution =
      goal && compareMonths(month, goal.startMonth) >= 0 ? plannedContributionCents : 0;

    return {
      ...totals,
      plannedContributionCents: contribution,
      availableAfterContributionCents: totals.flowPlannedCents - contribution,
      projectedBalanceCents: cashBalanceAt(accounts, transactions, month),
      projectedSavingsCents: savingsBalanceAt(
        accounts,
        accountsById,
        transactions,
        month,
        savingsAccountId,
      ),
      baseBalanceCents: cashBalanceAt(accounts, transactions, currentMonthKey),
      months: [],
      targetMonth: month,
      isFuture: false,
    };
  }

  let balanceCents = cashBalanceAt(accounts, transactions, currentMonthKey);
  const baseBalanceCents = balanceCents;

  const currentMonthTransactions = transactions.filter(
    (transaction) => transaction.month === currentMonthKey,
  );
  const currentContribution =
    goal && compareMonths(currentMonthKey, goal.startMonth) >= 0 ? plannedContributionCents : 0;
  const paidContributions = contributionsInMonth(
    currentMonthTransactions,
    savingsAccountId,
    currentMonthKey,
  );
  const remainingCurrentContribution = Math.max(0, currentContribution - paidContributions);

  let startCursor = addMonths(currentMonthKey, 1);

  if (currentMonthTransactions.length === 0) {
    startCursor = currentMonthKey;
  } else {
    balanceCents +=
      unrealizedCashNet(currentMonthTransactions, accountsById, currentMonthKey) -
      remainingCurrentContribution;
  }

  let projectedSavingsCents = savingsBalanceAt(
    accounts,
    accountsById,
    transactions,
    currentMonthKey,
    savingsAccountId,
  );
  if (currentMonthTransactions.length > 0) {
    projectedSavingsCents += remainingCurrentContribution;
  }

  const months = [];
  let cursor = startCursor;

  while (compareMonths(cursor, month) <= 0) {
    const monthTransactions = projectedMonthTransactions(db, cursor);
    const totals = collectMonthlyTotals(monthTransactions, accountsById, cursor);
    const contribution =
      goal && compareMonths(cursor, goal.startMonth) >= 0 ? plannedContributionCents : 0;
    const netCents = totals.flowPlannedCents - contribution;

    balanceCents += netCents;
    projectedSavingsCents += contribution;

    months.push({
      month: cursor,
      incomeCents: totals.incomePlannedCents,
      expenseCents: totals.expensePlannedCents,
      flowCents: totals.flowPlannedCents,
      plannedContributionCents: contribution,
      netCents,
      balanceCents,
      savingsBalanceCents: projectedSavingsCents,
    });

    cursor = addMonths(cursor, 1);
  }

  const last = months.at(-1);
  if (!last) {
    throw new DomainError('Não foi possível montar a previsão.', 'FORECAST_ERROR');
  }

  return {
    month: last.month,
    incomePlannedCents: last.incomeCents,
    incomeRealizedCents: 0,
    expensePlannedCents: last.expenseCents,
    expenseRealizedCents: 0,
    flowPlannedCents: last.flowCents,
    flowRealizedCents: 0,
    benefitExpensePlannedCents: 0,
    benefitExpenseRealizedCents: 0,
    plannedContributionCents: last.plannedContributionCents,
    availableBeforeContributionCents: last.flowCents,
    availableAfterContributionCents: last.flowCents - last.plannedContributionCents,
    projectedBalanceCents: last.balanceCents,
    projectedSavingsCents: last.savingsBalanceCents,
    baseBalanceCents,
    months,
    targetMonth: month,
    isFuture: true,
  };
}
