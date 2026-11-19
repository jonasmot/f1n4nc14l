import { booleanToInteger, updateColumns } from './helpers.js';

function mapPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    description: row.description,
    installmentCents: row.installment_cents,
    totalInstallments: row.total_installments,
    paidBeforeStart: row.paid_before_start,
    nextMonth: row.next_month,
    dueDay: row.due_day,
    accountId: row.account_id,
    categoryId: row.category_id,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

export function listInstallmentPlans(db, { activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : '';
  return db
    .prepare(`SELECT * FROM installment_plans ${where} ORDER BY id`)
    .all()
    .map(mapPlan);
}

export function getInstallmentPlan(db, id) {
  return mapPlan(db.prepare('SELECT * FROM installment_plans WHERE id = ?').get(id));
}

export function insertInstallmentPlan(db, plan) {
  const result = db
    .prepare(`
      INSERT INTO installment_plans
        (description, installment_cents, total_installments, paid_before_start, next_month,
         due_day, account_id, category_id, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      plan.description,
      plan.installmentCents,
      plan.totalInstallments,
      plan.paidBeforeStart ?? 0,
      plan.nextMonth,
      plan.dueDay ?? null,
      plan.accountId,
      plan.categoryId ?? null,
      booleanToInteger(plan.active ?? true),
    );
  return Number(result.lastInsertRowid);
}

export function updateInstallmentPlan(db, id, fields) {
  return updateColumns(db, 'installment_plans', id, {
    description: fields.description,
    installment_cents: fields.installmentCents,
    total_installments: fields.totalInstallments,
    paid_before_start: fields.paidBeforeStart,
    next_month: fields.nextMonth,
    due_day: fields.dueDay,
    account_id: fields.accountId,
    category_id: fields.categoryId,
    active: fields.active === undefined ? undefined : booleanToInteger(fields.active),
  });
}
