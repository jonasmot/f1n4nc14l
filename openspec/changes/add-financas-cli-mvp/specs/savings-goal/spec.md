# Spec Delta

## Purpose

Trata o cofrinho como reserva separada, acompanha a meta da moto e simula o financiamento sem criar dívidas ou lançamentos reais.

## ADDED Requirements

### Requirement: Meta do cofrinho

O sistema SHALL manter uma meta com nome, valor-alvo, mês-alvo, aporte mensal planejado e conta vinculada. A meta padrão SHALL ser "Moto", R$ 3.500,00 até março/2028, com aporte planejado de R$ 800,00 por mês.

#### Scenario: Consultar a meta

- **WHEN** o usuário executa `fin meta`
- **THEN** o sistema mostra o saldo atual do cofrinho, o valor-alvo, o percentual atingido, os meses restantes e o aporte planejado

#### Scenario: Meta atingida

- **WHEN** o saldo do cofrinho alcança R$ 3.500,00
- **THEN** o sistema indica que a meta foi atingida e continua exibindo a projeção até a data da compra

### Requirement: Aportes e retiradas

O sistema SHALL considerar transferências para o cofrinho como aportes e transferências do cofrinho para outra conta como retiradas, reduzindo o progresso da meta.

#### Scenario: Aporte de R$ 800,00

- **WHEN** o usuário transfere R$ 800,00 da conta corrente para o cofrinho
- **THEN** o progresso da meta aumenta R$ 800,00

#### Scenario: Retirada para despesa

- **WHEN** o usuário transfere R$ 100,00 do cofrinho para a conta corrente
- **THEN** o progresso da meta diminui R$ 100,00 e o sistema mostra o impacto no mês-alvo

### Requirement: Simulação de financiamento

O sistema SHALL simular a compra da moto sem gravar dados, recebendo entrada, valor da parcela, quantidade de parcelas, mês da compra e aporte mensal. A simulação SHALL calcular o cofrinho projetado, a saída na compra, o saldo restante, o fluxo mensal e o mês da última parcela.

#### Scenario: Simulação padrão

- **WHEN** o usuário executa `fin simular moto --entrada 3500 --parcela 780 --parcelas 48 --mes 2028-03 --aporte 800`
- **THEN** o sistema projeta o cofrinho em R$ 14.500,00 em março/2028, saída de R$ 4.280,00 na compra, restante de R$ 10.220,00 e última parcela em fevereiro/2032

#### Scenario: Fluxo após a compra

- **WHEN** a simulação considera salário de R$ 1.700,00 e contas fixas de R$ 433,00
- **THEN** o sistema mostra fluxo de R$ 487,00 sem novo aporte e de −R$ 313,00 mantendo o aporte de R$ 800,00

#### Scenario: Simulação não persiste

- **WHEN** o usuário executa qualquer simulação
- **THEN** nenhuma meta, contrato ou lançamento é criado ou alterado

### Requirement: Cofrinho fora do disponível

O sistema SHALL exibir o cofrinho como reserva separada, fora do valor disponível para gastos do mês, mas incluído no patrimônio total.

#### Scenario: Disponível sem o cofrinho

- **WHEN** o usuário consulta o disponível do mês
- **THEN** o saldo do cofrinho não é somado ao valor disponível para gastos
