import { confirm, input, select } from '@inquirer/prompts';
import { addMonths, todayISO } from '../domain/dates.js';
import { parseMoneyToCents } from '../domain/money.js';
import { listAccountsWithBalances } from '../application/accounts.js';
import { listContracts } from '../application/contracts.js';
import { goalProjection, goalProgress, motorcycleSimulation } from '../application/goals.js';
import { forecastMonth } from '../application/planning.js';
import { monthlyReport, weekReport } from '../application/reports.js';
import {
  addIncome,
  listTransactionsDetailed,
  payTransaction,
  quickExpense,
} from '../application/transactions.js';
import {
  renderContracts,
  renderForecast,
  renderMenuHeader,
  renderMonthlySummary,
  renderSimulation,
  renderTransactions,
  renderWeek,
} from './render.js';

export const defaultMenuPrompts = {
  select: (config) => select(config),
  input: (config) => input(config),
  confirm: (config) => confirm(config),
};

const MENU_CHOICES = [
  { name: 'Novo gasto', value: 'gasto' },
  { name: 'Nova receita', value: 'receita' },
  { name: 'Ver mês', value: 'mes' },
  { name: 'Ver semana', value: 'semana' },
  { name: 'Pagar pendência', value: 'pagar' },
  { name: 'Contratos', value: 'contratos' },
  { name: 'Meta e projeção', value: 'meta' },
  { name: 'Previsão do próximo mês', value: 'previsao' },
  { name: 'Simulação da moto', value: 'simulacao' },
  { name: 'Sair', value: 'sair' },
];

export async function runMenu({ db, today = todayISO(), output = console.log, prompts = defaultMenuPrompts } = {}) {
  let running = true;

  while (running) {
    const month = today.slice(0, 7);
    const report = monthlyReport(db, { month, today });
    const accounts = listAccountsWithBalances(db, { month, today });
    const week = weekReport(db, { today });
    output(renderMenuHeader(report, accounts, week));

    const action = await prompts.select({
      message: 'O que você quer fazer?',
      choices: MENU_CHOICES,
    });

    try {
      running = await handleMenuAction(action, { db, today, prompts, output });
    } catch (error) {
      output(`Erro: ${error.message}`);
    }
  }
}

async function handleMenuAction(action, { db, today, prompts, output }) {
  const month = today.slice(0, 7);

  switch (action) {
    case 'gasto': {
      const amountCents = parseMoneyToCents(await prompts.input({ message: 'Valor (R$):' }));
      const category = await prompts.input({ message: 'Categoria:' });
      const description = await prompts.input({ message: 'Descrição:' });
      const expense = quickExpense(db, { amountCents, category, description, date: today });
      output(`Gasto registrado: ${expense.description} — ${expense.amountLabel}`);
      return true;
    }

    case 'receita': {
      const amountCents = parseMoneyToCents(await prompts.input({ message: 'Valor (R$):' }));
      const category = await prompts.input({ message: 'Categoria:' });
      const description = await prompts.input({ message: 'Descrição:' });
      const received = await prompts.confirm({ message: 'Já foi recebida?', default: false });
      const income = addIncome(db, {
        amountCents,
        category,
        description,
        date: today,
        status: received ? 'recebido' : 'previsto',
      });
      output(`Receita registrada: ${income.description} — ${income.amountLabel}`);
      return true;
    }

    case 'mes': {
      const report = monthlyReport(db, { month, today });
      output(renderMonthlySummary(report));
      output('');
      output(renderTransactions(listTransactionsDetailed(db, { month })));
      return true;
    }

    case 'semana': {
      output(renderWeek(weekReport(db, { today })));
      return true;
    }

    case 'pagar': {
      const pending = listTransactionsDetailed(db, {
        month,
        status: 'previsto',
        type: 'despesa',
      });

      if (pending.length === 0) {
        output('Nenhuma despesa prevista em aberto neste mês.');
        return true;
      }

      const id = await prompts.select({
        message: 'Qual despesa você pagou?',
        choices: pending.map((transaction) => ({
          name: `${transaction.description} — ${transaction.amountLabel} (${transaction.accountName})`,
          value: transaction.id,
        })),
      });

      const paid = payTransaction(db, { id, date: today });
      output(`Pago: ${paid.description} — ${paid.amountLabel}`);
      return true;
    }

    case 'contratos': {
      output(renderContracts(listContracts(db)));
      return true;
    }

    case 'meta': {
      output(renderGoal(goalProgress(db, { today }), goalProjection(db, { today })));
      return true;
    }

    case 'previsao': {
      const nextMonth = addMonths(month, 1);
      output(renderForecast(forecastMonth(db, { month: nextMonth, today })));
      return true;
    }

    case 'simulacao': {
      output(renderSimulation(motorcycleSimulation(db, {}, { today })));
      return true;
    }

    case 'sair':
      return false;

    default:
      output('Opção desconhecida.');
      return true;
  }
}
