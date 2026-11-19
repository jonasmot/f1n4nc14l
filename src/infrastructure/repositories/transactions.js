import { updateColumns } from './helpers.js';

function mapTransaction(row) {
  if (!row) return null;
  return {
    id: row.id,
    month: row.month,
    date: row.date,
    dueDate: row.due_date,
    type: row.type,
    amountCents: row.amount_cents,
    accountId: row.account_id,
    counterAccountId: row.counter_account_id,
    categoryId: row.category_id,
    description: row.description,
    status: row.status,
    paidAt: row.paid_at,
    origin: row.origin,
    originId: row.origin_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertTransaction(db, transaction, { ignoreDuplicate = false } = {}) {
  const verb = ignoreDuplicate ? 'INSERT OR IGNORE' : 'INSERT';
  const result = db
    .prepare(`
      ${verb} INTO transactions
        (month, date, due_date, type, amount_cents, account_id, counter_account_id, category_id,
         description, status, paid_at, origin, origin_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      transaction.month,
      transaction.date,
      transaction.dueDate ?? null,
      transaction.type,
      transaction.amountCents,
      transaction.accountId,
      transaction.counterAccountId ?? null,
      transaction.categoryId ?? null,
      transaction.description,
      transaction.status ?? 'previsto',
      transaction.paidAt ?? null,
      transaction.origin ?? 'manual',
      transaction.originId ?? null,
      transaction.notes ?? null,
    );

  const changes = Number(result.changes);
  return {
    id: changes > 0 ? Number(result.lastInsertRowid) : null,
    changes,
  };
}

export function getTransaction(db, id) {
  return mapTransaction(db.prepare('SELECT * FROM transactions WHERE id = ?').get(id));
}

export function listTransactions(db, filters = {}) {
  const clauses = [];
  const params = [];

  if (filters.month) {
    clauses.push('month = ?');
    params.push(filters.month);
  }
  if (filters.fromDate) {
    clauses.push('date >= ?');
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    clauses.push('date <= ?');
    params.push(filters.toDate);
  }
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    clauses.push(`status IN (${statuses.map(() => '?').join(', ')})`);
    params.push(...statuses);
  }
  if (filters.categoryId) {
    clauses.push('category_id = ?');
    params.push(filters.categoryId);
  }
  if (filters.accountId) {
    clauses.push('(account_id = ? OR counter_account_id = ?)');
    params.push(filters.accountId, filters.accountId);
  }
  if (filters.type) {
    clauses.push('type = ?');
    params.push(filters.type);
  }
  if (filters.origin) {
    clauses.push('origin = ?');
    params.push(filters.origin);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM transactions ${where} ORDER BY date, id`)
    .all(...params)
    .map(mapTransaction);
}

export function updateTransaction(db, id, fields) {
  return updateColumns(db, 'transactions', id, {
    month: fields.month,
    date: fields.date,
    due_date: fields.dueDate,
    type: fields.type,
    amount_cents: fields.amountCents,
    account_id: fields.accountId,
    counter_account_id: fields.counterAccountId,
    category_id: fields.categoryId,
    description: fields.description,
    status: fields.status,
    paid_at: fields.paidAt,
    notes: fields.notes,
    updated_at: fields.updatedAt,
  });
}

export function deleteTransaction(db, id) {
  return Number(db.prepare('DELETE FROM transactions WHERE id = ?').run(id).changes);
}
