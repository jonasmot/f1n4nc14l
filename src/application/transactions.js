import { DomainError } from '../domain/errors.js';
import { assertDateISO, formatDateBR, monthOf, todayISO } from '../domain/dates.js';
import { formatMoney } from '../domain/money.js';
import { listAccounts } from '../infrastructure/repositories/accounts.js';
import { listCategories } from '../infrastructure/repositories/categories.js';
import {
  deleteTransaction,
  getTransaction,
  insertTransaction,
  listTransactions,
  updateTransaction,
} from '../infrastructure/repositories/transactions.js';
import { resolveAccount, resolveCategory } from './lookups.js';

const STATUS_LABELS = {
  previsto: 'previsto',
  pago: 'pago',
  recebido: 'recebido',
  cancelado: 'cancelado',
};

const TYPE_LABELS = {
  receita: 'receita',
  despesa: 'despesa',
  transferencia: 'transferência',
  ajuste: 'ajuste',
};

function requireDescription(description) {
  if (!description || !String(description).trim()) {
    throw new DomainError('Informe uma descrição.', 'DESCRIPTION_REQUIRED');
  }
  return String(description).trim();
}

function requireAmount(amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new DomainError('O valor deve ser maior que zero.', 'INVALID_AMOUNT');
  }
  return amountCents;
}

function resolveEntryDate(date) {
  const entryDate = date ?? todayISO();
  assertDateISO(entryDate);
  return entryDate;
}

export function addExpense(db, {
  amountCents,
  description,
  category,
  account = 'conta-corrente',
  date,
  dueDate = null,
  status = 'previsto',
  notes = null,
}) {
  requireAmount(amountCents);
  const entryDate = resolveEntryDate(date);
  const targetAccount = resolveAccount(db, account, { fallback: 'conta-corrente' });
  const targetCategory = resolveCategory(db, category, 'despesa');

  if (!['previsto', 'pago'].includes(status)) {
    throw new DomainError('Status inválido para despesa.', 'INVALID_STATUS');
  }
  if (dueDate) assertDateISO(dueDate);

  const { id } = insertTransaction(db, {
    month: monthOf(entryDate),
    date: entryDate,
    dueDate,
    type: 'despesa',
    amountCents,
    accountId: targetAccount.id,
    categoryId: targetCategory.id,
    description: requireDescription(description),
    status,
    paidAt: status === 'pago' ? entryDate : null,
    origin: 'manual',
    notes,
  });

  return getTransactionDetailed(db, id);
}

export function addIncome(db, {
  amountCents,
  description,
  category,
  account = 'conta-corrente',
  date,
  dueDate = null,
  status = 'previsto',
  notes = null,
}) {
  requireAmount(amountCents);
  const entryDate = resolveEntryDate(date);
  const targetAccount = resolveAccount(db, account, { fallback: 'conta-corrente' });
  const targetCategory = resolveCategory(db, category, 'receita');

  if (!['previsto', 'recebido'].includes(status)) {
    throw new DomainError('Status inválido para receita.', 'INVALID_STATUS');
  }
  if (dueDate) assertDateISO(dueDate);

  const { id } = insertTransaction(db, {
    month: monthOf(entryDate),
    date: entryDate,
    dueDate,
    type: 'receita',
    amountCents,
    accountId: targetAccount.id,
    categoryId: targetCategory.id,
    description: requireDescription(description),
    status,
    paidAt: status === 'recebido' ? entryDate : null,
    origin: 'manual',
    notes,
  });

  return getTransactionDetailed(db, id);
}

export function quickExpense(db, {
  amountCents,
  category,
  description,
  account = 'conta-corrente',
  date,
  notes = null,
}) {
  return addExpense(db, {
    amountCents,
    category,
    description,
    account,
    date,
    status: 'pago',
    notes,
  });
}

export function listTransactionsDetailed(db, filters = {}) {
  const accounts = new Map(listAccounts(db, { activeOnly: false }).map((account) => [account.id, account]));
  const categories = new Map(
    listCategories(db, { activeOnly: false }).map((category) => [category.id, category]),
  );

  return listTransactions(db, filters).map((transaction) => {
    const account = accounts.get(transaction.accountId);
    const counterAccount = accounts.get(transaction.counterAccountId);
    const category = categories.get(transaction.categoryId);

    return {
      ...transaction,
      accountName: account?.name ?? '',
      counterAccountName: counterAccount?.name ?? null,
      categoryName: category?.name ?? null,
      typeLabel: TYPE_LABELS[transaction.type] ?? transaction.type,
      statusLabel: STATUS_LABELS[transaction.status] ?? transaction.status,
      amountLabel: formatMoney(transaction.amountCents),
      dateLabel: formatDateBR(transaction.date),
      dueDateLabel: formatDateBR(transaction.dueDate),
      paidAtLabel: transaction.paidAt ? formatDateBR(transaction.paidAt) : null,
    };
  });
}

export function getTransactionDetailed(db, id) {
  return listTransactionsDetailed(db).find((transaction) => transaction.id === id) ?? null;
}

export function getTransactionOrFail(db, id) {
  const transaction = getTransaction(db, id);
  if (!transaction) {
    throw new DomainError(`Lançamento ${id} não encontrado.`, 'TRANSACTION_NOT_FOUND');
  }
  return transaction;
}

export function payTransaction(db, { id, date, amountCents }) {
  const transaction = getTransactionOrFail(db, id);

  if (transaction.type !== 'despesa') {
    throw new DomainError('Apenas despesas podem ser pagas. Use `fin receber` para receitas.', 'INVALID_TYPE');
  }
  if (transaction.status === 'pago') {
    throw new DomainError(`O lançamento ${id} já está pago.`, 'ALREADY_PAID');
  }
  if (transaction.status === 'cancelado') {
    throw new DomainError(`O lançamento ${id} está cancelado.`, 'CANCELLED');
  }

  const paidAt = resolveEntryDate(date);
  const paidAmount = amountCents === undefined ? transaction.amountCents : requireAmount(amountCents);

  updateTransaction(db, id, {
    status: 'pago',
    paidAt,
    amountCents: paidAmount,
  });

  return getTransactionDetailed(db, id);
}

export function receiveTransaction(db, { id, date, amountCents }) {
  const transaction = getTransactionOrFail(db, id);

  if (transaction.type !== 'receita') {
    throw new DomainError('Apenas receitas podem ser recebidas. Use `fin pagar` para despesas.', 'INVALID_TYPE');
  }
  if (transaction.status === 'recebido') {
    throw new DomainError(`O lançamento ${id} já está recebido.`, 'ALREADY_RECEIVED');
  }
  if (transaction.status === 'cancelado') {
    throw new DomainError(`O lançamento ${id} está cancelado.`, 'CANCELLED');
  }

  const receivedAt = resolveEntryDate(date);
  const receivedAmount = amountCents === undefined ? transaction.amountCents : requireAmount(amountCents);

  updateTransaction(db, id, {
    status: 'recebido',
    paidAt: receivedAt,
    amountCents: receivedAmount,
  });

  return getTransactionDetailed(db, id);
}

export function editTransaction(db, id, fields = {}) {
  const transaction = getTransactionOrFail(db, id);
  const updates = {};

  if (fields.description !== undefined) updates.description = requireDescription(fields.description);
  if (fields.amountCents !== undefined) updates.amountCents = requireAmount(fields.amountCents);
  if (fields.date !== undefined) {
    assertDateISO(fields.date);
    updates.date = fields.date;
    updates.month = monthOf(fields.date);
  }
  if (fields.dueDate !== undefined) {
    if (fields.dueDate) assertDateISO(fields.dueDate);
    updates.dueDate = fields.dueDate;
  }
  if (fields.category !== undefined && (transaction.type === 'receita' || transaction.type === 'despesa')) {
    updates.categoryId = resolveCategory(db, fields.category, transaction.type).id;
  }
  if (fields.account !== undefined) {
    updates.accountId = resolveAccount(db, fields.account).id;
  }
  if (fields.notes !== undefined) updates.notes = fields.notes;

  if (Object.keys(updates).length === 0) {
    throw new DomainError('Nenhum campo para editar.', 'NOTHING_TO_UPDATE');
  }

  updateTransaction(db, id, updates);
  return getTransactionDetailed(db, id);
}

export function removeTransaction(db, id) {
  const transaction = getTransactionOrFail(db, id);

  if (transaction.origin === 'contrato' || transaction.origin === 'recorrencia') {
    throw new DomainError(
      'Lançamentos gerados por contrato ou recorrência não podem ser removidos. Cancele ou edite o plano correspondente.',
      'GENERATED_TRANSACTION',
    );
  }

  const changes = deleteTransaction(db, id);
  return { removed: changes === 1, transaction };
}

export function cancelTransaction(db, id) {
  getTransactionOrFail(db, id);
  updateTransaction(db, id, { status: 'cancelado', paidAt: null });
  return getTransactionDetailed(db, id);
}
