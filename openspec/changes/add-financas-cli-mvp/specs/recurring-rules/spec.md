# Spec Delta

## Purpose

Define regras recorrentes que geram lançamentos previstos, incluindo salário no quinto dia útil, 13º anual, contas fixas e créditos mensais de VA/VT.

## ADDED Requirements

### Requirement: Cadastro de regras recorrentes

O sistema SHALL manter regras com descrição, valor, conta, categoria, direção (`entrada`, `saida`, `beneficio`), frequência (`mensal`, `anual`), regra de dia, mês do ano quando anual, mês inicial, mês final opcional e indicador ativo.

#### Scenario: Listar regras ativas

- **WHEN** o usuário consulta as recorrências
- **THEN** o sistema exibe as regras ativas com valor, frequência e regra de data

### Requirement: Salário no quinto dia útil

O sistema SHALL calcular o pagamento do salário no quinto dia útil do mês, considerando sábados, domingos e feriados nacionais cadastrados. O valor padrão SHALL ser R$ 1.700,00.

#### Scenario: Salário de dezembro de 2026

- **WHEN** o mês de dezembro/2026 é aberto
- **THEN** a receita prevista de salário é gerada em 07/12/2026, o quinto dia útil

#### Scenario: Salário de janeiro de 2027

- **WHEN** o mês de janeiro/2027 é aberto
- **THEN** a receita prevista de salário é gerada em 08/01/2027, por causa do feriado de 01/01

### Requirement: Décimo terceiro salarial

O sistema SHALL gerar o 13º salário uma vez por ano, em dezembro, com valor padrão de R$ 1.100,00 e data estimada em 18/12, editável pelo usuário.

#### Scenario: 13º de dezembro de 2026

- **WHEN** o mês de dezembro/2026 é aberto
- **THEN** o sistema gera uma receita prevista de R$ 1.100,00 datada de 18/12/2026

#### Scenario: Janeiro sem 13º

- **WHEN** o mês de janeiro/2027 é aberto
- **THEN** nenhuma receita de 13º é gerada

### Requirement: Contas fixas mensais

O sistema SHALL manter energia elétrica como despesa mensal estimada de R$ 300,00 e internet como despesa mensal fixa de R$ 133,00. Quando o dia de vencimento não estiver definido, o lançamento SHALL ser gerado com vencimento nulo e exibido como "a definir".

#### Scenario: Contas fixas de dezembro

- **WHEN** o mês de dezembro/2026 é aberto
- **THEN** o sistema gera despesas previstas de R$ 300,00 para energia e R$ 133,00 para internet

#### Scenario: Energia ajustada na fatura

- **WHEN** a fatura de energia chega com valor diferente da estimativa
- **THEN** o usuário confirma o pagamento com o valor real e o realizado do mês reflete o valor pago

### Requirement: Créditos de benefícios

O sistema SHALL gerar créditos mensais de R$ 500,00 para VA e R$ 200,00 para VT no primeiro dia de cada mês, nas respectivas contas de benefício.

#### Scenario: Créditos de dezembro

- **WHEN** o mês de dezembro/2026 é aberto
- **THEN** o sistema registra R$ 500,00 na conta `flash-va` e R$ 200,00 na conta `flash-vt`, ambos em 01/12/2026

### Requirement: Edição de regras

O sistema SHALL permitir editar valor, data, conta, categoria e vigência de uma regra recorrente. Alterações SHALL valer apenas para meses ainda não abertos.

#### Scenario: Alterar a data estimada do 13º

- **WHEN** o usuário altera a data estimada do 13º para 20/12
- **THEN** os próximos meses abertos usam a nova data sem alterar lançamentos já gerados
