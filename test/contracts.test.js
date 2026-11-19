import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/infrastructure/db.js';
import { migrate } from '../src/infrastructure/migrator.js';
import { seedDatabase } from '../src/infrastructure/seed.js';
import { listTransactions } from '../src/infrastructure/repositories/transactions.js';
import { openMonth } from '../src/application/planning.js';
import { editContract, listContracts } from '../src/application/contracts.js';
import { payTransaction } from '../src/application/transactions.js';
import { monthlyReport } from '../src/application/reports.js';

function memoryDatabase() {
  const db = openDatabase({ path: ':memory:' });
  migrate(db);
  seedDatabase(db);
  return db;
}

function contractTransaction(db, description) {
  return listTransactions(db, { month: '2026-12' }).find(
    (transaction) => transaction.description.startsWith(description),
  );
}

test('lista contratos com saldo e término', () => {
  const db = memoryDatabase();
  try {
    const contracts = listContracts(db);
    assert.equal(contracts.length, 5);
    assert.equal(
      contracts.reduce((total, contract) => total + contract.remainingCents, 0),
      129021,
    );
    assert.deepEqual(
      contracts.map((contract) => [
        contract.description,
        contract.remainingInstallments,
        contract.endMonth,
      ]),
      [
        ['Contrato 1', 2, '2027-01'],
        ['Contrato 2', 4, '2027-03'],
        ['Contrato 3', 15, '2028-02'],
        ['Contrato 4', 5, '2027-04'],
        ['Contrato 5', 1, '2026-12'],
      ],
    );
  } finally {
    db.close();
  }
});

test('pagar parcela reduz o saldo restante', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const installment = contractTransaction(db, 'Contrato 5');
    payTransaction(db, { id: installment.id, date: '2026-12-15' });

    const contracts = listContracts(db);
    const contract5 = contracts.find((contract) => contract.description === 'Contrato 5');
    assert.equal(contract5.paidInstallments, 1);
    assert.equal(contract5.remainingInstallments, 0);
    assert.equal(contract5.remainingCents, 0);
    assert.equal(
      contracts.reduce((total, contract) => total + contract.remainingCents, 0),
      120060,
    );

    const report = monthlyReport(db, { month: '2026-12' });
    assert.equal(report.contractRemainingCents, 120060);

    const view = db
      .prepare("SELECT * FROM v_contratos WHERE contrato = 'Contrato 5'")
      .get();
    assert.equal(view.restantes, 0);
    assert.equal(view.falta_reais, 0);
  } finally {
    db.close();
  }
});

test('pagamento com desconto também quita a parcela', () => {
  const db = memoryDatabase();
  try {
    openMonth(db, { month: '2026-12' });
    const installment = contractTransaction(db, 'Contrato 1');
    payTransaction(db, { id: installment.id, date: '2026-12-15', amountCents: 4000 });

    const contract1 = listContracts(db).find((contract) => contract.description === 'Contrato 1');
    assert.equal(contract1.paidInstallments, 1);
    assert.equal(contract1.remainingInstallments, 1);
    assert.equal(contract1.remainingCents, 4586);

    const view = db
      .prepare("SELECT * FROM v_contratos WHERE contrato = 'Contrato 1'")
      .get();
    assert.equal(view.restantes, 1);
    assert.equal(view.falta_reais, 45.86);
  } finally {
    db.close();
  }
});

test('edita vencimento, valor e situação do contrato', () => {
  const db = memoryDatabase();
  try {
    const edited = editContract(db, 3, { dueDay: 10, installmentCents: 7000 });
    assert.equal(edited.dueDay, 10);
    assert.equal(edited.installmentCents, 7000);
    assert.equal(edited.remainingCents, 15 * 7000);

    const inactive = editContract(db, 3, { active: false });
    assert.equal(inactive.active, false);
    assert.equal(listContracts(db, { activeOnly: true }).length, 4);
  } finally {
    db.close();
  }
});
