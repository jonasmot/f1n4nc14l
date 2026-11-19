export class DomainError extends Error {
  constructor(message, code = 'DOMAIN_ERROR') {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function assert(condition, message, code) {
  if (!condition) {
    throw new DomainError(message, code);
  }
}
