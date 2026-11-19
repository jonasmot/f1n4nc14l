import { DomainError } from '../domain/errors.js';
import { formatDateBR, monthOf, todayISO } from '../domain/dates.js';
import { formatMoney } from '../domain/money.js';
import { accountBalanceCents, benefitBalanceCents } from '../domain/summary.js';
import { listAccounts, updateInitialBalance } from '../infrastructure/repositories/accounts.js';
import { insertTransaction, listTransactions } from '../infrastructure/repositories/transactions.js';
import { resolveAccount } from './lookups.js';

export function listAccountsWithBalances(db, { month, today = todayISO() } = {}) {
  const selectedMonth = month ?? today.slice(0, 7);
  const accounts = listAccounts(db);
  const transactions = listTransactions(db);

  return accounts.map((account) => ({
    ...account,
    balanceCents:
      account.type === 'beneficio'
        ? benefitBalanceCents(account, transactions, selectedMonth)
        : accountBalanceCents(account, transactions),
    balanceScope: account.type === 'beneficio' ? `mês ${selectedMonth}` : 'atual',
  }));
}

export function adjustInitialBalance(db, { account, amountCents, date }) {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new DomainError('O saldo inicial não pode ser negativo.', 'INVALID_BALANCE');
  }
  if (!date) {
    throw new DomainError('Informe a data do saldo inicial.', 'DATE_REQUIRED');
  }

  const target = resolveAccount(db, account);
  updateInitialBalance(db, target.id, amountCents, date);
  return resolveAccount(db, target.name);
}

export function transfer(db, { amountCents, from, to, date, description = 'Transferência' }) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new DomainError('O valor da transferência deve ser maior que zero.', 'INVALID_AMOUNT');
  }
  if (!date) {
    throw new DomainError('Informe a data da transferência.', 'DATE_REQUIRED');
  }

  const source = resolveAccount(db, from);
  const destination = resolveAccount(db, to);

  if (source.id === destination.id) {
    throw new DomainError('A conta de origem e destino devem ser diferentes.', 'INVALID_TRANSFER');
  }

  const { id } = insertTransaction(db, {
    month: monthOf(date),
    date,
    type: 'transferencia',
    amountCents,
    accountId: source.id,
    counterAccountId: destination.id,
    description,
    status: 'pago',
    paidAt: date,
    origin: 'manual',
  });

  return {
    id,
    amountCents,
    from: source,
    to: destination,
    date,
    description,
    dateLabel: formatDateBR(date),
    amountLabel: formatMoney(amountCents),
  };
}

export function monthlyBenefits(db, { month, today = todayISO() } = {}) {
  const selectedMonth = month ?? today.slice(0, 7);
  const accounts = listAccounts(db).filter((account) => account.type === 'beneficio');
  const transactions = listTransactions(db);

  return accounts.map((account) => ({
    accountId: account.id,
    name: account.name,
    balanceCents: benefitBalanceCents(account, transactions, selectedMonth),
    month: selectedMonth,
  }));
}
