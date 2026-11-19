import { addDays, compareMonths, formatMonthBR, weekRange } from './dates.js';

const CASH_TYPES = new Set(['corrente', 'carteira', 'cofrinho']);

export function isBenefitAccount(account) {
  return account?.type === 'beneficio';
}

export function isSavingsAccount(account) {
  return account?.type === 'cofrinho';
}

export function toAccountMap(accounts) {
  if (accounts instanceof Map) return accounts;
  return new Map(accounts.map((account) => [account.id, account]));
}

export function toCategoryMap(categories = []) {
  if (categories instanceof Map) return categories;
  return new Map(categories.map((category) => [category.id, category]));
}

export function accountBalanceCents(account, transactions) {
  let balance = account.initialBalanceCents ?? 0;

  for (const transaction of transactions) {
    if (transaction.status === 'cancelado') continue;

    if (transaction.type === 'receita' && transaction.status === 'recebido') {
      if (transaction.accountId === account.id) balance += transaction.amountCents;
    } else if (transaction.type === 'despesa' && transaction.status === 'pago') {
      if (transaction.accountId === account.id) balance -= transaction.amountCents;
    } else if (transaction.type === 'transferencia' && transaction.status === 'pago') {
      if (transaction.accountId === account.id) balance -= transaction.amountCents;
      if (transaction.counterAccountId === account.id) balance += transaction.amountCents;
    } else if (transaction.type === 'ajuste') {
      if (transaction.accountId === account.id) balance += transaction.amountCents;
    }
  }

  return balance;
}

export function accountBalanceThroughMonth(account, transactions, month) {
  return accountBalanceCents(
    account,
    transactions.filter((transaction) => compareMonths(transaction.month, month) <= 0),
  );
}

export function benefitBalanceCents(account, transactions, month) {
  let balance = 0;

  for (const transaction of transactions) {
    if (transaction.month !== month || transaction.status === 'cancelado') continue;
    if (transaction.accountId !== account.id) continue;
    if (transaction.type === 'receita') balance += transaction.amountCents;
    if (transaction.type === 'despesa') balance -= transaction.amountCents;
  }

  return balance;
}

export function collectMonthlyTotals(
  transactions,
  accountsById,
  month,
  { fixedCategoryIds = new Set() } = {},
) {
  const totals = {
    month,
    incomePlannedCents: 0,
    incomeRealizedCents: 0,
    expensePlannedCents: 0,
    expenseRealizedCents: 0,
    fixedExpensePlannedCents: 0,
    contractExpensePlannedCents: 0,
    otherExpensePlannedCents: 0,
    benefitExpensePlannedCents: 0,
    benefitExpenseRealizedCents: 0,
  };

  for (const transaction of transactions) {
    if (transaction.month !== month || transaction.status === 'cancelado') continue;
    if (transaction.type !== 'receita' && transaction.type !== 'despesa') continue;

    const account = accountsById.get(transaction.accountId);
    if (!account || !CASH_TYPES.has(account.type)) {
      if (transaction.type === 'despesa') {
        totals.benefitExpensePlannedCents += transaction.amountCents;
        if (transaction.status === 'pago') totals.benefitExpenseRealizedCents += transaction.amountCents;
      }
      continue;
    }

    if (transaction.type === 'receita') {
      totals.incomePlannedCents += transaction.amountCents;
      if (transaction.status === 'recebido') totals.incomeRealizedCents += transaction.amountCents;
    } else {
      totals.expensePlannedCents += transaction.amountCents;
      if (transaction.origin === 'contrato') {
        totals.contractExpensePlannedCents += transaction.amountCents;
      } else if (fixedCategoryIds.has(transaction.categoryId)) {
        totals.fixedExpensePlannedCents += transaction.amountCents;
      } else {
        totals.otherExpensePlannedCents += transaction.amountCents;
      }
      if (transaction.status === 'pago') totals.expenseRealizedCents += transaction.amountCents;
    }
  }

  return {
    ...totals,
    flowPlannedCents: totals.incomePlannedCents - totals.expensePlannedCents,
    flowRealizedCents: totals.incomeRealizedCents - totals.expenseRealizedCents,
  };
}

export function buildMonthlySummary({
  month,
  transactions,
  accounts,
  categories = [],
  plannedContributionCents = 0,
  contractRemainingCents = 0,
}) {
  const accountsById = toAccountMap(accounts);
  const totals = collectMonthlyTotals(transactions, accountsById, month);

  let cashBalanceCents = 0;
  let savingsBalanceCents = 0;
  const benefits = [];

  for (const account of accountsById.values()) {
    if (isBenefitAccount(account)) {
      benefits.push({
        accountId: account.id,
        name: account.name,
        balanceCents: benefitBalanceCents(account, transactions, month),
      });
    } else if (isSavingsAccount(account)) {
      savingsBalanceCents += accountBalanceThroughMonth(account, transactions, month);
    } else if (CASH_TYPES.has(account.type)) {
      cashBalanceCents += accountBalanceThroughMonth(account, transactions, month);
    }
  }

  const benefitTotalCents = benefits.reduce((total, benefit) => total + benefit.balanceCents, 0);
  const categoriesById = toCategoryMap(categories);

  return {
    ...totals,
    plannedContributionCents,
    availableBeforeContributionCents: totals.flowPlannedCents,
    availableAfterContributionCents: totals.flowPlannedCents - plannedContributionCents,
    cashBalanceCents,
    savingsBalanceCents,
    benefits,
    totalPatrimonyCents: cashBalanceCents + savingsBalanceCents + benefitTotalCents,
    contractRemainingCents,
    categoriesById,
  };
}

export function categoryBreakdown({
  month,
  transactions,
  accounts,
  categories = [],
  scope = 'cash',
}) {
  const accountsById = toAccountMap(accounts);
  const categoriesById = toCategoryMap(categories);
  const grouped = new Map();

  for (const transaction of transactions) {
    if (transaction.month !== month) continue;
    if (transaction.status === 'cancelado') continue;
    if (transaction.type !== 'despesa') continue;

    const account = accountsById.get(transaction.accountId);
    const isBenefit = account ? isBenefitAccount(account) : false;
    if (scope === 'cash' && isBenefit) continue;
    if (scope === 'benefit' && !isBenefit) continue;

    const key = transaction.categoryId ?? 0;
    grouped.set(key, (grouped.get(key) ?? 0) + transaction.amountCents);
  }

  const grandTotalCents = [...grouped.values()].reduce((total, value) => total + value, 0);
  const rows = [...grouped.entries()]
    .map(([categoryId, totalCents]) => ({
      categoryId: categoryId || null,
      name: categoriesById.get(categoryId)?.name ?? 'Sem categoria',
      totalCents,
      percentage: grandTotalCents === 0 ? 0 : (totalCents / grandTotalCents) * 100,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name, 'pt-BR'));

  return { month, scope, grandTotalCents, rows };
}

export function savingsEvolution({ months, transactions, accounts, savingsAccountId }) {
  const accountsById = toAccountMap(accounts);
  const savings = accountsById.get(savingsAccountId);
  if (!savings) return [];

  return months.map((month) => {
    const totals = collectMonthlyTotals(transactions, accountsById, month);
    return {
      month,
      label: formatMonthBR(month),
      incomeCents: totals.incomeRealizedCents,
      expenseCents: totals.expenseRealizedCents,
      flowCents: totals.flowRealizedCents,
      savingsBalanceCents: accountBalanceThroughMonth(savings, transactions, month),
    };
  });
}

export function weeklySummary({
  referenceDate,
  transactions,
  accounts,
  categories = [],
  plannedContributionCents = 0,
  contractRemainingCents = 0,
}) {
  const accountsById = toAccountMap(accounts);
  const categoriesById = toCategoryMap(categories);
  const { start, end } = weekRange(referenceDate);
  const upcomingEnd = addDays(referenceDate, 7);
  const month = referenceDate.slice(0, 7);
  const expenses = [];
  const benefitExpenses = [];

  for (const transaction of transactions) {
    if (transaction.type !== 'despesa' || transaction.status !== 'pago') continue;
    if (transaction.date < start || transaction.date > end) continue;
    const account = accountsById.get(transaction.accountId);
    const item = {
      ...transaction,
      accountName: account?.name ?? '',
      categoryName: categoriesById.get(transaction.categoryId)?.name ?? 'Sem categoria',
    };
    if (account && isBenefitAccount(account)) benefitExpenses.push(item);
    else expenses.push(item);
  }

  const upcoming = transactions
    .filter((transaction) => transaction.status === 'previsto')
    .filter((transaction) => transaction.type === 'despesa' || transaction.type === 'receita')
    .map((transaction) => ({
      ...transaction,
      effectiveDate: transaction.dueDate ?? transaction.date,
      accountName: accountsById.get(transaction.accountId)?.name ?? '',
      categoryName: categoriesById.get(transaction.categoryId)?.name ?? 'Sem categoria',
    }))
    .filter(
      (transaction) =>
        transaction.effectiveDate >= referenceDate && transaction.effectiveDate <= upcomingEnd,
    )
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  const summary = buildMonthlySummary({
    month,
    transactions,
    accounts,
    categories,
    plannedContributionCents,
    contractRemainingCents,
  });

  return {
    start,
    end,
    month,
    expenseCents: expenses.reduce((total, expense) => total + expense.amountCents, 0),
    expenses,
    benefitExpenseCents: benefitExpenses.reduce((total, expense) => total + expense.amountCents, 0),
    benefitExpenses,
    upcoming,
    benefits: summary.benefits,
    availableAfterContributionCents: summary.availableAfterContributionCents,
    flowPlannedCents: summary.flowPlannedCents,
  };
}
