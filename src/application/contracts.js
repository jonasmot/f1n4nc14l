import { DomainError } from '../domain/errors.js';
import {
  contractEndMonth,
  remainingInstallments,
} from '../domain/schedule.js';
import {
  getInstallmentPlan,
  listInstallmentPlans,
  updateInstallmentPlan,
} from '../infrastructure/repositories/contracts.js';
import { resolveAccount, resolveCategory } from './lookups.js';

function paidCountsByContract(db) {
  const rows = db
    .prepare(`
      SELECT origin_id, COUNT(*) AS total
      FROM transactions
      WHERE origin = 'contrato' AND status = 'pago' AND origin_id IS NOT NULL
      GROUP BY origin_id
    `)
    .all();

  return new Map(rows.map((row) => [row.origin_id, row.total]));
}

export function listContracts(db, { activeOnly = false } = {}) {
  const paidCounts = paidCountsByContract(db);

  return listInstallmentPlans(db, { activeOnly }).map((plan) => {
    const scheduled = remainingInstallments(plan);
    const paidInstallments = paidCounts.get(plan.id) ?? 0;
    const remaining = Math.max(0, scheduled - paidInstallments);

    return {
      ...plan,
      paidInstallments,
      remainingInstallments: remaining,
      remainingCents: remaining * plan.installmentCents,
      endMonth: contractEndMonth(plan),
    };
  });
}

export function getContractOrFail(db, id) {
  const plan = getInstallmentPlan(db, id);
  if (!plan) {
    throw new DomainError(`Contrato ${id} não encontrado.`, 'CONTRACT_NOT_FOUND');
  }
  return plan;
}

export function editContract(db, id, fields = {}) {
  const plan = getContractOrFail(db, id);
  const updates = {};

  if (fields.description !== undefined) {
    if (!String(fields.description).trim()) {
      throw new DomainError('Informe uma descrição para o contrato.', 'DESCRIPTION_REQUIRED');
    }
    updates.description = String(fields.description).trim();
  }

  if (fields.installmentCents !== undefined) {
    if (!Number.isInteger(fields.installmentCents) || fields.installmentCents <= 0) {
      throw new DomainError('O valor da parcela deve ser maior que zero.', 'INVALID_AMOUNT');
    }
    updates.installmentCents = fields.installmentCents;
  }

  if (fields.dueDay !== undefined) {
    if (fields.dueDay === null) {
      updates.dueDay = null;
    } else if (!Number.isInteger(fields.dueDay) || fields.dueDay < 1 || fields.dueDay > 31) {
      throw new DomainError('O dia de vencimento deve estar entre 1 e 31.', 'INVALID_DUE_DAY');
    } else {
      updates.dueDay = fields.dueDay;
    }
  }

  if (fields.account !== undefined) {
    updates.accountId = resolveAccount(db, fields.account).id;
  }

  if (fields.category !== undefined) {
    updates.categoryId = resolveCategory(db, fields.category, 'despesa').id;
  }

  if (fields.active !== undefined) {
    updates.active = Boolean(fields.active);
  }

  if (Object.keys(updates).length === 0) {
    throw new DomainError('Nenhum campo para editar.', 'NOTHING_TO_UPDATE');
  }

  updateInstallmentPlan(db, plan.id, updates);
  return listContracts(db).find((contract) => contract.id === plan.id);
}
