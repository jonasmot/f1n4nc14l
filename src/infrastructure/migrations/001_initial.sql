CREATE TABLE accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('corrente', 'carteira', 'cofrinho', 'beneficio')),
  initial_balance_cents INTEGER NOT NULL DEFAULT 0,
  initial_balance_date TEXT NOT NULL,
  spendable INTEGER NOT NULL DEFAULT 1 CHECK (spendable IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE UNIQUE INDEX idx_categories_unique
  ON categories (name, type, COALESCE(parent_id, 0));

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL CHECK (month GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  date TEXT NOT NULL,
  due_date TEXT,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa', 'transferencia', 'ajuste')),
  amount_cents INTEGER NOT NULL CHECK (
    (type = 'ajuste' AND amount_cents <> 0) OR
    (type <> 'ajuste' AND amount_cents > 0)
  ),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  counter_account_id INTEGER REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'previsto' CHECK (status IN ('previsto', 'pago', 'recebido', 'cancelado')),
  paid_at TEXT,
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'recorrencia', 'contrato', 'seed')),
  origin_id INTEGER,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (type <> 'transferencia' OR counter_account_id IS NOT NULL),
  CHECK (type <> 'transferencia' OR account_id <> counter_account_id)
);

CREATE UNIQUE INDEX idx_transactions_generated
  ON transactions (origin, origin_id, month)
  WHERE origin <> 'manual';

CREATE INDEX idx_transactions_month ON transactions (month);
CREATE INDEX idx_transactions_status ON transactions (status);
CREATE INDEX idx_transactions_account ON transactions (account_id);
CREATE INDEX idx_transactions_category ON transactions (category_id);

CREATE TABLE recurring_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  direction TEXT NOT NULL CHECK (direction IN ('entrada', 'saida', 'beneficio')),
  frequency TEXT NOT NULL CHECK (frequency IN ('mensal', 'anual')),
  day_rule TEXT NOT NULL CHECK (day_rule IN ('fixed', 'business_day', 'last_day', 'undefined')),
  day_value INTEGER,
  month_of_year INTEGER CHECK (month_of_year IS NULL OR (month_of_year BETWEEN 1 AND 12)),
  start_month TEXT NOT NULL,
  end_month TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (description, account_id, direction)
);

CREATE TABLE installment_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL UNIQUE,
  installment_cents INTEGER NOT NULL CHECK (installment_cents > 0),
  total_installments INTEGER NOT NULL CHECK (total_installments > 0),
  paid_before_start INTEGER NOT NULL DEFAULT 0 CHECK (
    paid_before_start >= 0 AND paid_before_start <= total_installments
  ),
  next_month TEXT NOT NULL,
  due_day INTEGER CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  category_id INTEGER REFERENCES categories(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  target_month TEXT NOT NULL,
  monthly_contribution_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_contribution_cents >= 0),
  start_month TEXT NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE holidays (
  date TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE VIEW v_lancamentos AS
SELECT
  t.id,
  t.month AS mes,
  t.date AS data,
  t.due_date AS vencimento,
  t.type AS tipo,
  t.description AS descricao,
  c.name AS categoria,
  a.name AS conta,
  ca.name AS conta_destino,
  ROUND(t.amount_cents / 100.0, 2) AS valor_reais,
  t.status,
  t.paid_at AS pago_em,
  t.origin AS origem
FROM transactions t
JOIN accounts a ON a.id = t.account_id
LEFT JOIN accounts ca ON ca.id = t.counter_account_id
LEFT JOIN categories c ON c.id = t.category_id
ORDER BY t.date, t.id;

CREATE VIEW v_resumo_mensal AS
SELECT
  t.month AS mes,
  ROUND(SUM(CASE WHEN t.type = 'receita' THEN t.amount_cents ELSE 0 END) / 100.0, 2) AS receitas_previstas_reais,
  ROUND(SUM(CASE WHEN t.type = 'receita' AND t.status = 'recebido' THEN t.amount_cents ELSE 0 END) / 100.0, 2) AS receitas_realizadas_reais,
  ROUND(SUM(CASE WHEN t.type = 'despesa' THEN t.amount_cents ELSE 0 END) / 100.0, 2) AS despesas_previstas_reais,
  ROUND(SUM(CASE WHEN t.type = 'despesa' AND t.status = 'pago' THEN t.amount_cents ELSE 0 END) / 100.0, 2) AS despesas_realizadas_reais,
  ROUND(
    (SUM(CASE WHEN t.type = 'receita' THEN t.amount_cents ELSE 0 END) -
     SUM(CASE WHEN t.type = 'despesa' THEN t.amount_cents ELSE 0 END)) / 100.0, 2
  ) AS fluxo_previsto_reais,
  ROUND(
    (SUM(CASE WHEN t.type = 'receita' AND t.status = 'recebido' THEN t.amount_cents ELSE 0 END) -
     SUM(CASE WHEN t.type = 'despesa' AND t.status = 'pago' THEN t.amount_cents ELSE 0 END)) / 100.0, 2
  ) AS fluxo_realizado_reais
FROM transactions t
JOIN accounts a ON a.id = t.account_id
WHERE a.type <> 'beneficio'
  AND t.type IN ('receita', 'despesa')
  AND t.status <> 'cancelado'
GROUP BY t.month
ORDER BY t.month;

CREATE VIEW v_categorias AS
SELECT
  t.month AS mes,
  COALESCE(c.name, 'Sem categoria') AS categoria,
  ROUND(SUM(t.amount_cents) / 100.0, 2) AS total_reais,
  COUNT(*) AS lancamentos
FROM transactions t
JOIN accounts a ON a.id = t.account_id
LEFT JOIN categories c ON c.id = t.category_id
WHERE t.type = 'despesa'
  AND t.status <> 'cancelado'
  AND a.type <> 'beneficio'
GROUP BY t.month, COALESCE(c.name, 'Sem categoria')
ORDER BY t.month, SUM(t.amount_cents) DESC;

CREATE VIEW v_contratos AS
SELECT
  p.id,
  p.description AS contrato,
  ROUND(p.installment_cents / 100.0, 2) AS parcela_reais,
  p.total_installments AS total_parcelas,
  p.paid_before_start AS pagas_antes,
  MAX(0, p.total_installments - p.paid_before_start - COALESCE(pg.pagas, 0)) AS restantes,
  ROUND(
    MAX(0, p.total_installments - p.paid_before_start - COALESCE(pg.pagas, 0)) *
    p.installment_cents / 100.0,
    2
  ) AS falta_reais,
  p.next_month AS proximo_mes,
  CASE
    WHEN p.total_installments - p.paid_before_start = 0 THEN NULL
    ELSE strftime(
      '%Y-%m',
      date(
        p.next_month || '-01',
        '+' || (p.total_installments - p.paid_before_start - 1) || ' months'
      )
    )
  END AS termino,
  p.due_day AS vencimento_dia,
  CASE WHEN p.active = 1 THEN 'ativo' ELSE 'inativo' END AS situacao
FROM installment_plans p
LEFT JOIN (
  SELECT origin_id, COUNT(*) AS pagas
  FROM transactions
  WHERE origin = 'contrato' AND status = 'pago' AND origin_id IS NOT NULL
  GROUP BY origin_id
) pg ON pg.origin_id = p.id;

CREATE VIEW v_metas AS
SELECT
  base.*,
  ROUND(
    CASE WHEN base.alvo_reais = 0 THEN 0 ELSE base.saldo_reais / base.alvo_reais * 100 END,
    1
  ) AS percentual
FROM (
  SELECT
    g.id,
    g.name AS meta,
    ROUND(g.target_cents / 100.0, 2) AS alvo_reais,
    ROUND((
      a.initial_balance_cents + COALESCE((
        SELECT SUM(CASE
          WHEN t.type = 'transferencia' AND t.status = 'pago' AND t.counter_account_id = a.id THEN t.amount_cents
          WHEN t.type = 'transferencia' AND t.status = 'pago' AND t.account_id = a.id THEN -t.amount_cents
          WHEN t.type = 'receita' AND t.status = 'recebido' AND t.account_id = a.id THEN t.amount_cents
          WHEN t.type = 'despesa' AND t.status = 'pago' AND t.account_id = a.id THEN -t.amount_cents
          ELSE 0
        END)
        FROM transactions t
      ), 0)
    ) / 100.0, 2) AS saldo_reais,
    ROUND(g.monthly_contribution_cents / 100.0, 2) AS aporte_planejado_reais,
    g.target_month AS mes_alvo,
    g.start_month AS mes_inicio,
    CASE WHEN g.active = 1 THEN 'ativa' ELSE 'inativa' END AS situacao
  FROM goals g
  JOIN accounts a ON a.id = g.account_id
) AS base;

CREATE VIEW v_beneficios AS
SELECT
  t.month AS mes,
  a.name AS conta,
  ROUND(SUM(CASE WHEN t.type = 'receita' THEN t.amount_cents ELSE 0 END) / 100.0, 2) AS creditos_reais,
  ROUND(SUM(CASE WHEN t.type = 'despesa' THEN t.amount_cents ELSE 0 END) / 100.0, 2) AS gastos_reais,
  ROUND(SUM(
    CASE
      WHEN t.type = 'receita' THEN t.amount_cents
      WHEN t.type = 'despesa' THEN -t.amount_cents
      ELSE 0
    END
  ) / 100.0, 2) AS saldo_reais
FROM transactions t
JOIN accounts a ON a.id = t.account_id
WHERE a.type = 'beneficio'
  AND t.type IN ('receita', 'despesa')
  AND t.status <> 'cancelado'
GROUP BY t.month, a.name
ORDER BY t.month, a.name;
