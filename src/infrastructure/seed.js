import { NATIONAL_HOLIDAYS } from '../domain/business-days.js';

const ACCOUNTS = [
  ['conta-corrente', 'corrente', 0, '2026-12-01', 1],
  ['carteira', 'carteira', 0, '2026-12-01', 1],
  ['cofrinho', 'cofrinho', 150000, '2026-12-01', 0],
  ['flash-va', 'beneficio', 0, '2026-12-01', 1],
  ['flash-vt', 'beneficio', 0, '2026-12-01', 1],
];

const CATEGORIES = [
  [1, 'Salário', 'receita', null],
  [2, '13º', 'receita', null],
  [3, 'Moradia', 'despesa', null],
  [4, 'Energia', 'despesa', 3],
  [5, 'Internet', 'despesa', 3],
  [6, 'Alimentação', 'despesa', null],
  [7, 'Mercado', 'despesa', 6],
  [8, 'Refeições', 'despesa', 6],
  [9, 'Lazer', 'despesa', null],
  [10, 'Outros', 'despesa', null],
  [11, 'Contratos', 'despesa', null],
  [12, 'Benefício VA', 'receita', null],
  [13, 'Benefício VT', 'receita', null],
];

const CONTRACTS = [
  [1, 'Contrato 1', 4586, 2, 0, '2026-12', null],
  [2, 'Contrato 2', 1422, 5, 1, '2026-12', 10],
  [3, 'Contrato 3', 6460, 20, 5, '2026-12', null],
  [4, 'Contrato 4', 1660, 12, 7, '2026-12', null],
  [5, 'Contrato 5', 8961, 1, 0, '2026-12', null],
];

const RULES = [
  [1, 'Salário', 170000, 1, 1, 'entrada', 'mensal', 'business_day', 5, null, '2026-12', null],
  [2, '13º salário', 110000, 1, 2, 'entrada', 'anual', 'fixed', 18, 12, '2026-12', null],
  [3, 'Energia elétrica', 30000, 1, 4, 'saida', 'mensal', 'undefined', null, null, '2026-12', null],
  [4, 'Internet', 13300, 1, 5, 'saida', 'mensal', 'undefined', null, null, '2026-12', null],
  [5, 'Crédito VA', 50000, 4, 12, 'beneficio', 'mensal', 'fixed', 1, null, '2026-12', null],
  [6, 'Crédito VT', 20000, 5, 13, 'beneficio', 'mensal', 'fixed', 1, null, '2026-12', null],
  [7, 'Autoescola', 28000, 1, 10, 'saida', 'anual', 'undefined', null, 12, '2026-12', '2026-12'],
];

export const SEED_VERSION = 1;

export function seedDatabase(db) {
  db.exec('BEGIN');
  try {
    const insertAccount = db.prepare(`
      INSERT OR IGNORE INTO accounts
        (id, name, type, initial_balance_cents, initial_balance_date, spendable)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    ACCOUNTS.forEach((account, index) => {
      insertAccount.run(index + 1, ...account);
    });

    const insertCategory = db.prepare(`
      INSERT OR IGNORE INTO categories (id, name, type, parent_id)
      VALUES (?, ?, ?, ?)
    `);
    CATEGORIES.forEach((category) => insertCategory.run(...category));

    const insertContract = db.prepare(`
      INSERT OR IGNORE INTO installment_plans
        (id, description, installment_cents, total_installments, paid_before_start, next_month, due_day, account_id, category_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, 11)
    `);
    CONTRACTS.forEach((contract) => insertContract.run(...contract));

    const insertRule = db.prepare(`
      INSERT OR IGNORE INTO recurring_rules
        (id, description, amount_cents, account_id, category_id, direction, frequency,
         day_rule, day_value, month_of_year, start_month, end_month)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    RULES.forEach((rule) => insertRule.run(...rule));

    db.prepare(`
      INSERT OR IGNORE INTO goals
        (id, name, target_cents, target_month, monthly_contribution_cents, start_month, account_id)
      VALUES (1, 'Moto', 488000, '2027-03', 85000, '2026-12', 3)
    `).run();

    const insertHoliday = db.prepare('INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)');
    NATIONAL_HOLIDAYS.forEach((holiday) => insertHoliday.run(holiday.date, holiday.name));

    const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    insertSetting.run('currency', 'BRL');
    insertSetting.run('timezone', 'America/Sao_Paulo');
    insertSetting.run('seed_version', String(SEED_VERSION));

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return seedCounts(db);
}

export function seedCounts(db) {
  const count = (table) => db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get().total;
  return {
    accounts: count('accounts'),
    categories: count('categories'),
    contracts: count('installment_plans'),
    recurringRules: count('recurring_rules'),
    goals: count('goals'),
    holidays: count('holidays'),
    transactions: count('transactions'),
  };
}
