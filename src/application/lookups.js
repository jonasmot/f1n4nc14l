import { DomainError } from '../domain/errors.js';
import { listAccounts } from '../infrastructure/repositories/accounts.js';
import { listCategories } from '../infrastructure/repositories/categories.js';

const ACCOUNT_ALIASES = {
  corrente: 'conta-corrente',
  conta: 'conta-corrente',
  'conta-corrente': 'conta-corrente',
  carteira: 'carteira',
  dinheiro: 'carteira',
  cofrinho: 'cofrinho',
  poupanca: 'cofrinho',
  va: 'flash-va',
  'flash-va': 'flash-va',
  vt: 'flash-vt',
  'flash-vt': 'flash-vt',
};

const CATEGORY_ALIASES = {
  salario: 'salario',
  '13': '13o',
  '13o': '13o',
  decimo: '13o',
  'decimo-terceiro': '13o',
  mercado: 'mercado',
  alimentacao: 'alimentacao',
  refeicoes: 'refeicoes',
  refeicao: 'refeicoes',
  lazer: 'lazer',
  outros: 'outros',
  energia: 'energia',
  internet: 'internet',
  contratos: 'contratos',
  contrato: 'contratos',
  moradia: 'moradia',
  'beneficio-va': 'beneficio-va',
  'beneficio-vt': 'beneficio-vt',
};

export function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/º/g, 'o')
    .replace(/\s+/g, '-');
}

export function resolveAccount(db, identifier, { fallback = null } = {}) {
  const accounts = listAccounts(db);
  const wanted = identifier ?? fallback;

  if (!wanted) {
    throw new DomainError('Informe uma conta.', 'ACCOUNT_REQUIRED');
  }

  const alias = ACCOUNT_ALIASES[normalizeKey(wanted)] ?? normalizeKey(wanted);
  const found = accounts.find(
    (account) => account.name === wanted || normalizeKey(account.name) === alias,
  );

  if (!found) {
    throw new DomainError(
      `Conta "${wanted}" não encontrada. Contas disponíveis: ${accounts.map((account) => account.name).join(', ')}.`,
      'ACCOUNT_NOT_FOUND',
    );
  }

  return found;
}

export function resolveCategory(db, identifier, type) {
  const categories = listCategories(db, { type });
  const wanted = identifier;

  if (!wanted) {
    throw new DomainError('Informe uma categoria.', 'CATEGORY_REQUIRED');
  }

  const key = normalizeKey(wanted);
  const alias = CATEGORY_ALIASES[key] ?? key;
  const found = categories.find(
    (category) => normalizeKey(category.name) === key || normalizeKey(category.name) === alias,
  );

  if (!found) {
    throw new DomainError(
      `Categoria de ${type} "${wanted}" não encontrada. Disponíveis: ${categories
        .map((category) => normalizeKey(category.name))
        .join(', ')}.`,
      'CATEGORY_NOT_FOUND',
    );
  }

  return found;
}

export function resolveCategoryAny(db, identifier) {
  const categories = listCategories(db);
  const wanted = identifier;

  if (!wanted) {
    throw new DomainError('Informe uma categoria.', 'CATEGORY_REQUIRED');
  }

  const key = normalizeKey(wanted);
  const alias = CATEGORY_ALIASES[key] ?? key;
  const found = categories.find(
    (category) => normalizeKey(category.name) === key || normalizeKey(category.name) === alias,
  );

  if (!found) {
    throw new DomainError(
      `Categoria "${wanted}" não encontrada. Disponíveis: ${categories
        .map((category) => normalizeKey(category.name))
        .join(', ')}.`,
      'CATEGORY_NOT_FOUND',
    );
  }

  return found;
}
