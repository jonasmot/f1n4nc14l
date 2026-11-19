# Spec Delta

## Purpose

Gerencia contas, carteiras e benefícios, mantendo saldos derivados dos lançamentos e registrando transferências sem afetar receitas ou despesas.

## ADDED Requirements

### Requirement: Cadastro e consulta de contas

O sistema SHALL manter contas com nome, tipo (`corrente`, `carteira`, `cofrinho`, `beneficio`), saldo inicial, data do saldo inicial e indicador de disponibilidade para gastos. O saldo atual SHALL ser derivado dos lançamentos e transferências, nunca gravado como valor editável.

#### Scenario: Listar contas com saldo derivado

- **WHEN** o usuário executa `fin contas listar`
- **THEN** o sistema exibe cada conta com o saldo atual calculado a partir do saldo inicial e das movimentações

#### Scenario: Ajustar saldo inicial

- **WHEN** o usuário executa `fin contas ajustar conta-corrente 0 --data 2026-12-01`
- **THEN** o saldo inicial da conta é atualizado e o saldo atual é recalculado

### Requirement: Transferências entre contas

O sistema SHALL registrar transferências como um par de movimentos vinculados entre conta de origem e conta de destino, sem contabilizá-las como receita ou despesa nos relatórios de fluxo.

#### Scenario: Aporte no cofrinho

- **WHEN** o usuário executa `fin transferir 800 conta-corrente cofrinho`
- **THEN** a conta corrente diminui R$ 800,00, o cofrinho aumenta R$ 800,00 e o resumo de receitas e despesas permanece inalterado

### Requirement: Benefícios VA e VT

O sistema SHALL tratar VA e VT como contas de benefício separadas, creditadas no primeiro dia de cada mês, sem carryover e sem alerta de expiração. Compras pagas com benefício SHALL reduzir o saldo da conta correspondente e não SHALL afetar o fluxo de caixa.

#### Scenario: Renovação mensal do VA

- **WHEN** o mês vira de dezembro/2026 para janeiro/2027
- **THEN** o saldo de VA é renovado em R$ 500,00 no primeiro dia de janeiro, sem herdar sobra de dezembro

#### Scenario: Compra paga com VA

- **WHEN** o usuário registra uma despesa de R$ 50,00 no mercado com a conta `flash-va`
- **THEN** o saldo do VA cai R$ 50,00 e o fluxo de caixa da conta corrente não é alterado

### Requirement: Saldos iniciais do seed

O sistema SHALL iniciar em 01/12/2026 com conta corrente R$ 0,00, carteira R$ 0,00, cofrinho R$ 1.500,00, VA R$ 0,00 e VT R$ 0,00, além dos créditos de VA e VT do próprio dia 1º.

#### Scenario: Primeiro dia de dezembro

- **WHEN** o banco é inicializado e o mês de dezembro/2026 é aberto
- **THEN** a conta corrente parte de R$ 0,00, o cofrinho de R$ 1.500,00 e os benefícios recebem R$ 500,00 de VA e R$ 200,00 de VT
