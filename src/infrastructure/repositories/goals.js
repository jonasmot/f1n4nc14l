import { booleanToInteger, updateColumns } from './helpers.js';

function mapGoal(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    targetCents: row.target_cents,
    targetMonth: row.target_month,
    monthlyContributionCents: row.monthly_contribution_cents,
    startMonth: row.start_month,
    accountId: row.account_id,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

export function listGoals(db, { activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : '';
  return db
    .prepare(`SELECT * FROM goals ${where} ORDER BY id`)
    .all()
    .map(mapGoal);
}

export function getGoal(db, id) {
  return mapGoal(db.prepare('SELECT * FROM goals WHERE id = ?').get(id));
}

export function getActiveGoal(db) {
  return mapGoal(db.prepare('SELECT * FROM goals WHERE active = 1 ORDER BY id LIMIT 1').get());
}

export function insertGoal(db, goal) {
  const result = db
    .prepare(`
      INSERT INTO goals
        (name, target_cents, target_month, monthly_contribution_cents, start_month, account_id, active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      goal.name,
      goal.targetCents,
      goal.targetMonth,
      goal.monthlyContributionCents ?? 0,
      goal.startMonth,
      goal.accountId,
      booleanToInteger(goal.active ?? true),
    );
  return Number(result.lastInsertRowid);
}

export function updateGoal(db, id, fields) {
  return updateColumns(db, 'goals', id, {
    name: fields.name,
    target_cents: fields.targetCents,
    target_month: fields.targetMonth,
    monthly_contribution_cents: fields.monthlyContributionCents,
    start_month: fields.startMonth,
    account_id: fields.accountId,
    active: fields.active === undefined ? undefined : booleanToInteger(fields.active),
  });
}
