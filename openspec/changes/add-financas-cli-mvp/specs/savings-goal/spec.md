# Spec Delta

## Purpose

Trata o cofrinho como reserva separada, acompanha a meta da moto e simula o financiamento sem criar dívidas ou lançamentos reais.

## ADDED Requirements

### Requirement: Meta do cofrinho

O sistema SHALL manter uma meta com nome, valor-alvo, mês-alvo, aporte mensal planejado e conta vinculada. A meta padrão SHALL ser "Moto", R$ 4.880,00 até março/2027, com aporte planejado de R$ 850,00 por mês. O valor-alvo SHALL cobrir CNH, entrada, primeira parcela e capacete.

#### Scenario: Consultar a meta

- **WHEN** o usuário executa `fin meta`
- **THEN** o sistema mostra o saldo atual do cofrinho, o valor-alvo, o percentual atingido, os meses restantes, o aporte planejado e a projeção mês a mês

#### Scenario: Meta atingida

- **WHEN** o saldo do cofrinho alcança R$ 4.880,00
- **THEN** o sistema indica que a meta foi atingida e continua exibindo a projeção até a data da compra

### Requirement: Aportes e retiradas

O sistema SHALL considerar transferências para o cofrinho como aportes e transferências do cofrinho para outra conta como retiradas, reduzindo o progresso da meta.

#### Scenario: Aporte de R$ 850,00

- **WHEN** o usuário transfere R$ 850,00 da conta corrente para o cofrinho
- **THEN** o progresso da meta aumenta R$ 850,00

#### Scenario: Retirada para despesa

- **WHEN** o usuário transfere R$ 100,00 do cofrinho para a conta corrente
- **THEN** o progresso da meta diminui R$ 100,00 e o sistema mostra o impacto no mês-alvo

### Requirement: Simulação de financiamento

O sistema SHALL simular a compra da moto sem gravar dados, recebendo CNH, entrada, valor da parcela, quantidade de parcelas, capacete, mês da compra e aporte mensal. A simulação SHALL calcular o cofrinho projetado, o desembolso total, o saldo restante, o fluxo mensal com os contratos ativos, o fluxo após o término dos contratos e o mês da última parcela.

#### Scenario: Simulação padrão

- **WHEN** o usuário executa `fin simular moto --cnh 100 --entrada 3500 --parcela 780 --parcelas 48 --capacete 500 --mes 2027-03 --aporte 850`
- **THEN** o sistema projeta o cofrinho em R$ 4.900,00 em março/2027, desembolso total de R$ 4.880,00, restante de R$ 20,00 e última parcela em fevereiro/2031

#### Scenario: Fluxo após a compra

- **WHEN** a simulação considera salário de R$ 1.700,00, contas fixas de R$ 433,00, contratos ativos de R$ 95,42 até fevereiro/2028 e parcela de R$ 780,00
- **THEN** o sistema mostra fluxo de R$ 391,58 com os contratos ativos, R$ 487,00 após o término deles e −R$ 458,42 mantendo o aporte de R$ 850,00

#### Scenario: Simulação não persiste

- **WHEN** o usuário executa qualquer simulação
- **THEN** nenhuma meta, contrato ou lançamento é criado ou alterado

### Requirement: Projeção mensal da meta

O sistema SHALL exibir, do mês corrente ou do início da meta até o mês-alvo, uma linha por mês com entradas, contas fixas, contratos, outros gastos, valor disponível para aporte, aporte planejado, sobra e saldo projetado do cofrinho. A projeção SHALL ser calculada sem gravar lançamentos e SHALL descontar do aporte do mês corrente o valor já transferido.

#### Scenario: Projeção de dezembro/2026 a março/2027

- **WHEN** o usuário executa `fin meta` em novembro/2026
- **THEN** o sistema mostra quatro linhas mensais; dezembro/2026 tem entradas de R$ 2.800,00, contas fixas de R$ 433,00, contratos de R$ 230,89, outros gastos de R$ 280,00, disponível de R$ 1.856,11, aporte de R$ 850,00, sobra de R$ 1.006,11 e cofrinho de R$ 2.350,00
- **AND** março/2027 termina com cofrinho de R$ 4.900,00, sobra de R$ 20,00 após o desembolso de R$ 4.880,00 e nenhum lançamento é gravado

#### Scenario: Aporte parcial no mês corrente

- **WHEN** o usuário já transferiu R$ 300,00 para o cofrinho no mês corrente
- **THEN** a linha do mês mostra aporte restante de R$ 550,00 e o cofrinho projetado considera os R$ 300,00 já registrados

### Requirement: Cofrinho fora do disponível

O sistema SHALL exibir o cofrinho como reserva separada, fora do valor disponível para gastos do mês, mas incluído no patrimônio total.

#### Scenario: Disponível sem o cofrinho

- **WHEN** o usuário consulta o disponível do mês
- **THEN** o saldo do cofrinho não é somado ao valor disponível para gastos
