import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../src/infrastructure/db.js';
import { migrate } from '../src/infrastructure/migrator.js';
import { seedDatabase } from '../src/infrastructure/seed.js';
import { listTransactions } from '../src/infrastructure/repositories/transactions.js';
import { runMenu } from '../src/cli/menu.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'bin', 'fin.js');

function normalize(text) {
  return String(text ?? '').replace(/\u00A0/g, ' ');
}

function createTempDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'fin-cli-'));
  return {
    directory,
    path: join(directory, 'financas.db'),
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function runCli(args, dbPath, input) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      FIN_DB_PATH: dbPath,
      FIN_TODAY: '2026-11-18',
      NO_COLOR: '1',
    },
    encoding: 'utf8',
    input,
  });

  return {
    code: result.status,
    stdout: normalize(result.stdout),
    stderr: normalize(result.stderr),
  };
}

function withTempDatabase(fn) {
  const temp = createTempDatabase();
  try {
    return fn(temp);
  } finally {
    temp.cleanup();
  }
}

function openForCheck(dbPath) {
  return openDatabase({ path: dbPath });
}

test('fin --help mostra comandos em português', () => {
  withTempDatabase(({ path }) => {
    const result = runCli(['--help'], path);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Uso: fin/);
    assert.match(result.stdout, /Comandos:/);
    assert.match(result.stdout, /Cria o banco/);
    assert.match(result.stdout, /mostra a ajuda/);
  });
});

test('fin init cria o banco e é idempotente', () => {
  withTempDatabase(({ path }) => {
    const first = runCli(['init'], path);
    assert.equal(first.code, 0);
    assert.match(first.stdout, /Migrações aplicadas: 3/);
    assert.match(first.stdout, /5 contas, 13 categorias, 5 contratos, 7 recorrências/);

    const second = runCli(['init'], path);
    assert.equal(second.code, 0);
    assert.match(second.stdout, /Migrações aplicadas: 0/);
    assert.match(second.stdout, /5 contas, 13 categorias, 5 contratos, 7 recorrências/);
  });
});

test('abre o mês, mostra resumo e previsão', () => {
  withTempDatabase(({ path }) => {
    runCli(['init'], path);

    const opened = runCli(['mes', 'abrir', '2026-12'], path);
    assert.match(opened.stdout, /12 lançamentos criados/);

    const reopened = runCli(['mes', 'abrir', '2026-12'], path);
    assert.match(reopened.stdout, /já estava aberto \(12 lançamentos\)/);

    const summary = runCli(['resumo', '--mes', '2026-12'], path);
    assert.match(summary.stdout, /Receitas previstas\s+R\$ 2\.800,00/);
    assert.match(summary.stdout, /Despesas previstas\s+R\$ 943,89/);
    assert.match(summary.stdout, /Fluxo previsto\s+R\$ 1\.856,11/);
    assert.match(summary.stdout, /Disponível após aporte\s+R\$ 1\.006,11/);
    assert.match(summary.stdout, /Contratos restantes\s+R\$ 1\.290,21/);

    const forecast = runCli(['previsao', '--mes', '2027-01'], path);
    assert.match(forecast.stdout, /Receitas previstas\s+R\$ 1\.700,00/);
    assert.match(forecast.stdout, /Contas fixas\s+-R\$ 433,00/);
    assert.match(forecast.stdout, /Contratos\s+-R\$ 141,28/);
    assert.match(forecast.stdout, /Outros\s+R\$ 0,00/);
    assert.match(forecast.stdout, /Despesas previstas\s+R\$ 574,28/);
    assert.match(forecast.stdout, /Fluxo previsto\s+R\$ 1\.125,72/);
    assert.match(forecast.stdout, /Disponível após aporte\s+R\$ 275,72/);
    assert.match(forecast.stdout, /Saldo projetado\s+R\$ 1\.281,83/);
    assert.match(forecast.stdout, /Cofrinho projetado\s+R\$ 3\.200,00/);
  });
});

test('registra gasto e filtra lançamentos', () => {
  withTempDatabase(({ path }) => {
    runCli(['init'], path);
    runCli(['mes', 'abrir', '2026-12'], path);

    const expense = runCli(
      ['gasto', '25,90', 'mercado', 'feira', '--data', '2026-12-09'],
      path,
    );
    assert.equal(expense.code, 0);
    assert.match(expense.stdout, /Gasto registrado: feira/);
    assert.match(expense.stdout, /R\$ 25,90/);

    const listing = runCli(
      ['lancamentos', '--mes', '2026-12', '--tipo', 'despesa', '--categoria', 'mercado'],
      path,
    );
    assert.match(listing.stdout, /feira/);
    assert.match(listing.stdout, /-R\$ 25,90/);
    assert.match(listing.stdout, /pago/);
    assert.doesNotMatch(listing.stdout, /Energia elétrica/);

    const all = runCli(['lancamentos', '--mes', '2026-12'], path);
    assert.match(all.stdout, /Energia elétrica/);
    assert.match(all.stdout, /Crédito VA/);
  });
});

test('transfere para o cofrinho e reflete no saldo', () => {
  withTempDatabase(({ path }) => {
    runCli(['init'], path);

    const result = runCli(
      ['transferir', '800', 'corrente', 'cofrinho', '--data', '2026-12-10'],
      path,
    );
    assert.equal(result.code, 0);
    assert.match(result.stdout, /conta-corrente → cofrinho/);

    const accounts = runCli(['contas', 'listar'], path);
    assert.match(accounts.stdout, /conta-corrente\s+corrente\s+-R\$ 800,00/);
    assert.match(accounts.stdout, /cofrinho\s+cofrinho\s+R\$ 2\.300,00/);

    const meta = runCli(['meta'], path);
    assert.equal(meta.code, 0);
    assert.match(meta.stdout, /Progresso\s+47,1%/);
    assert.match(meta.stdout, /Falta\s+R\$ 2\.580,00/);
    assert.match(meta.stdout, /Aportes registrados\s+R\$ 800,00/);
    assert.match(meta.stdout, /Projeção até março\/2027/);
    assert.match(
      meta.stdout,
      /dezembro\/2026\s+R\$ 2\.800,00\s+-R\$ 433,00\s+-R\$ 230,89\s+-R\$ 280,00\s+R\$ 1\.856,11\s+R\$ 850,00\s+R\$ 1\.006,11\s+R\$ 2\.350,00/,
    );
    assert.match(
      meta.stdout,
      /março\/2027\s+R\$ 1\.700,00\s+-R\$ 433,00\s+-R\$ 95,42\s+R\$ 0,00\s+R\$ 1\.171,58\s+R\$ 850,00\s+R\$ 321,58\s+R\$ 4\.900,00/,
    );
    assert.match(meta.stdout, /Sobra após a compra\s+R\$ 20,00/);
  });
});

test('lista e edita contratos', () => {
  withTempDatabase(({ path }) => {
    runCli(['init'], path);

    const listing = runCli(['contratos', 'listar'], path);
    assert.match(listing.stdout, /Contrato 1/);
    assert.match(listing.stdout, /Total\s+- \s*- \s+R\$ 1\.290,21/);
    assert.match(listing.stdout, /fevereiro\/2028/);

    const edited = runCli(['contratos', 'editar', '3', '--vencimento', '10'], path);
    assert.equal(edited.code, 0);
    assert.match(edited.stdout, /Contrato 3 atualizado/);

    const after = runCli(['contratos', 'listar'], path);
    assert.match(after.stdout, /Contrato 3.*dia 10/);
  });
});

test('simula a moto sem gravar', () => {
  withTempDatabase(({ path }) => {
    runCli(['init'], path);

    const result = runCli(['simular', 'moto'], path);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Cofrinho projetado\s+R\$ 4\.900,00/);
    assert.match(result.stdout, /CNH\s+R\$ 100,00/);
    assert.match(result.stdout, /Entrada\s+R\$ 3\.500,00/);
    assert.match(result.stdout, /1ª parcela\s+R\$ 780,00/);
    assert.match(result.stdout, /Capacete\s+R\$ 500,00/);
    assert.match(result.stdout, /Total do desembolso\s+R\$ 4\.880,00/);
    assert.match(result.stdout, /Restante\s+R\$ 20,00/);
    assert.match(result.stdout, /Fluxo pós-compra\s+R\$ 391,58/);
    assert.match(result.stdout, /Contratos ativos\s+R\$ 95,42\/mês até fevereiro\/2028/);
    assert.match(result.stdout, /Fluxo após contratos\s+R\$ 487,00/);
    assert.match(result.stdout, /Com aporte mantido\s+-R\$ 458,42/);
    assert.match(result.stdout, /Última parcela\s+fevereiro\/2031/);
    assert.match(result.stdout, /Cobertura do restante\s+menos de 1 mês/);

    const custom = runCli(['simular', 'moto', '--cnh', '1000', '--capacete', '0'], path);
    assert.match(custom.stdout, /CNH\s+R\$ 1\.000,00/);
    assert.match(custom.stdout, /Capacete\s+R\$ 0,00/);
    assert.match(custom.stdout, /Total do desembolso\s+R\$ 5\.280,00/);

    const db = openForCheck(path);
    try {
      assert.equal(listTransactions(db).length, 0);
    } finally {
      db.close();
    }
  });
});

test('pagamento com valor ajustado, recebimento, edição e remoção', () => {
  withTempDatabase(({ path }) => {
    runCli(['init'], path);
    runCli(['mes', 'abrir', '2026-12'], path);

    const db = openForCheck(path);
    const energy = listTransactions(db, { month: '2026-12', type: 'despesa' }).find(
      (transaction) => transaction.description === 'Energia elétrica',
    );
    const salary = listTransactions(db, { month: '2026-12', type: 'receita' }).find(
      (transaction) => transaction.description === 'Salário',
    );
    db.close();

    const paid = runCli(['pagar', String(energy.id), '--valor', '312,45', '--data', '2026-12-20'], path);
    assert.match(paid.stdout, /Pago: Energia elétrica/);
    assert.match(paid.stdout, /R\$ 312,45/);

    const received = runCli(['receber', String(salary.id), '--data', '2026-12-07'], path);
    assert.match(received.stdout, /Recebido: Salário/);

    const summary = runCli(['resumo', '--mes', '2026-12'], path);
    assert.match(summary.stdout, /Despesas realizadas\s+R\$ 312,45/);
    assert.match(summary.stdout, /Receitas realizadas\s+R\$ 1\.700,00/);

    const manual = runCli(
      ['gasto', '10', 'lazer', 'cinema', '--data', '2026-12-12'],
      path,
    );
    assert.equal(manual.code, 0);

    const dbAfter = openForCheck(path);
    const cinema = listTransactions(dbAfter, { month: '2026-12' }).find(
      (transaction) => transaction.description === 'cinema',
    );
    dbAfter.close();

    const edited = runCli(['editar', String(cinema.id), '--desc', 'cinema com pipoca', '--valor', '25'], path);
    assert.match(edited.stdout, /cinema com pipoca/);

    const removed = runCli(['remover', String(cinema.id), '--sim'], path);
    assert.match(removed.stdout, /Lançamento removido/);

    const after = runCli(['lancamentos', '--mes', '2026-12'], path);
    assert.doesNotMatch(after.stdout, /cinema com pipoca/);
  });
});

test('confirmações protegem saldo inicial e desativação de contrato', () => {
  withTempDatabase(({ path }) => {
    runCli(['init'], path);

    const denied = runCli(
      ['contas', 'ajustar', 'corrente', '500', '--data', '2026-12-01'],
      path,
      'n\n',
    );
    assert.equal(denied.code, 0);
    assert.match(denied.stdout, /Ajuste cancelado/);

    const db = openForCheck(path);
    assert.equal(
      db
        .prepare('SELECT initial_balance_cents FROM accounts WHERE name = ?')
        .get('conta-corrente').initial_balance_cents,
      0,
    );
    db.close();

    const accepted = runCli(
      ['contas', 'ajustar', 'corrente', '500', '--data', '2026-12-01', '--sim'],
      path,
    );
    assert.match(accepted.stdout, /Saldo inicial de conta-corrente ajustado/);

    const deniedContract = runCli(['contratos', 'editar', '5', '--inativo'], path, 'n\n');
    assert.equal(deniedContract.code, 0);
    assert.match(deniedContract.stdout, /Desativação cancelada/);

    const acceptedContract = runCli(
      ['contratos', 'editar', '5', '--inativo', '--sim'],
      path,
    );
    assert.match(acceptedContract.stdout, /Contrato 5 atualizado/);

    const listing = runCli(['contratos', 'listar'], path);
    assert.match(listing.stdout, /Contrato 5.*inativo/);
  });
});

test('erros de valor e de banco retornam código 1', () => {
  withTempDatabase(({ path }) => {
    const missing = runCli(['resumo'], path);
    assert.equal(missing.code, 1);
    assert.match(missing.stderr, /Banco não inicializado/);

    runCli(['init'], path);
    const invalid = runCli(['gasto', 'abc', 'mercado', 'teste'], path);
    assert.equal(invalid.code, 1);
    assert.match(invalid.stderr, /Valor inválido/);

    const invalidCategory = runCli(['gasto', '10', 'inexistente', 'teste'], path);
    assert.equal(invalidCategory.code, 1);
    assert.match(invalidCategory.stderr, /Categoria/);
  });
});

test('categorias, evolução e semana', () => {
  withTempDatabase(({ path }) => {
    runCli(['init'], path);
    runCli(['mes', 'abrir', '2026-12'], path);
    runCli(['gasto', '25,90', 'mercado', 'feira', '--data', '2026-12-09'], path);

    const categories = runCli(['categorias', '--mes', '2026-12'], path);
    assert.match(categories.stdout, /Energia\s+R\$ 300,00/);
    assert.match(categories.stdout, /Contratos\s+R\$ 230,89/);
    assert.match(categories.stdout, /Total\s+R\$ 969,79\s+100,0%/);
    assert.match(categories.stdout, /Sem gastos com benefícios/);

    const evolution = runCli(['evolucao', '--meses', '3', '--mes', '2026-12'], path);
    assert.match(evolution.stdout, /outubro\/2026/);
    assert.match(evolution.stdout, /dezembro\/2026/);

    const week = runCli(['semana', '--data', '2026-12-07'], path);
    assert.match(week.stdout, /Semana 07\/12\/2026 a 13\/12\/2026/);
    assert.match(week.stdout, /feira/);
    assert.match(week.stdout, /Salário/);

    const emptyWeek = runCli(['semana', '--data', '2026-12-14'], path);
    assert.match(emptyWeek.stdout, /Nenhum gasto registrado nesta semana/);
  });
});

test('menu registra gasto e sai sem alterar mais nada', async () => {
  const db = openDatabase({ path: ':memory:' });
  migrate(db);
  seedDatabase(db);

  const answers = ['gasto', '12,50', 'lazer', 'Cinema', 'sair'];
  const prompts = {
    select: async () => answers.shift(),
    input: async () => answers.shift(),
    confirm: async () => answers.shift(),
  };
  const output = [];
  let writes = 0;

  try {
    const before = listTransactions(db).length;
    await runMenu({
      db,
      today: '2026-12-12',
      output: (text) => output.push(normalize(text)),
      prompts,
    });

    const after = listTransactions(db);
    writes = after.length - before;
    assert.equal(writes, 1);
    assert.equal(after[0].description, 'Cinema');
    assert.equal(after[0].amountCents, 1250);
    assert.equal(after[0].status, 'pago');
    assert.equal(after[0].date, '2026-12-12');
    assert.match(output.join('\n'), /Finanças — dezembro\/2026/);
    assert.match(output.join('\n'), /Gasto registrado: Cinema/);
  } finally {
    db.close();
  }
});

test('menu sai sem alterar dados', async () => {
  const db = openDatabase({ path: ':memory:' });
  migrate(db);
  seedDatabase(db);

  try {
    const before = listTransactions(db).length;
    await runMenu({
      db,
      today: '2026-12-12',
      output: () => {},
      prompts: {
        select: async () => 'sair',
        input: async () => '',
        confirm: async () => false,
      },
    });
    assert.equal(listTransactions(db).length, before);
  } finally {
    db.close();
  }
});
