import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../src/infrastructure/db.js';
import { currentVersion, listMigrations, migrate } from '../src/infrastructure/migrator.js';
import { seedCounts, seedDatabase } from '../src/infrastructure/seed.js';
import { getAccount, getAccountByName, listAccounts, updateInitialBalance } from '../src/infrastructure/repositories/accounts.js';
import { listCategories } from '../src/infrastructure/repositories/categories.js';
import { getSetting, listSettings, setSetting } from '../src/infrastructure/repositories/settings.js';
import { listHolidays } from '../src/infrastructure/repositories/holidays.js';
import { getActiveGoal, listGoals } from '../src/infrastructure/repositories/goals.js';
import { listInstallmentPlans } from '../src/infrastructure/repositories/contracts.js';
import { listRecurringRules } from '../src/infrastructure/repositories/recurring.js';
import {
  deleteTransaction,
  getTransaction,
  insertTransaction,
  listTransactions,
  updateTransaction,
} from '../src/infrastructure/repositories/transactions.js';
import { contractRemainingCents, totalRemainingCents } from '../src/domain/schedule.js';

function memoryDatabase() {
  const db = openDatabase({ path: ':memory:' });
  migrate(db);
  seedDatabase(db);
  return db;
}

test('aplica a migração inicial e o seed', () => {
  const db = memoryDatabase();
  try {
    assert.equal(currentVersion(db), 3);
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);

    assert.deepEqual(seedCounts(db), {
      accounts: 5,
      categories: 13,
      contracts: 5,
      recurringRules: 7,
      goals: 1,
      holidays: 30,
      transactions: 0,
    });

    const accounts = listAccounts(db);
    assert.deepEqual(
      accounts.map((account) => [account.name, account.type, account.initialBalanceCents]),
      [
        ['conta-corrente', 'corrente', 0],
        ['carteira', 'carteira', 0],
        ['cofrinho', 'cofrinho', 150000],
        ['flash-va', 'beneficio', 0],
        ['flash-vt', 'beneficio', 0],
      ],
    );
    assert.equal(getAccount(db, 1).name, 'conta-corrente');
    assert.equal(getAccountByName(db, 'cofrinho').id, 3);

    assert.equal(listCategories(db, { type: 'despesa' }).length, 9);
    assert.equal(listInstallmentPlans(db).length, 5);
    assert.equal(totalRemainingCents(listInstallmentPlans(db)), 129021);
    assert.equal(contractRemainingCents(listInstallmentPlans(db)[0]), 9172);
    assert.equal(listRecurringRules(db).length, 7);
    assert.equal(listRecurringRules(db)[0].dayRule, 'business_day');
    assert.equal(getActiveGoal(db).targetCents, 488000);
    assert.equal(listGoals(db).length, 1);
    assert.equal(listHolidays(db).length, 30);
  } finally {
    db.close();
  }
});

test('migrações 002 e 003 revisam o plano antigo da moto', () => {
  const db = openDatabase({ path: ':memory:' });
  try {
    const migrations = listMigrations();
    migrate(db, { migrations: migrations.filter((migration) => migration.version === 1) });
    seedDatabase(db);
    db.prepare('UPDATE accounts SET initial_balance_cents = 170000 WHERE id = 3').run();
    db.prepare(
      `UPDATE goals
       SET target_cents = 350000, target_month = '2028-03', monthly_contribution_cents = 80000
       WHERE id = 1`,
    ).run();

    const applied = migrate(db, { migrations });

    assert.deepEqual(applied, [2, 3]);
    assert.equal(getAccount(db, 3).initialBalanceCents, 150000);
    const goal = getActiveGoal(db);
    assert.equal(goal.targetCents, 488000);
    assert.equal(goal.targetMonth, '2027-03');
    assert.equal(goal.monthlyContributionCents, 85000);
  } finally {
    db.close();
  }
});

test('migração 003 corrige a meta sem perder lançamentos', () => {
  const db = openDatabase({ path: ':memory:' });
  try {
    const migrations = listMigrations();
    migrate(db, { migrations: migrations.filter((migration) => migration.version <= 2) });
    seedDatabase(db);
    insertTransaction(db, {
      month: '2026-12',
      date: '2026-12-09',
      type: 'despesa',
      amountCents: 2590,
      accountId: 1,
      categoryId: 7,
      description: 'Feira',
      status: 'pago',
    });
    db.prepare(
      `UPDATE goals
       SET target_cents = 628000, monthly_contribution_cents = 120000
       WHERE id = 1`,
    ).run();

    const applied = migrate(db, { migrations });

    assert.deepEqual(applied, [3]);
    const goal = getActiveGoal(db);
    assert.equal(goal.targetCents, 488000);
    assert.equal(goal.monthlyContributionCents, 85000);
    assert.equal(listTransactions(db).length, 1);
    assert.equal(listTransactions(db)[0].description, 'Feira');
  } finally {
    db.close();
  }
});

test('seed é idempotente', () => {
  const db = memoryDatabase();
  try {
    const before = seedCounts(db);
    seedDatabase(db);
    const after = seedCounts(db);
    assert.deepEqual(after, before);
    assert.equal(listTransactions(db, { month: '2026-12' }).length, 0);
  } finally {
    db.close();
  }
});

test('repositório de transações cria, filtra, edita e remove', () => {
  const db = memoryDatabase();
  try {
    const { id, changes } = insertTransaction(db, {
      month: '2026-12',
      date: '2026-12-09',
      type: 'despesa',
      amountCents: 2590,
      accountId: 1,
      categoryId: 7,
      description: 'Feira',
      status: 'pago',
    });

    assert.equal(changes, 1);
    assert.ok(id > 0);
    assert.equal(getTransaction(db, id).description, 'Feira');
    assert.equal(listTransactions(db, { month: '2026-12', status: 'pago' }).length, 1);
    assert.equal(listTransactions(db, { type: 'despesa' }).length, 1);
    assert.equal(listTransactions(db, { accountId: 1 }).length, 1);
    assert.equal(listTransactions(db, { categoryId: 7 }).length, 1);
    assert.equal(listTransactions(db, { fromDate: '2026-12-01', toDate: '2026-12-10' }).length, 1);

    updateTransaction(db, id, { description: 'Feira do mês', amountCents: 3000, categoryId: 8 });
    assert.equal(getTransaction(db, id).description, 'Feira do mês');
    assert.equal(getTransaction(db, id).amountCents, 3000);

    assert.equal(deleteTransaction(db, id), 1);
    assert.equal(getTransaction(db, id), null);
  } finally {
    db.close();
  }
});

test('índice de idempotência ignora duplicatas geradas', () => {
  const db = memoryDatabase();
  try {
    const base = {
      month: '2026-12',
      date: '2026-12-07',
      type: 'receita',
      amountCents: 170000,
      accountId: 1,
      categoryId: 1,
      description: 'Salário',
      status: 'previsto',
      origin: 'recorrencia',
      originId: 1,
    };

    assert.equal(insertTransaction(db, base, { ignoreDuplicate: true }).changes, 1);
    assert.equal(insertTransaction(db, base, { ignoreDuplicate: true }).changes, 0);
  } finally {
    db.close();
  }
});

test('configurações e saldo inicial', () => {
  const db = memoryDatabase();
  try {
    assert.equal(getSetting(db, 'currency'), 'BRL');
    setSetting(db, 'currency', 'BRL');
    setSetting(db, 'tema', 'claro');
    assert.equal(getSetting(db, 'tema'), 'claro');
    assert.equal(listSettings(db).tema, 'claro');

    updateInitialBalance(db, 1, 50000, '2026-12-01');
    assert.equal(getAccount(db, 1).initialBalanceCents, 50000);
  } finally {
    db.close();
  }
});

test('views do DB Browser mostram valores em reais', () => {
  const db = memoryDatabase();
  try {
    insertTransaction(db, {
      month: '2026-12',
      date: '2026-12-01',
      type: 'despesa',
      amountCents: 28000,
      accountId: 1,
      categoryId: 10,
      description: 'Autoescola',
      status: 'pago',
    });

    const lancamentos = db.prepare('SELECT * FROM v_lancamentos').all();
    assert.equal(lancamentos.length, 1);
    assert.equal(lancamentos[0].descricao, 'Autoescola');
    assert.equal(lancamentos[0].valor_reais, 280);

    const resumo = db.prepare('SELECT * FROM v_resumo_mensal').get();
    assert.equal(resumo.mes, '2026-12');
    assert.equal(resumo.receitas_previstas_reais, 0);
    assert.equal(resumo.despesas_previstas_reais, 280);
    assert.equal(resumo.fluxo_previsto_reais, -280);

    const categoria = db.prepare('SELECT * FROM v_categorias').get();
    assert.equal(categoria.categoria, 'Outros');
    assert.equal(categoria.total_reais, 280);

    const contratos = db.prepare('SELECT * FROM v_contratos ORDER BY id').all();
    assert.equal(contratos.length, 5);
    assert.equal(contratos.reduce((total, row) => total + row.falta_reais, 0).toFixed(2), '1290.21');
    assert.equal(contratos[0].termino, '2027-01');

    const meta = db.prepare('SELECT * FROM v_metas').get();
    assert.equal(meta.meta, 'Moto');
    assert.equal(meta.alvo_reais, 4880);
    assert.equal(meta.saldo_reais, 1500);
    assert.equal(meta.percentual, 30.7);

    assert.equal(db.prepare('SELECT * FROM v_beneficios').all().length, 0);
  } finally {
    db.close();
  }
});

test('migração falha faz rollback', () => {
  const db = openDatabase({ path: ':memory:' });
  try {
    assert.throws(() =>
      migrate(db, {
        migrations: [
          {
            version: 1,
            name: 'quebrada',
            sql: 'CREATE TABLE exemplo (id INTEGER); INSERT INTO tabela_inexistente VALUES (1);',
          },
        ],
      }),
    );
    assert.equal(currentVersion(db), 0);
    assert.equal(
      db.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE name = 'exemplo'").get().total,
      0,
    );
  } finally {
    db.close();
  }
});

test('abre banco em arquivo com journal DELETE', () => {
  const directory = mkdtempSync(join(tmpdir(), 'financas-'));
  const path = join(directory, 'teste.db');
  const db = openDatabase({ path });
  try {
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'delete');
    migrate(db);
    seedDatabase(db);
    assert.equal(seedCounts(db).accounts, 5);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
