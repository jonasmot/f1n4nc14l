# Spec Delta

## Purpose

Controla os planos de parcelamento, a agenda de parcelas mensais e o saldo restante de cada contrato, incluindo o mês de término.

## ADDED Requirements

### Requirement: Cadastro de contratos

O sistema SHALL manter planos de parcelamento com descrição, valor da parcela, total de parcelas, parcelas pagas antes do início do controle, próximo mês de cobrança, dia de vencimento opcional, conta e categoria.

#### Scenario: Contratos ativos em dezembro

- **WHEN** o banco é inicializado
- **THEN** os cinco contratos ficam ativos com a próxima parcela em dezembro/2026 e vencimento "a definir"

### Requirement: Geração de parcelas

O sistema SHALL gerar uma parcela prevista por contrato a cada mês, a partir do próximo mês configurado, até esgotar as parcelas restantes. Cada parcela SHALL ter descrição, valor, conta, categoria e origem de contrato.

#### Scenario: Parcela de dezembro

- **WHEN** o mês de dezembro/2026 é aberto
- **THEN** o sistema gera uma parcela prevista para cada um dos cinco contratos, totalizando R$ 230,89

#### Scenario: Contrato encerrado

- **WHEN** o mês de fevereiro/2027 é aberto
- **THEN** o Contrato 5, encerrado em dezembro/2026, não gera nova parcela

### Requirement: Saldo restante e término

O sistema SHALL calcular o saldo restante de cada contrato como parcelas restantes vezes o valor da parcela, e o mês de término como próximo mês mais parcelas restantes menos um.

#### Scenario: Saldo total restante

- **WHEN** o usuário executa `fin contratos listar`
- **THEN** o sistema mostra R$ 1.290,21 de saldo restante total e os términos: Contrato 1 em jan/2027, Contrato 2 em mar/2027, Contrato 3 em fev/2028, Contrato 4 em abr/2027 e Contrato 5 em dez/2026

### Requirement: Edição de contrato

O sistema SHALL permitir editar descrição, valor da parcela, dia de vencimento, conta, categoria e status ativo de um contrato. A edição SHALL afetar apenas parcelas ainda não geradas.

#### Scenario: Definir vencimento

- **WHEN** o usuário executa `fin contratos editar 3 --vencimento 10`
- **THEN** as próximas parcelas do Contrato 3 passam a vencer no dia 10, sem alterar parcelas já geradas

### Requirement: Confirmação de parcela

O sistema SHALL confirmar a parcela como paga por meio do fluxo comum de pagamento, aceitando valor diferente quando houver desconto por adiantamento. O saldo restante SHALL refletir apenas parcelas ainda não pagas.

#### Scenario: Pagar parcela com desconto

- **WHEN** o usuário paga uma parcela de R$ 45,86 por R$ 40,00
- **THEN** a parcela é registrada como paga por R$ 40,00 e deixa de compor o saldo restante
