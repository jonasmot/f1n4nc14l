import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/infrastructure/db.js';
import { migrate } from '../src/infrastructure/migrator.js';
import { seedDatabase } from '../src/infrastructure/seed.js';
import { accountBalanceCents } from '../src/domain/summary.js';
import { listTransactions } from '../src/infrastructure/repositories/transactions.js';
import { insertTransaction } from '../src/infrastructure/repositories/transactions.js';
import {
  adjustInitialBalance,
  listAccountsWithBalances,
  monthlyBenefits,
  transfer,
} from '../src/application/accounts.js';
import {
  addExpense,
  addIncome,
  editTransaction,
  listTransactionsDetailed,
  payTransaction,
  quickExpense,
  receiveTransaction,
  removeTransaction,
} from '../src/application/transactions.js';
import { DomainError } from '../src/domain/errors.js';

function memoryDatabase() {
  const db = openDatabase({ path: ':memory:' });
  migrate(db);
  seedDatabase(db);
  return db;
}

test('lista contas com saldos derivados', () => {
  const db = memoryDatabase();
  try {
    const accounts = listAccountsWithBalances(db, { month: '2026-12' });
    const byName = Object.fromEntries(accounts.map((account) => [account.name, account]));
    assert.equal(byName['conta-corrente'].balanceCents, 0);
    assert.equal(byName.cofrinho.balanceCents, 150000);
    assert.equal(byName['flash-va'].balanceCents, 0);
  } finally {
    db.close();
  }
});

test('ajusta saldo inicial', () => {
  const db = memoryDatabase();
  try {
    adjustInitialBalance(db, { account: 'corrente', amountCents: 50000, date: '2026-12-01' });
    const account = listAccountsWithBalances(db).find((item) => item.name === 'conta-corrente');
    assert.equal(account.initialBalanceCents, 50000);
    assert.equal(account.balanceCents, 50000);
  } finally {
    db.close();
  }
});

test('transferência move saldos sem virar receita ou despesa', () => {
  const db = memoryDatabase();
  try {
    const result = transfer(db, {
      amountCents: 80000,
      from: 'conta-corrente',
      to: 'cofrinho',
      date: '2026-12-10',
    });
    assert.equal(result.from.name, 'conta-corrente');
    assert.equal(result.to.name, 'cofrinho');

    const accounts = listAccountsWithBalances(db);
    const byName = Object.fromEntries(accounts.map((account) => [account.name, account]));
    assert.equal(byName['conta-corrente'].balanceCents, -80000);
    assert.equal(byName.cofrinho.balanceCents, 230000);

    const transactions = listTransactions(db);
    assert.equal(transactions.filter((transaction) => transaction.type === 'receita').length, 0);
    assert.equal(transactions.filter((transaction) => transaction.type === 'despesa').length, 0);
    assert.equal(transactions.filter((transaction) => transaction.type === 'transferencia').length, 1);
  } finally {
    db.close();
  }
});

test('rejeita transferência para a mesma conta', () => {
  const db = memoryDatabase();
  try {
    assert.throws(
      () => transfer(db, { amountCents: 100, from: 'cofrinho', to: 'poupanca', date: '2026-12-10' }),
      DomainError,
    );
  } finally {
    db.close();
  }
});

test('registra despesa rápida paga', () => {
  const db = memoryDatabase();
  try {
    const expense = quickExpense(db, {
      amountCents: 2590,
      category: 'mercado',
      description: 'Feira',
      date: '2026-12-09',
    });

    assert.equal(expense.status, 'pago');
    assert.equal(expense.month, '2026-12');
    assert.equal(expense.categoryName, 'Mercado');
    assert.equal(expense.accountName, 'conta-corrente');
    assert.equal(expense.amountLabel.replace(/\u00A0/g, ' '), 'R$ 25,90');
  } finally {
    db.close();
  }
});

test('aceita categoria com acento e alias de conta', () => {
  const db = memoryDatabase();
  try {
    const expense = quickExpense(db, {
      amountCents: 1500,
      category: 'refeicoes',
      description: 'Almoço',
      account: 'va',
      date: '2026-12-09',
    });
    assert.equal(expense.categoryName, 'Refeições');
    assert.equal(expense.accountName, 'flash-va');
  } finally {
    db.close();
  }
});

test('paga despesa prevista com valor ajustado', () => {
  const db = memoryDatabase();
  try {
    const expense = addExpense(db, {
      amountCents: 30000,
      category: 'energia',
      description: 'Energia',
      date: '2026-12-10',
    });
    assert.equal(expense.status, 'previsto');

    const paid = payTransaction(db, { id: expense.id, date: '2026-12-20', amountCents: 31245 });
    assert.equal(paid.status, 'pago');
    assert.equal(paid.amountCents, 31245);
    assert.equal(paid.paidAt, '2026-12-20');
    assert.throws(() => payTransaction(db, { id: expense.id, date: '2026-12-21' }), DomainError);
  } finally {
    db.close();
  }
});

test('recebe receita prevista', () => {
  const db = memoryDatabase();
  try {
    const income = addIncome(db, {
      amountCents: 170000,
      category: 'salario',
      description: 'Salário',
      date: '2026-12-07',
    });
    assert.equal(income.status, 'previsto');

    const received = receiveTransaction(db, { id: income.id, date: '2026-12-07' });
    assert.equal(received.status, 'recebido');
    assert.equal(received.paidAt, '2026-12-07');
  } finally {
    db.close();
  }
});

test('edita e remove lançamento manual', () => {
  const db = memoryDatabase();
  try {
    const expense = quickExpense(db, {
      amountCents: 1000,
      category: 'lazer',
      description: 'Cinema',
      date: '2026-12-12',
    });

    const edited = editTransaction(db, expense.id, {
      description: 'Cinema com pipoca',
      amountCents: 2500,
      date: '2026-12-13',
      category: 'outros',
    });
    assert.equal(edited.description, 'Cinema com pipoca');
    assert.equal(edited.amountCents, 2500);
    assert.equal(edited.date, '2026-12-13');
    assert.equal(edited.categoryName, 'Outros');

    const result = removeTransaction(db, expense.id);
    assert.equal(result.removed, true);
    assert.equal(listTransactions(db).filter((transaction) => transaction.id === expense.id).length, 0);
  } finally {
    db.close();
  }
});

test('bloqueia remoção de lançamento gerado por contrato', () => {
  const db = memoryDatabase();
  try {
    const { id } = insertTransaction(db, {
      month: '2026-12',
      date: '2026-12-15',
      type: 'despesa',
      amountCents: 4586,
      accountId: 1,
      categoryId: 11,
      description: 'Contrato 1',
      status: 'previsto',
      origin: 'contrato',
      originId: 1,
    });

    assert.throws(() => removeTransaction(db, id), DomainError);
  } finally {
    db.close();
  }
});

test('saldo mensal de VA não acumula entre meses', () => {
  const db = memoryDatabase();
  try {
    addIncome(db, {
      amountCents: 50000,
      category: 'beneficio-va',
      description: 'Crédito VA',
      account: 'flash-va',
      date: '2026-12-01',
      status: 'recebido',
    });
    quickExpense(db, {
      amountCents: 5000,
      category: 'mercado',
      description: 'Mercado',
      account: 'flash-va',
      date: '2026-12-09',
    });

    assert.deepEqual(
      monthlyBenefits(db, { month: '2026-12' }).map((benefit) => [benefit.name, benefit.balanceCents]),
      [
        ['flash-va', 45000],
        ['flash-vt', 0],
      ],
    );
    assert.deepEqual(
      monthlyBenefits(db, { month: '2027-01' }).map((benefit) => [benefit.name, benefit.balanceCents]),
      [
        ['flash-va', 0],
        ['flash-vt', 0],
      ],
    );

    const account = listTransactionsDetailed(db, { type: 'receita' }).find((item) => item.accountName === 'flash-va');
    assert.equal(account.amountCents, 50000);
  } finally {
    db.close();
  }
});

test('saldo de conta considera apenas movimentos confirmados', () => {
  const db = memoryDatabase();
  try {
    const accounts = listAccountsWithBalances(db);
    const checking = accounts.find((account) => account.name === 'conta-corrente');
    assert.equal(checking.balanceCents, 0);

    const expense = addExpense(db, {
      amountCents: 5000,
      category: 'mercado',
      description: 'Previsto',
      date: '2026-12-09',
    });
    const stillZero = listAccountsWithBalances(db).find((account) => account.name === 'conta-corrente');
    assert.equal(stillZero.balanceCents, 0);

    payTransaction(db, { id: expense.id, date: '2026-12-09' });
    const afterPayment = listAccountsWithBalances(db).find((account) => account.name === 'conta-corrente');
    assert.equal(afterPayment.balanceCents, -5000);

    const rawAccounts = db.prepare('SELECT * FROM accounts WHERE id = 1').all();
    assert.equal(
      accountBalanceCents(
        {
          id: rawAccounts[0].id,
          initialBalanceCents: rawAccounts[0].initial_balance_cents,
        },
        listTransactions(db),
      ),
      -5000,
    );
  } finally {
    db.close();
  }
});
