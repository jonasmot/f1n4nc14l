-- Revisa o plano da moto para março/2027 e o saldo inicial do cofrinho.
-- Protegido pelos valores antigos para não sobrescrever ajustes já feitos pelo usuário.

UPDATE accounts
SET initial_balance_cents = 150000
WHERE id = 3
  AND type = 'cofrinho'
  AND initial_balance_cents = 170000;

UPDATE goals
SET target_cents = 628000,
    target_month = '2027-03',
    monthly_contribution_cents = 120000
WHERE id = 1
  AND name = 'Moto'
  AND target_cents = 350000
  AND target_month = '2028-03'
  AND monthly_contribution_cents = 80000;
