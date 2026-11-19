-- Corrige a CNH para R$ 100,00 e recalcula a meta da moto e o aporte mensal.
-- Protegido pelos valores anteriores para não sobrescrever ajustes já feitos pelo usuário.

UPDATE goals
SET target_cents = 488000,
    target_month = '2027-03',
    monthly_contribution_cents = 85000
WHERE id = 1
  AND name = 'Moto'
  AND target_cents = 628000
  AND target_month = '2027-03'
  AND monthly_contribution_cents = 120000;
