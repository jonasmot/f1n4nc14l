#!/usr/bin/env node
import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import { DomainError } from '../domain/errors.js';
import { todayISO } from '../domain/dates.js';
import { parseMoneyToCents } from '../domain/money.js';
import { listAccountsWithBalances } from '../application/accounts.js';
import { adjustInitialBalance, transfer } from '../application/accounts.js';
import { editContract, listContracts } from '../application/contracts.js';
import { goalProgress, motorcycleSimulation } from '../application/goals.js';
import { resolveAccount, resolveCategoryAny } from '../application/lookups.js';
import { forecastMonth, openMonth } from '../application/planning.js';
import { categoryReport, evolutionReport, monthlyReport, weekReport } from '../application/reports.js';
import {
  addExpense,
  addIncome,
  editTransaction,
  listTransactionsDetailed,
  payTransaction,
  quickExpense,
  receiveTransaction,
  removeTransaction,
} from '../application/transactions.js';
import { isInitialized, openDatabase, resolveDatabasePath } from '../infrastructure/db.js';
import { migrate } from '../infrastructure/migrator.js';
import { seedDatabase } from '../infrastructure/seed.js';
import { runMenu } from './menu.js';
import { money } from './format.js';
import {
  renderAccounts,
  renderCategories,
  renderContracts,
  renderEvolution,
  renderForecast,
  renderGoal,
  renderMonthlySummary,
  renderSimulation,
  renderTransactions,
  renderWeek,
} from './render.js';

const STATUSES = new Set(['previsto', 'pago', 'recebido', 'cancelado']);
const TYPES = new Set(['receita', 'despesa', 'transferencia', 'ajuste']);

function openInitializedDatabase() {
  const db = openDatabase();
  if (!isInitialized(db)) {
    db.close();
    throw new DomainError('Banco não inicializado. Execute `fin init` primeiro.', 'NOT_INITIALIZED');
  }
  return db;
}

function run(action) {
  const db = openInitializedDatabase();
  try {
    return action(db);
  } finally {
    db.close();
  }
}

async function runAsync(action) {
  const db = openInitializedDatabase();
  try {
    return await action(db);
  } finally {
    db.close();
  }
}

function currentMonth() {
  return todayISO().slice(0, 7);
}

function formatCurrentMonth(monthOption) {
  return monthOption ?? currentMonth();
}

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) {
    throw new DomainError(`Identificador inválido: "${value}".`, 'INVALID_ID');
  }
  return id;
}

function buildTransactionFilters(db, options) {
  const filters = { month: formatCurrentMonth(options.mes) };

  if (options.status !== undefined) {
    if (!STATUSES.has(options.status)) {
      throw new DomainError(
        `Status inválido: "${options.status}". Use previsto, pago, recebido ou cancelado.`,
        'INVALID_STATUS',
      );
    }
    filters.status = options.status;
  }

  if (options.tipo !== undefined) {
    if (!TYPES.has(options.tipo)) {
      throw new DomainError(
        `Tipo inválido: "${options.tipo}". Use receita, despesa, transferencia ou ajuste.`,
        'INVALID_TYPE',
      );
    }
    filters.type = options.tipo;
  }

  if (options.categoria !== undefined) {
    filters.categoryId = resolveCategoryAny(db, options.categoria).id;
  }

  if (options.conta !== undefined) {
    filters.accountId = resolveAccount(db, options.conta).id;
  }

  return filters;
}

function buildEditFields(options) {
  const fields = {};

  if (options.desc !== undefined) fields.description = options.desc;
  if (options.valor !== undefined) fields.amountCents = parseMoneyToCents(options.valor);
  if (options.data !== undefined) fields.date = options.data;
  if (options.vencimento !== undefined) {
    fields.dueDate = options.vencimento === 'a-definir' ? null : options.vencimento;
  }
  if (options.categoria !== undefined) fields.category = options.categoria;
  if (options.conta !== undefined) fields.account = options.conta;

  return fields;
}

function configureHelp(program) {
  program.configureHelp({
    formatHelp(command, helper) {
      const sections = [`Uso: ${helper.commandUsage(command)}`];
      const description = helper.commandDescription(command);
      if (description) sections.push('', description);

      const commands = helper.visibleCommands(command);
      if (commands.length > 0) {
        sections.push('', 'Comandos:');
        const width = Math.max(...commands.map((item) => helper.subcommandTerm(item).length));
        for (const item of commands) {
          sections.push(
            `  ${helper.subcommandTerm(item).padEnd(width)}  ${helper.subcommandDescription(item)}`,
          );
        }
      }

      const options = helper.visibleOptions(command);
      if (options.length > 0) {
        sections.push('', 'Opções:');
        const width = Math.max(...options.map((item) => helper.optionTerm(item).length));
        for (const item of options) {
          sections.push(
            `  ${helper.optionTerm(item).padEnd(width)}  ${helper.optionDescription(item)}`,
          );
        }
      }

      return sections.join('\n');
    },
    commandUsage(command) {
      return command.parent ? `${command.name()} [opções]` : 'fin [opções] [comando]';
    },
    optionDescription(option) {
      if (option.long === '--help') return 'mostra a ajuda';
      return option.description;
    },
  });
}

export function buildProgram() {
  const program = new Command();

  program
    .name('fin')
    .description('Controle financeiro pessoal em português, local e offline.')
    .version('0.1.0', '-v, --versao', 'mostra a versão')
    .showHelpAfterError('Use `fin --help` para ver os comandos disponíveis.');

  configureHelp(program);

  program
    .command('init')
    .description('Cria o banco, aplica migrações e insere os dados iniciais')
    .action(() => {
      const db = openDatabase();
      try {
        const applied = migrate(db);
        const counts = seedDatabase(db);
        console.log(`Banco pronto em ${resolveDatabasePath()}`);
        console.log(`Migrações aplicadas: ${applied.length}`);
        console.log(
          `${counts.accounts} contas, ${counts.categories} categorias, ${counts.contracts} contratos, ` +
            `${counts.recurringRules} recorrências, ${counts.goals} meta, ${counts.holidays} feriados.`,
        );
        console.log('Próximo passo: fin mes abrir 2026-12');
      } finally {
        db.close();
      }
    });

  const accounts = program.command('contas').description('Contas, saldos e benefícios');

  accounts
    .command('listar')
    .description('Lista contas com saldo derivado')
    .option('--mes <AAAA-MM>', 'mês de referência dos benefícios')
    .action((options) =>
      run((db) => {
        const list = listAccountsWithBalances(db, { month: formatCurrentMonth(options.mes) });
        console.log(renderAccounts(list));
      }),
    );

  accounts
    .command('ajustar <conta> <valor>')
    .description('Ajusta o saldo inicial de uma conta')
    .requiredOption('--data <AAAA-MM-DD>', 'data do saldo inicial')
    .option('--sim', 'não pedir confirmação')
    .action((conta, valor, options) =>
      runAsync(async (db) => {
        const current = resolveAccount(db, conta);
        const amountCents = parseMoneyToCents(valor);

        if (!options.sim) {
          const reply = await confirm({
            message: `Alterar o saldo inicial de ${current.name} de ${money(
              current.initialBalanceCents,
            )} para ${money(amountCents)}?`,
            default: false,
          });
          if (!reply) {
            console.log('Ajuste cancelado.');
            return;
          }
        }

        const account = adjustInitialBalance(db, {
          account: current.name,
          amountCents,
          date: options.data,
        });
        console.log(`Saldo inicial de ${account.name} ajustado.`);
      }),
    );

  program
    .command('transferir <valor> <origem> <destino>')
    .description('Transfere um valor entre contas sem afetar receitas e despesas')
    .option('--data <AAAA-MM-DD>', 'data da transferência')
    .option('--desc <descricao>', 'descrição da transferência', 'Transferência')
    .action((valor, origem, destino, options) =>
      run((db) => {
        const result = transfer(db, {
          amountCents: parseMoneyToCents(valor),
          from: origem,
          to: destino,
          date: options.data ?? todayISO(),
          description: options.desc,
        });
        console.log(`${result.from.name} → ${result.to.name}: ${result.amountLabel}`);
      }),
    );

  program
    .command('gasto <valor> <categoria> [descricao]')
    .description('Registra uma despesa já paga')
    .option('--conta <conta>', 'conta usada no pagamento', 'conta-corrente')
    .option('--data <AAAA-MM-DD>', 'data do gasto')
    .action((valor, categoria, descricao, options) =>
      run((db) => {
        const expense = quickExpense(db, {
          amountCents: parseMoneyToCents(valor),
          category: categoria,
          description: descricao ?? categoria,
          account: options.conta,
          date: options.data ?? todayISO(),
        });
        console.log(`Gasto registrado: ${expense.description} — ${expense.amountLabel}`);
      }),
    );

  const expense = program.command('despesa').description('Despesas planejadas');

  expense
    .command('add <valor>')
    .description('Cria uma despesa prevista')
    .requiredOption('--desc <descricao>', 'descrição da despesa')
    .requiredOption('--categoria <categoria>', 'categoria da despesa')
    .option('--data <AAAA-MM-DD>', 'data do lançamento')
    .option('--vencimento <AAAA-MM-DD>', 'data de vencimento')
    .option('--conta <conta>', 'conta usada no pagamento', 'conta-corrente')
    .option('--pago', 'cria já paga')
    .action((valor, options) =>
      run((db) => {
        const transaction = addExpense(db, {
          amountCents: parseMoneyToCents(valor),
          description: options.desc,
          category: options.categoria,
          account: options.conta,
          date: options.data ?? todayISO(),
          dueDate: options.vencimento ?? null,
          status: options.pago ? 'pago' : 'previsto',
        });
        console.log(
          `${transaction.status === 'pago' ? 'Despesa paga' : 'Despesa prevista'}: ` +
            `${transaction.description} — ${transaction.amountLabel}`,
        );
      }),
    );

  const income = program.command('receita').description('Receitas planejadas');

  income
    .command('add <valor>')
    .description('Cria uma receita prevista')
    .requiredOption('--desc <descricao>', 'descrição da receita')
    .requiredOption('--categoria <categoria>', 'categoria da receita')
    .option('--data <AAAA-MM-DD>', 'data do lançamento')
    .option('--conta <conta>', 'conta de destino', 'conta-corrente')
    .option('--recebido', 'cria já recebida')
    .action((valor, options) =>
      run((db) => {
        const transaction = addIncome(db, {
          amountCents: parseMoneyToCents(valor),
          description: options.desc,
          category: options.categoria,
          account: options.conta,
          date: options.data ?? todayISO(),
          status: options.recebido ? 'recebido' : 'previsto',
        });
        console.log(
          `${transaction.status === 'recebido' ? 'Receita recebida' : 'Receita prevista'}: ` +
            `${transaction.description} — ${transaction.amountLabel}`,
        );
      }),
    );

  program
    .command('lancamentos')
    .description('Lista lançamentos do mês')
    .option('--mes <AAAA-MM>', 'mês dos lançamentos')
    .option('--status <status>', 'previsto, pago, recebido ou cancelado')
    .option('--tipo <tipo>', 'receita, despesa, transferencia ou ajuste')
    .option('--categoria <categoria>', 'filtra por categoria')
    .option('--conta <conta>', 'filtra por conta')
    .action((options) =>
      run((db) => {
        const filters = buildTransactionFilters(db, options);
        console.log(renderTransactions(listTransactionsDetailed(db, filters)));
      }),
    );

  program
    .command('editar <id>')
    .description('Edita um lançamento')
    .option('--desc <descricao>', 'nova descrição')
    .option('--valor <valor>', 'novo valor')
    .option('--data <AAAA-MM-DD>', 'nova data')
    .option('--vencimento <AAAA-MM-DD|a-definir>', 'novo vencimento')
    .option('--categoria <categoria>', 'nova categoria')
    .option('--conta <conta>', 'nova conta')
    .action((id, options) =>
      run((db) => {
        const transaction = editTransaction(db, parseId(id), buildEditFields(options));
        console.log(`Lançamento ${transaction.id} atualizado: ${transaction.description}.`);
      }),
    );

  program
    .command('remover <id>')
    .description('Remove um lançamento manual')
    .option('--sim', 'não pedir confirmação')
    .action(async (id, options) =>
      runAsync(async (db) => {
        const transactionId = parseId(id);
        if (!options.sim) {
          const reply = await confirm({
            message: `Remover o lançamento ${transactionId}?`,
            default: false,
          });
          if (!reply) {
            console.log('Remoção cancelada.');
            return;
          }
        }
        const result = removeTransaction(db, transactionId);
        console.log(`Lançamento removido: ${result.transaction.description}.`);
      }),
    );

  program
    .command('pagar <id>')
    .description('Confirma o pagamento de uma despesa')
    .option('--data <AAAA-MM-DD>', 'data do pagamento')
    .option('--valor <valor>', 'valor efetivamente pago')
    .action((id, options) =>
      run((db) => {
        const transaction = payTransaction(db, {
          id: parseId(id),
          date: options.data ?? todayISO(),
          amountCents: options.valor === undefined ? undefined : parseMoneyToCents(options.valor),
        });
        console.log(`Pago: ${transaction.description} — ${transaction.amountLabel}`);
      }),
    );

  program
    .command('receber <id>')
    .description('Confirma o recebimento de uma receita')
    .option('--data <AAAA-MM-DD>', 'data do recebimento')
    .option('--valor <valor>', 'valor efetivamente recebido')
    .action((id, options) =>
      run((db) => {
        const transaction = receiveTransaction(db, {
          id: parseId(id),
          date: options.data ?? todayISO(),
          amountCents: options.valor === undefined ? undefined : parseMoneyToCents(options.valor),
        });
        console.log(`Recebido: ${transaction.description} — ${transaction.amountLabel}`);
      }),
    );

  const monthCommand = program.command('mes').description('Planejamento mensal');

  monthCommand
    .command('abrir <mes>')
    .description('Gera os lançamentos previstos do mês de forma idempotente')
    .action((mes) =>
      run((db) => {
        const result = openMonth(db, { month: mes });
        if (result.created > 0) {
          console.log(
            `${result.created} lançamentos criados em ${mes}. Total do mês: ${result.total}.`,
          );
        } else if (result.total > 0) {
          console.log(`O mês ${mes} já estava aberto (${result.total} lançamentos).`);
        } else {
          console.log(`Nenhum lançamento previsto para ${mes}.`);
        }
      }),
    );

  const contracts = program.command('contratos').description('Contratos parcelados');

  contracts
    .command('listar')
    .description('Lista contratos, parcelas restantes e término')
    .action(() =>
      run((db) => {
        console.log(renderContracts(listContracts(db)));
      }),
    );

  contracts
    .command('editar <id>')
    .description('Edita um contrato')
    .option('--desc <descricao>', 'nova descrição')
    .option('--valor <valor>', 'novo valor da parcela')
    .option('--vencimento <dia|a-definir>', 'dia de vencimento ou a-definir')
    .option('--conta <conta>', 'nova conta')
    .option('--categoria <categoria>', 'nova categoria')
    .option('--inativo', 'desativa o contrato')
    .option('--ativo', 'reativa o contrato')
    .option('--sim', 'não pedir confirmação ao desativar')
    .action((id, options) =>
      runAsync(async (db) => {
        const fields = {};
        if (options.desc !== undefined) fields.description = options.desc;
        if (options.valor !== undefined) fields.installmentCents = parseMoneyToCents(options.valor);
        if (options.vencimento !== undefined) {
          fields.dueDay = options.vencimento === 'a-definir' ? null : Number(options.vencimento);
        }
        if (options.conta !== undefined) fields.account = options.conta;
        if (options.categoria !== undefined) fields.category = options.categoria;
        if (options.inativo) fields.active = false;
        if (options.ativo) fields.active = true;

        if (options.inativo && !options.sim) {
          const reply = await confirm({
            message: `Desativar o contrato ${id}?`,
            default: false,
          });
          if (!reply) {
            console.log('Desativação cancelada.');
            return;
          }
        }

        const contract = editContract(db, parseId(id), fields);
        console.log(`Contrato ${contract.id} atualizado: ${contract.description}.`);
      }),
    );

  program
    .command('previsao')
    .description('Projeta um mês sem gravar lançamentos')
    .option('--mes <AAAA-MM>', 'mês da previsão')
    .action((options) =>
      run((db) => {
        console.log(renderForecast(forecastMonth(db, { month: formatCurrentMonth(options.mes) })));
      }),
    );

  program
    .command('resumo')
    .description('Mostra o resumo do mês')
    .option('--mes <AAAA-MM>', 'mês do resumo')
    .action((options) =>
      run((db) => {
        console.log(renderMonthlySummary(monthlyReport(db, { month: formatCurrentMonth(options.mes) })));
      }),
    );

  program
    .command('categorias')
    .description('Mostra gastos por categoria')
    .option('--mes <AAAA-MM>', 'mês do relatório')
    .action((options) =>
      run((db) => {
        console.log(renderCategories(categoryReport(db, { month: formatCurrentMonth(options.mes) })));
      }),
    );

  program
    .command('evolucao')
    .description('Mostra a evolução dos últimos meses')
    .option('--meses <quantidade>', 'quantidade de meses', '6')
    .option('--mes <AAAA-MM>', 'mês final da série')
    .action((options) =>
      run((db) => {
        const rows = evolutionReport(db, {
          months: Number(options.meses),
          month: formatCurrentMonth(options.mes),
        });
        console.log(renderEvolution(rows));
      }),
    );

  program
    .command('semana')
    .description('Mostra a semana corrente e as pendências dos próximos dias')
    .option('--data <AAAA-MM-DD>', 'data de referência')
    .action((options) =>
      run((db) => {
        console.log(renderWeek(weekReport(db, { today: options.data ?? todayISO() })));
      }),
    );

  program
    .command('meta')
    .description('Mostra o progresso da meta do cofrinho')
    .action(() =>
      run((db) => {
        console.log(renderGoal(goalProgress(db)));
      }),
    );

  const simulate = program.command('simular').description('Simulações sem gravar dados');

  simulate
    .command('moto')
    .description('Simula a compra da moto com entrada e parcelas')
    .option('--entrada <valor>', 'valor da entrada')
    .option('--parcela <valor>', 'valor da parcela')
    .option('--parcelas <quantidade>', 'quantidade de parcelas')
    .option('--mes <AAAA-MM>', 'mês da compra')
    .option('--aporte <valor>', 'aporte mensal durante a simulação')
    .action((options) =>
      run((db) => {
        const simulation = motorcycleSimulation(
          db,
          {
            entryCents: options.entrada === undefined ? undefined : parseMoneyToCents(options.entrada),
            installmentCents:
              options.parcela === undefined ? undefined : parseMoneyToCents(options.parcela),
            installments: options.parcelas === undefined ? undefined : Number(options.parcelas),
            purchaseMonth: options.mes,
            contributionCents:
              options.aporte === undefined ? undefined : parseMoneyToCents(options.aporte),
          },
          { today: todayISO() },
        );
        console.log(renderSimulation(simulation));
      }),
    );

  program.action(async () => {
    const db = openInitializedDatabase();
    try {
      await runMenu({ db });
    } finally {
      db.close();
    }
  });

  return program;
}

export async function main(argv = process.argv) {
  try {
    await buildProgram().parseAsync(argv);
  } catch (error) {
    console.error(`Erro: ${error.message}`);
    process.exitCode = 1;
  }
}
