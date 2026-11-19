# Spec Delta

## Purpose

Abre um mês gerando os lançamentos previstos de recorrências e contratos de forma idempotente, e projeta meses futuros sem gravar dados.

## ADDED Requirements

### Requirement: Abertura do mês

O sistema SHALL abrir um mês no formato `YYYY-MM`, gerando lançamentos previstos para todas as regras recorrentes ativas e todos os contratos com parcela naquele mês. A abertura SHALL ser idempotente.

#### Scenario: Abrir dezembro de 2026

- **WHEN** o usuário executa `fin mes abrir 2026-12`
- **THEN** o sistema gera 12 lançamentos previstos: salário, 13º, crédito de VA, crédito de VT, energia, internet, cinco contratos e autoescola

#### Scenario: Reabrir sem duplicar

- **WHEN** o usuário executa `fin mes abrir 2026-12` duas vezes
- **THEN** o segundo comando não cria lançamentos duplicados e informa que o mês já estava aberto

### Requirement: Composição da abertura

A abertura SHALL considerar apenas regras e contratos ativos, ignorar lançamentos cancelados e não SHALL alterar lançamentos manuais já existentes no mês.

#### Scenario: Contrato encerrado não entra

- **WHEN** o usuário abre janeiro/2027
- **THEN** o Contrato 5 não é incluído e as despesas de contrato somam R$ 141,28

#### Scenario: Lançamento manual preservado

- **WHEN** o usuário abre um mês que já contém uma despesa manual
- **THEN** a despesa manual permanece intacta e não é duplicada

### Requirement: Previsão de mês futuro

O sistema SHALL calcular a previsão de um mês sem gravar lançamentos, mostrando receitas, despesas, fluxo, aporte planejado, disponível após aporte e saldo projetado.

#### Scenario: Previsão de janeiro de 2027

- **WHEN** o usuário executa `fin previsao --mes 2027-01`
- **THEN** o sistema mostra receitas de R$ 1.700,00, despesas de R$ 574,28, fluxo de R$ 1.125,72, aporte planejado de R$ 800,00, disponível de R$ 325,72 e saldo projetado de R$ 1.381,83

#### Scenario: Previsão não persiste

- **WHEN** o usuário executa `fin previsao`
- **THEN** nenhum lançamento é criado ou alterado no banco

### Requirement: Aporte planejado

O sistema SHALL tratar o aporte mensal da meta como planejamento, não como transferência automática. O valor SHALL aparecer separado do fluxo do mês e o saldo do cofrinho SHALL refletir apenas transferências efetivamente registradas.

#### Scenario: Aporte ideal versus realizado

- **WHEN** o usuário consulta o resumo de dezembro/2026
- **THEN** o sistema mostra R$ 800,00 de aporte planejado e o saldo real do cofrinho separadamente

#### Scenario: Aporte menor que o planejado

- **WHEN** o usuário transfere R$ 500,00 para o cofrinho em dezembro
- **THEN** o cofrinho aumenta R$ 500,00 e o resumo continua exibindo R$ 800,00 como aporte planejado
