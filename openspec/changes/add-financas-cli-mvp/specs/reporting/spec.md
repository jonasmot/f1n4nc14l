# Spec Delta

## Purpose

Gera relatórios derivados dos lançamentos: resumo mensal, gastos por categoria, evolução histórica e resumo semanal com o valor disponível.

## ADDED Requirements

### Requirement: Resumo mensal

O sistema SHALL exibir, para um mês, receitas previstas e realizadas, despesas previstas e realizadas, fluxo previsto e realizado, aporte planejado da meta, disponível após aporte, saldo das contas, saldo do cofrinho e contratos restantes.

#### Scenario: Resumo de dezembro de 2026

- **WHEN** o usuário executa `fin resumo --mes 2026-12`
- **THEN** o sistema mostra R$ 2.800,00 de receitas previstas, R$ 943,89 de despesas previstas e R$ 1.856,11 de fluxo previsto, além de R$ 800,00 de aporte planejado e R$ 1.056,11 disponíveis após o aporte

#### Scenario: Valores realizados separados

- **WHEN** parte das contas do mês ainda está prevista
- **THEN** o resumo distingue os totais realizados dos previstos, sem misturar os dois

### Requirement: Gastos por categoria

O sistema SHALL totalizar as despesas do mês por categoria, com valor e percentual sobre o total, ignorando lançamentos cancelados e separando compras pagas com benefícios.

#### Scenario: Categorias de dezembro

- **WHEN** o usuário executa `fin categorias --mes 2026-12`
- **THEN** o sistema lista moradia, contratos, outros e demais categorias com seus totais em reais e participação percentual

#### Scenario: Benefícios fora do caixa

- **WHEN** existem compras pagas com VA ou VT
- **THEN** elas aparecem em uma seção de benefícios e não alteram o total de despesas do caixa

### Requirement: Evolução histórica

O sistema SHALL mostrar a evolução dos últimos N meses com receitas, despesas, fluxo e saldo do cofrinho ao final de cada mês.

#### Scenario: Evolução de seis meses

- **WHEN** o usuário executa `fin evolucao --meses 6`
- **THEN** o sistema exibe uma linha por mês com receitas, despesas, fluxo e saldo do cofrinho

### Requirement: Resumo semanal

O sistema SHALL exibir a semana corrente de segunda a domingo com gastos registrados, contas e parcelas a vencer nos próximos sete dias, saldos de VA/VT e valor disponível após compromissos e aporte planejado.

#### Scenario: Semana corrente

- **WHEN** o usuário executa `fin semana`
- **THEN** o sistema mostra os gastos da semana, as pendências dos próximos sete dias, os saldos de VA e VT e o disponível do mês

#### Scenario: Semana sem gastos

- **WHEN** não há gastos registrados na semana
- **THEN** o sistema informa que não houve gastos e ainda exibe pendências e disponível

### Requirement: Sinais dos relatórios

O sistema SHALL usar valores negativos apenas para despesas e transferências de saída. Receitas e saldos positivos SHALL ser exibidos sem sinal de menos.

#### Scenario: Formatação de despesa

- **WHEN** o sistema exibe uma despesa de R$ 133,00
- **THEN** o valor aparece como `-R$ 133,00` e não como `R$ -133,00`
