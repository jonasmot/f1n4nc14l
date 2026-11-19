import { booleanToInteger, updateColumns } from './helpers.js';

function mapRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    description: row.description,
    amountCents: row.amount_cents,
    accountId: row.account_id,
    categoryId: row.category_id,
    direction: row.direction,
    frequency: row.frequency,
    dayRule: row.day_rule,
    dayValue: row.day_value,
    monthOfYear: row.month_of_year,
    startMonth: row.start_month,
    endMonth: row.end_month,
    active: Boolean(row.active),
    createdAt: row.created_at,
  };
}

export function listRecurringRules(db, { activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : '';
  return db
    .prepare(`SELECT * FROM recurring_rules ${where} ORDER BY id`)
    .all()
    .map(mapRule);
}

export function getRecurringRule(db, id) {
  return mapRule(db.prepare('SELECT * FROM recurring_rules WHERE id = ?').get(id));
}

export function insertRecurringRule(db, rule) {
  const result = db
    .prepare(`
      INSERT INTO recurring_rules
        (description, amount_cents, account_id, category_id, direction, frequency,
         day_rule, day_value, month_of_year, start_month, end_month, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      rule.description,
      rule.amountCents,
      rule.accountId,
      rule.categoryId ?? null,
      rule.direction,
      rule.frequency,
      rule.dayRule,
      rule.dayValue ?? null,
      rule.monthOfYear ?? null,
      rule.startMonth,
      rule.endMonth ?? null,
      booleanToInteger(rule.active ?? true),
    );
  return Number(result.lastInsertRowid);
}

export function updateRecurringRule(db, id, fields) {
  return updateColumns(db, 'recurring_rules', id, {
    description: fields.description,
    amount_cents: fields.amountCents,
    account_id: fields.accountId,
    category_id: fields.categoryId,
    direction: fields.direction,
    frequency: fields.frequency,
    day_rule: fields.dayRule,
    day_value: fields.dayValue,
    month_of_year: fields.monthOfYear,
    start_month: fields.startMonth,
    end_month: fields.endMonth,
    active: fields.active === undefined ? undefined : booleanToInteger(fields.active),
  });
}
