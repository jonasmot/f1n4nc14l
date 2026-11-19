# Spec Delta

## Purpose

Registra receitas e despesas individuais com valor, data, conta, categoria e ciclo de status, permitindo planejar, confirmar, corrigir e remover lançamentos.

## ADDED Requirements

### Requirement: Registro de despesas

O sistema SHALL registrar cada compra como um lançamento individual de despesa, com valor em centavos, data, descrição, categoria, conta e status. O atalho `fin gasto` SHALL criar uma despesa já paga na data informada ou na data atual.

#### Scenario: Compra do dia a dia

- **WHEN** o usuário executa `fin gasto 25,90 mercado "feira"`
- **THEN** o sistema cria uma despesa de R$ 25,90, categoria `mercado`, status `pago`, conta padrão `conta-corrente` e data atual

#### Scenario: Despesa planejada

- **WHEN** o usuário executa `fin despesa add 280 --desc "Autoescola" --categoria outros --data 2026-12-15`
- **THEN** o sistema cria a despesa com status `previsto`, permitindo confirmação posterior

### Requirement: Registro de receitas

O sistema SHALL registrar receitas com valor, data, descrição, categoria e conta. Receitas criadas sem confirmação explícita SHALL nascer com status `previsto`; `--recebido` SHALL criar já confirmada.

#### Scenario: Salário previsto

- **WHEN** o usuário executa `fin receita add 1700 --desc "Salário" --categoria salario --data 2026-12-07`
- **THEN** o sistema cria uma receita prevista de R$ 1.700,00 na conta corrente

#### Scenario: Recebimento confirmado

- **WHEN** o usuário executa `fin receber 3 --data 2026-12-07`
- **THEN** o lançamento de receita passa para status `recebido` com a data de recebimento registrada

### Requirement: Ciclo de status

O sistema SHALL controlar os status `previsto`, `pago`, `recebido` e `cancelado`. Confirmar uma despesa SHALL usar `pago`; confirmar uma receita SHALL usar `recebido`. Lançamentos cancelados SHALL ser excluídos dos relatórios.

#### Scenario: Pagar uma despesa prevista

- **WHEN** o usuário executa `fin pagar 12 --data 2026-12-10`
- **THEN** a despesa passa para `pago` com a data de pagamento registrada e aparece no realizado do mês

#### Scenario: Cancelar um lançamento

- **WHEN** o usuário cancela um lançamento previsto
- **THEN** o status vira `cancelado` e o valor deixa de compor os totais do mês

### Requirement: Pagamento com valor diferente

O sistema SHALL permitir confirmar um lançamento com valor diferente do previsto, usando o valor efetivamente pago ou recebido nos relatórios realizados.

#### Scenario: Energia acima da estimativa

- **WHEN** o usuário executa `fin pagar 20 --valor 312,45 --data 2026-12-20`
- **THEN** o lançamento de energia é confirmado por R$ 312,45 e o resumo realizado usa esse valor

### Requirement: Edição e remoção

O sistema SHALL permitir editar valor, data, descrição, categoria, conta e vencimento de um lançamento. A remoção SHALL exigir confirmação explícita e SHALL ser bloqueada para lançamentos gerados por contrato ou recorrência.

#### Scenario: Editar descrição

- **WHEN** o usuário executa `fin editar 5 --desc "Mercado do mês"`
- **THEN** a descrição do lançamento é atualizada sem alterar os demais campos

#### Scenario: Remover lançamento manual

- **WHEN** o usuário executa `fin remover 7` e confirma a operação
- **THEN** o lançamento manual é excluído definitivamente

### Requirement: Listagem de lançamentos

O sistema SHALL listar lançamentos filtrando por mês, status, categoria, conta e tipo, exibindo valores em reais e ordenação cronológica.

#### Scenario: Ver o mês

- **WHEN** o usuário executa `fin lancamentos --mes 2026-12`
- **THEN** o sistema lista os lançamentos de dezembro/2026 com data, descrição, categoria, conta, valor e status
