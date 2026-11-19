import { addMonths, compareMonths, dateAtDay, diffMonths, lastDayOfMonth, splitMonth } from './dates.js';
import { holidaySet, nthBusinessDay } from './business-days.js';
import { hasInstallmentInMonth } from './schedule.js';

export function ruleOccursInMonth(rule, month) {
  if (!rule.active) return false;
  if (compareMonths(month, rule.startMonth) < 0) return false;
  if (rule.endMonth && compareMonths(month, rule.endMonth) > 0) return false;
  if (rule.frequency === 'anual' && splitMonth(month).month !== rule.monthOfYear) return false;
  return true;
}

export function ruleOccurrence(rule, month, holidays = holidaySet()) {
  if (!ruleOccursInMonth(rule, month)) return null;

  let date = dateAtDay(month, 1);
  let dueDate = null;

  if (rule.dayRule === 'fixed') {
    date = dateAtDay(month, rule.dayValue);
    dueDate = date;
  } else if (rule.dayRule === 'business_day') {
    date = nthBusinessDay(month, rule.dayValue, holidays) ?? lastDayOfMonth(month);
    dueDate = date;
  } else if (rule.dayRule === 'last_day') {
    date = lastDayOfMonth(month);
    dueDate = date;
  }

  const type = rule.direction === 'saida' ? 'despesa' : 'receita';
  const status = rule.direction === 'beneficio' ? 'recebido' : 'previsto';

  return {
    month,
    date,
    dueDate,
    type,
    amountCents: rule.amountCents,
    accountId: rule.accountId,
    categoryId: rule.categoryId,
    description: rule.description,
    status,
    paidAt: status === 'recebido' ? date : null,
    origin: 'recorrencia',
    originId: rule.id,
  };
}

export function contractOccurrence(plan, month) {
  if (!plan.active || !hasInstallmentInMonth(plan, month)) return null;

  const number = plan.paidBeforeStart + diffMonths(plan.nextMonth, month) + 1;
  const dueDate = plan.dueDay ? dateAtDay(month, plan.dueDay) : null;
  const date = dueDate ?? dateAtDay(month, 1);

  return {
    month,
    date,
    dueDate,
    type: 'despesa',
    amountCents: plan.installmentCents,
    accountId: plan.accountId,
    categoryId: plan.categoryId,
    description: `${plan.description} (${number}/${plan.totalInstallments})`,
    status: 'previsto',
    paidAt: null,
    origin: 'contrato',
    originId: plan.id,
    notes: `Parcela ${number}/${plan.totalInstallments}`,
  };
}

export function nextOccurrenceMonths(rule, { count = 1, fromMonth }) {
  const months = [];
  let month = fromMonth;

  while (months.length < count) {
    if (ruleOccursInMonth(rule, month)) months.push(month);
    month = addMonths(month, 1);
  }

  return months;
}
