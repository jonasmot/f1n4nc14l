import { DomainError } from './errors.js';

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Converte um valor em reais para centavos inteiros.
 * Aceita "25", "25.90", "25,90" e "1.234,56".
 * Valores negativos, vazios ou com mais de duas casas decimais são rejeitados.
 */
export function parseMoneyToCents(value) {
  if (value === null || value === undefined) {
    throw new DomainError('Informe um valor em reais.', 'INVALID_MONEY');
  }

  let text;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new DomainError('Informe um valor em reais válido.', 'INVALID_MONEY');
    }
    text = String(value);
  } else {
    text = String(value);
  }

  text = text.trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '');

  if (text === '') {
    throw new DomainError('Informe um valor em reais.', 'INVALID_MONEY');
  }

  if (text.startsWith('-')) {
    throw new DomainError('O valor não pode ser negativo.', 'INVALID_MONEY');
  }

  let normalized;
  if (text.includes(',')) {
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = text;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new DomainError(
      'Valor inválido. Use, por exemplo, 25,90 ou 1234.56.',
      'INVALID_MONEY',
    );
  }

  const [integerPart, decimalPart = ''] = normalized.split('.');
  const cents = decimalPart.padEnd(2, '0');
  return Number(integerPart) * 100 + Number(cents);
}

export function formatMoney(cents) {
  if (!Number.isInteger(cents)) {
    throw new DomainError('O valor em centavos deve ser inteiro.', 'INVALID_CENTS');
  }
  return BRL.format(cents / 100);
}

export function formatCentsAsInput(cents) {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  return `${sign}${Math.floor(absolute / 100)},${String(absolute % 100).padStart(2, '0')}`;
}

export function sumCents(values) {
  return values.reduce((total, value) => total + value, 0);
}
