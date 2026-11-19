import { addMonths, diffMonths, dateAtDay, compareMonths } from './dates.js';

export function remainingInstallments(plan) {
  return Math.max(0, plan.totalInstallments - plan.paidBeforeStart);
}

export function contractEndMonth(plan) {
  const remaining = remainingInstallments(plan);
  if (remaining === 0) return null;
  return addMonths(plan.nextMonth, remaining - 1);
}

export function contractRemainingCents(plan) {
  return remainingInstallments(plan) * plan.installmentCents;
}

export function contractSchedule(plan) {
  const remaining = remainingInstallments(plan);
  const schedule = [];

  for (let index = 0; index < remaining; index += 1) {
    const month = addMonths(plan.nextMonth, index);
    schedule.push({
      number: plan.paidBeforeStart + index + 1,
      month,
      dueDate: plan.dueDay ? dateAtDay(month, plan.dueDay) : null,
    });
  }

  return schedule;
}

export function hasInstallmentInMonth(plan, month) {
  if (!plan.active) return false;
  const start = plan.nextMonth;
  const end = contractEndMonth(plan);
  if (!end) return false;
  return compareMonths(month, start) >= 0 && compareMonths(month, end) <= 0;
}

export function installmentsForMonth(plans, month) {
  return plans
    .filter((plan) => hasInstallmentInMonth(plan, month))
    .map((plan) => ({
      plan,
      month,
      number: plan.paidBeforeStart + diffMonths(plan.nextMonth, month) + 1,
    }));
}

export function totalRemainingCents(plans) {
  return plans.reduce((total, plan) => total + contractRemainingCents(plan), 0);
}
