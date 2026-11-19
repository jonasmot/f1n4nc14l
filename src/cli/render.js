import {
  benefitLabel,
  date,
  labelValue,
  money,
  month,
  percent,
  renderTable,
  signedMoney,
} from './format.js';

function line(label, value, width = 22) {
  return labelValue(label, value, width);
}

function expenseMoney(cents) {
  return money(cents === 0 ? 0 : -cents);
}

export function renderAccounts(accounts) {
  const rows = accounts.map((account) => [
    account.name,
    account.type,
    money(account.balanceCents),
    account.type === 'beneficio' ? account.balanceScope : 'atual',
  ]);
  return renderTable(['Conta', 'Tipo', 'Saldo', 'Referência'], rows, ['left', 'left', 'right', 'left']);
}

export function renderTransactions(transactions) {
  if (transactions.length === 0) return 'Nenhum lançamento encontrado.';

  const rows = transactions.map((transaction) => [
    transaction.id,
    date(transaction.date),
    transaction.description,
    transaction.categoryName ?? '-',
    transaction.accountName,
    signedMoney(transaction.type, transaction.amountCents),
    transaction.statusLabel,
  ]);

  return renderTable(
    ['ID', 'Data', 'Descrição', 'Categoria', 'Conta', 'Valor', 'Status'],
    rows,
    ['right', 'left', 'left', 'left', 'left', 'right', 'left'],
  );
}

export function renderMonthlySummary(report) {
  const lines = [
    `Resumo de ${month(report.month)}`,
    '',
    line('Receitas previstas', money(report.incomePlannedCents)),
    line('Receitas realizadas', money(report.incomeRealizedCents)),
    line('Despesas previstas', money(report.expensePlannedCents)),
    line('Despesas realizadas', money(report.expenseRealizedCents)),
    line('Fluxo previsto', money(report.flowPlannedCents)),
    line('Fluxo realizado', money(report.flowRealizedCents)),
    line('Aporte planejado', money(report.plannedContributionCents)),
    line('Disponível após aporte', money(report.availableAfterContributionCents)),
    '',
    line('Caixa', money(report.cashBalanceCents)),
    line('Cofrinho', money(report.savingsBalanceCents)),
  ];

  for (const benefit of report.benefits) {
    lines.push(line(benefitLabel(benefit.name), money(benefit.balanceCents)));
  }

  lines.push(line('Contratos restantes', money(report.contractRemainingCents)));
  return lines.join('\n');
}

export function renderForecast(forecast) {
  const lines = [
    `Previsão de ${month(forecast.targetMonth)}`,
    '',
    line('Receitas previstas', money(forecast.incomePlannedCents)),
    line('Contas fixas', expenseMoney(forecast.fixedExpensePlannedCents)),
    line('Contratos', expenseMoney(forecast.contractExpensePlannedCents)),
    line('Outros', expenseMoney(forecast.otherExpensePlannedCents)),
    line('Despesas previstas', money(forecast.expensePlannedCents)),
    line('Fluxo previsto', money(forecast.flowPlannedCents)),
    line('Aporte planejado', money(forecast.plannedContributionCents)),
    line('Disponível após aporte', money(forecast.availableAfterContributionCents)),
    line('Saldo projetado', money(forecast.projectedBalanceCents)),
    line('Cofrinho projetado', money(forecast.projectedSavingsCents)),
  ];

  return lines.join('\n');
}

export function renderCategories(report) {
  const sections = [`Categorias de ${month(report.month)}`, ''];

  if (report.cash.rows.length === 0) {
    sections.push('Sem despesas no caixa.');
  } else {
    const rows = report.cash.rows.map((row) => [
      row.name,
      money(row.totalCents),
      percent(row.percentage),
    ]);
    rows.push(['Total', money(report.cash.grandTotalCents), percent(100)]);
    sections.push(renderTable(['Categoria', 'Total', '%'], rows, ['left', 'right', 'right']));
  }

  sections.push('', 'Benefícios (fora do caixa)');

  if (report.benefits.rows.length === 0) {
    sections.push('Sem gastos com benefícios.');
  } else {
    const rows = report.benefits.rows.map((row) => [
      row.name,
      money(row.totalCents),
      percent(row.percentage),
    ]);
    rows.push(['Total', money(report.benefits.grandTotalCents), percent(100)]);
    sections.push(renderTable(['Categoria', 'Total', '%'], rows, ['left', 'right', 'right']));
  }

  return sections.join('\n');
}

export function renderEvolution(rows) {
  if (rows.length === 0) return 'Sem dados de evolução.';

  const table = rows.map((row) => [
    row.label,
    money(row.incomeCents),
    money(row.expenseCents),
    money(row.flowCents),
    money(row.savingsBalanceCents),
  ]);

  return renderTable(
    ['Mês', 'Receitas', 'Despesas', 'Fluxo', 'Cofrinho'],
    table,
    ['left', 'right', 'right', 'right', 'right'],
  );
}

export function renderWeek(week) {
  const lines = [
    `Semana ${date(week.start)} a ${date(week.end)}`,
    '',
    line('Gastos da semana', money(week.expenseCents)),
    line('Gastos com benefícios', money(week.benefitExpenseCents)),
    line('Fluxo previsto do mês', money(week.flowPlannedCents)),
    line('Disponível após aporte', money(week.availableAfterContributionCents)),
    '',
  ];

  for (const benefit of week.benefits) {
    lines.push(line(benefitLabel(benefit.name), money(benefit.balanceCents)));
  }

  lines.push('', 'Gastos');

  if (week.expenses.length === 0) {
    lines.push('Nenhum gasto registrado nesta semana.');
  } else {
    lines.push(
      renderTable(
        ['Data', 'Descrição', 'Categoria', 'Conta', 'Valor'],
        week.expenses.map((expense) => [
          date(expense.date),
          expense.description,
          expense.categoryName,
          expense.accountName,
          signedMoney(expense.type, expense.amountCents),
        ]),
        ['left', 'left', 'left', 'left', 'right'],
      ),
    );
  }

  if (week.benefitExpenses.length > 0) {
    lines.push('', 'Gastos com benefícios');
    lines.push(
      renderTable(
        ['Data', 'Descrição', 'Categoria', 'Conta', 'Valor'],
        week.benefitExpenses.map((expense) => [
          date(expense.date),
          expense.description,
          expense.categoryName,
          expense.accountName,
          signedMoney(expense.type, expense.amountCents),
        ]),
        ['left', 'left', 'left', 'left', 'right'],
      ),
    );
  }

  lines.push('', 'Próximos 7 dias');

  if (week.upcoming.length === 0) {
    lines.push('Nenhuma pendência nos próximos sete dias.');
  } else {
    lines.push(
      renderTable(
        ['Data', 'Descrição', 'Valor', 'Status'],
        week.upcoming.map((item) => [
          date(item.effectiveDate),
          item.description,
          signedMoney(item.type, item.amountCents),
          item.status,
        ]),
        ['left', 'left', 'right', 'left'],
      ),
    );
  }

  return lines.join('\n');
}

export function renderGoal(progress, projection = null) {
  const lines = [
    `Meta: ${progress.goal.name}`,
    '',
    line('Alvo', `${money(progress.targetCents)} (${month(progress.goal.targetMonth)})`),
    line('Saldo no cofrinho', money(progress.balanceCents)),
    line('Progresso', percent(progress.percentage)),
    line('Falta', money(progress.remainingCents)),
    line('Aporte planejado', `${money(progress.monthlyContributionCents)}/mês`),
    line('Meses até o alvo', String(progress.monthsUntilTarget)),
  ];

  if (progress.achieved) {
    lines.push(line('Situação', 'meta atingida'));
  } else if (progress.monthsToReach === null) {
    lines.push(line('Situação', 'sem aporte planejado'));
  } else {
    lines.push(
      line(
        'No ritmo atual',
        `${progress.monthsToReach} ${progress.monthsToReach === 1 ? 'mês' : 'meses'} (${month(progress.projectedMonth)})`,
      ),
    );
    lines.push(line('Situação', progress.behindSchedule ? 'atrás do prazo' : 'dentro do prazo'));
  }

  lines.push(line('Aportes registrados', money(progress.contributionsCents)));
  lines.push(line('Retiradas registradas', money(progress.withdrawalsCents)));

  if (projection && projection.months.length > 0) {
    lines.push('', `Projeção até ${month(projection.targetMonth)}`, '');

    const rows = projection.months.map((row) => [
      month(row.month),
      money(row.incomeCents),
      expenseMoney(row.fixedExpenseCents),
      expenseMoney(row.contractExpenseCents),
      expenseMoney(row.otherExpenseCents),
      money(row.availableCents),
      money(row.contributionCents),
      money(row.remainderCents),
      money(row.savingsBalanceCents),
    ]);

    rows.push([
      'Total',
      money(projection.totalIncomeCents),
      expenseMoney(projection.totalFixedExpenseCents),
      expenseMoney(projection.totalContractExpenseCents),
      expenseMoney(projection.totalOtherExpenseCents),
      money(projection.totalAvailableCents),
      money(projection.totalContributionCents),
      money(projection.totalRemainderCents),
      '-',
    ]);

    lines.push(
      renderTable(
        ['Mês', 'Entradas', 'Fixas', 'Contratos', 'Outros', 'Disponível', 'Aporte', 'Sobra', 'Cofrinho'],
        rows,
        ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'],
      ),
    );

    const remaining = projection.projectedSavingsCents - projection.goal.targetCents;
    lines.push('');
    lines.push(
      line(
        'Compra em',
        `${month(projection.targetMonth)}: ${money(projection.goal.targetCents)}`,
      ),
    );
    lines.push(
      remaining >= 0
        ? line('Sobra após a compra', money(remaining))
        : line('Falta para a compra', money(Math.abs(remaining))),
    );
  }

  return lines.join('\n');
}

export function renderSimulation(simulation) {
  const restante =
    simulation.remainingSavingsCents >= 0
      ? line('Restante', money(simulation.remainingSavingsCents))
      : line('Falta', money(Math.abs(simulation.remainingSavingsCents)));

  const lines = [
    'Simulação da moto',
    '',
    line(
      'Compra em',
      `${month(simulation.purchaseMonth)} (${simulation.monthsUntilPurchase} aportes)`,
    ),
    line('Cofrinho projetado', money(simulation.projectedSavingsCents)),
    '',
    line('CNH', money(simulation.cnhCents)),
    line('Entrada', money(simulation.entryCents)),
    line('1ª parcela', money(simulation.installmentCents)),
    line('Capacete', money(simulation.helmetCents)),
    line('Total do desembolso', money(simulation.purchaseOutlayCents)),
    restante,
    '',
    line('Parcela', `${money(simulation.installmentCents)} × ${simulation.installments}`),
    line('Total financiado', money(simulation.totalFinancedCents)),
    line('Entrada + parcelas', money(simulation.totalPurchaseCents)),
    line('Fluxo pós-compra', money(simulation.monthlyFlowCents)),
  ];

  if (simulation.contractsCents > 0) {
    lines.push(
      line(
        'Contratos ativos',
        `${money(simulation.contractsCents)}/mês até ${
          simulation.lastContractMonth ? month(simulation.lastContractMonth) : 'o fim'
        }`,
      ),
    );
    lines.push(line('Fluxo após contratos', money(simulation.steadyFlowCents)));
  }

  lines.push(line('Com aporte mantido', money(simulation.flowWithContributionCents)));
  lines.push(line('Última parcela', month(simulation.lastInstallmentMonth)));
  let coverageLabel;
  if (simulation.coverageMonths === null) {
    coverageLabel = simulation.remainingSavingsCents >= 0 ? 'sem déficit mensal' : 'restante insuficiente';
  } else if (simulation.coverageMonths === 0) {
    coverageLabel = 'menos de 1 mês';
  } else {
    coverageLabel = `${simulation.coverageMonths} ${
      simulation.coverageMonths === 1 ? 'mês' : 'meses'
    }`;
  }

  lines.push(line('Cobertura do restante', coverageLabel));

  return lines.join('\n');
}

export function renderContracts(contracts) {
  if (contracts.length === 0) return 'Nenhum contrato cadastrado.';

  const rows = contracts.map((contract) => [
    contract.description,
    money(contract.installmentCents),
    contract.remainingInstallments,
    money(contract.remainingCents),
    contract.endMonth ? month(contract.endMonth) : '-',
    contract.dueDay ? `dia ${contract.dueDay}` : 'a definir',
    contract.active ? 'ativo' : 'inativo',
  ]);

  const total = contracts.reduce((sum, contract) => sum + contract.remainingCents, 0);
  rows.push(['Total', '-', '-', money(total), '-', '-', '-']);

  return renderTable(
    ['Contrato', 'Parcela', 'Restantes', 'Falta', 'Término', 'Vencimento', 'Situação'],
    rows,
    ['left', 'right', 'right', 'right', 'left', 'left', 'left'],
  );
}

export function renderMenuHeader(report, accounts, week) {
  const byName = Object.fromEntries(accounts.map((account) => [account.name, account]));
  const benefitLine = report.benefits
    .map((benefit) => `${benefitLabel(benefit.name)} ${money(benefit.balanceCents)}`)
    .join('  ');

  return [
    `Finanças — ${month(report.month)}`,
    '',
    line('Receitas previstas', money(report.incomePlannedCents)),
    line('Despesas previstas', money(report.expensePlannedCents)),
    line('Disponível após aporte', money(report.availableAfterContributionCents)),
    line('Conta corrente', money(byName['conta-corrente']?.balanceCents ?? 0)),
    line('Cofrinho', money(byName.cofrinho?.balanceCents ?? 0)),
    line('VA/VT', benefitLine || '-'),
    line('Gastos da semana', money(week.expenseCents)),
  ].join('\n');
}
