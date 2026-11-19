import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from '../src/infrastructure/db.js';
import { currentVersion } from '../src/infrastructure/migrator.js';
import { seedCounts } from '../src/infrastructure/seed.js';
import { listTransactions } from '../src/infrastructure/repositories/transactions.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'bin', 'fin.js');

function normalize(text) {
  return String(text ?? '').replace(/\u00A0/g, ' ');
}

function run(args, dbPath) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      FIN_DB_PATH: dbPath,
      FIN_TODAY: '2026-11-18',
      NO_COLOR: '1',
    },
    encoding: 'utf8',
  });

  return {
    code: result.status,
    stdout: normalize(result.stdout),
    stderr: normalize(result.stderr),
  };
}

test('fluxo completo: init, mês, aporte, relatórios, previsão, simulação e views', () => {
  const directory = mkdtempSync(join(tmpdir(), 'fin-e2e-'));
  const dbPath = join(directory, 'financas.db');

  try {
    const init = run(['init'], dbPath);
    assert.equal(init.code, 0);

    const opened = run(['mes', 'abrir', '2026-12'], dbPath);
    assert.match(opened.stdout, /12 lançamentos criados/);

    const transfer = run(
      ['transferir', '800', 'conta-corrente', 'cofrinho', '--data', '2026-12-10'],
      dbPath,
    );
    assert.equal(transfer.code, 0);

    const summary = run(['resumo', '--mes', '2026-12'], dbPath);
    assert.match(summary.stdout, /Receitas previstas\s+R\$ 2\.800,00/);
    assert.match(summary.stdout, /Despesas previstas\s+R\$ 943,89/);
    assert.match(summary.stdout, /Fluxo previsto\s+R\$ 1\.856,11/);
    assert.match(summary.stdout, /Disponível após aporte\s+R\$ 1\.056,11/);
    assert.match(summary.stdout, /Caixa\s+-R\$ 800,00/);
    assert.match(summary.stdout, /Cofrinho\s+R\$ 2\.500,00/);
    assert.match(summary.stdout, /VA\s+R\$ 500,00/);
    assert.match(summary.stdout, /VT\s+R\$ 200,00/);

    const forecast = run(['previsao', '--mes', '2027-01'], dbPath);
    assert.match(forecast.stdout, /Receitas previstas\s+R\$ 1\.700,00/);
    assert.match(forecast.stdout, /Despesas previstas\s+R\$ 574,28/);
    assert.match(forecast.stdout, /Fluxo previsto\s+R\$ 1\.125,72/);
    assert.match(forecast.stdout, /Disponível após aporte\s+R\$ 325,72/);
    assert.match(forecast.stdout, /Saldo projetado\s+R\$ 1\.381,83/);
    assert.match(forecast.stdout, /Cofrinho projetado\s+R\$ 3\.300,00/);

    const simulation = run(['simular', 'moto'], dbPath);
    assert.match(simulation.stdout, /Cofrinho projetado\s+R\$ 15\.300,00/);
    assert.match(simulation.stdout, /Entrada \+ 1ª parcela\s+R\$ 4\.280,00/);
    assert.match(simulation.stdout, /Restante\s+R\$ 11\.020,00/);
    assert.match(simulation.stdout, /Última parcela\s+fevereiro\/2032/);

    const db = openDatabase({ path: dbPath });
    try {
      assert.equal(currentVersion(db), 1);
      assert.deepEqual(seedCounts(db), {
        accounts: 5,
        categories: 13,
        contracts: 5,
        recurringRules: 7,
        goals: 1,
        holidays: 30,
        transactions: 13,
      });
      assert.equal(listTransactions(db, { month: '2026-12' }).length, 13);
      assert.equal(
        listTransactions(db, { month: '2026-12', type: 'transferencia' })[0].amountCents,
        80000,
      );

      const lancamentos = db.prepare('SELECT * FROM v_lancamentos').all();
      assert.equal(lancamentos.length, 13);

      const resumo = db.prepare("SELECT * FROM v_resumo_mensal WHERE mes = '2026-12'").get();
      assert.equal(resumo.receitas_previstas_reais, 2800);
      assert.equal(resumo.despesas_previstas_reais, 943.89);
      assert.equal(resumo.fluxo_previsto_reais, 1856.11);

      const contratos = db.prepare('SELECT * FROM v_contratos').all();
      assert.equal(contratos.length, 5);
      assert.equal(contratos.reduce((total, row) => total + row.falta_reais, 0).toFixed(2), '1290.21');

      const meta = db.prepare('SELECT * FROM v_metas').get();
      assert.equal(meta.saldo_reais, 2500);
      assert.equal(meta.percentual, 71.4);

      const beneficios = db
        .prepare("SELECT * FROM v_beneficios WHERE mes = '2026-12' ORDER BY conta")
        .all();
      assert.deepEqual(
        beneficios.map((row) => [row.conta, row.creditos_reais, row.gastos_reais, row.saldo_reais]),
        [
          ['flash-va', 500, 0, 500],
          ['flash-vt', 200, 0, 200],
        ],
      );
    } finally {
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
