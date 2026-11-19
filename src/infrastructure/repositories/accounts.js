import { booleanToInteger, integerToBoolean, updateColumns } from './helpers.js';

function mapAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    initialBalanceCents: row.initial_balance_cents,
    initialBalanceDate: row.initial_balance_date,
    spendable: integerToBoolean(row.spendable),
    active: integerToBoolean(row.active),
    createdAt: row.created_at,
  };
}

export function listAccounts(db, { activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : '';
  return db
    .prepare(`SELECT * FROM accounts ${where} ORDER BY id`)
    .all()
    .map(mapAccount);
}

export function getAccount(db, id) {
  return mapAccount(db.prepare('SELECT * FROM accounts WHERE id = ?').get(id));
}

export function getAccountByName(db, name) {
  return mapAccount(db.prepare('SELECT * FROM accounts WHERE name = ?').get(name));
}

export function insertAccount(db, account) {
  const result = db
    .prepare(`
      INSERT INTO accounts (name, type, initial_balance_cents, initial_balance_date, spendable)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(
      account.name,
      account.type,
      account.initialBalanceCents ?? 0,
      account.initialBalanceDate,
      booleanToInteger(account.spendable ?? true),
    );
  return Number(result.lastInsertRowid);
}

export function updateAccount(db, id, fields) {
  return updateColumns(db, 'accounts', id, {
    name: fields.name,
    type: fields.type,
    initial_balance_cents: fields.initialBalanceCents,
    initial_balance_date: fields.initialBalanceDate,
    spendable: fields.spendable === undefined ? undefined : booleanToInteger(fields.spendable),
    active: fields.active === undefined ? undefined : booleanToInteger(fields.active),
  });
}

export function updateInitialBalance(db, id, initialBalanceCents, initialBalanceDate) {
  return updateColumns(db, 'accounts', id, {
    initial_balance_cents: initialBalanceCents,
    initial_balance_date: initialBalanceDate,
  });
}
