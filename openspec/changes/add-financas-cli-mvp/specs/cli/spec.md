# Spec Delta

## Purpose

Define a interface de linha de comando em português, o menu interativo e os formatos de entrada e saída usados no dia a dia.

## ADDED Requirements

### Requirement: Comando principal

O sistema SHALL instalar o comando `fin`. Sem argumentos, `fin` SHALL abrir o menu interativo; com `--help`, SHALL listar os comandos e opções em português.

#### Scenario: Abrir o menu

- **WHEN** o usuário executa `fin` sem argumentos
- **THEN** o sistema abre o menu interativo com o resumo do mês e as ações disponíveis

#### Scenario: Ajuda em português

- **WHEN** o usuário executa `fin --help`
- **THEN** o sistema lista os comandos com descrições em português

### Requirement: Menu interativo

O sistema SHALL oferecer um menu numerado com resumo do mês, saldo das contas, cofrinho, VA/VT, gastos da semana e disponível, permitindo registrar gasto, receita, ver mês, ver semana, pagar pendência, contratos, previsão, simulação e sair.

#### Scenario: Registrar gasto pelo menu

- **WHEN** o usuário escolhe "Novo gasto" no menu
- **THEN** o sistema solicita valor, categoria e descrição, registra a despesa e retorna ao menu com o resumo atualizado

#### Scenario: Sair do menu

- **WHEN** o usuário escolhe "Sair"
- **THEN** o sistema encerra sem alterar dados

### Requirement: Entrada de valores

O sistema SHALL aceitar valores em reais com vírgula ou ponto decimal, sem separador de milhar, e converter para centavos inteiros. Valores inválidos ou negativos SHALL ser rejeitados com mensagem em português.

#### Scenario: Valor com vírgula

- **WHEN** o usuário informa `25,90`
- **THEN** o sistema registra 2590 centavos

#### Scenario: Valor inválido

- **WHEN** o usuário informa `abc`
- **THEN** o sistema exibe uma mensagem de erro em português e não grava o lançamento

### Requirement: Formatação de saída

O sistema SHALL formatar dinheiro como `R$ 1.234,56`, datas como `dd/mm/aaaa` e meses como `mmmm/aaaa` em português, usando alinhamento de tabela legível no terminal.

#### Scenario: Formatar saldo

- **WHEN** o sistema exibe 123456 centavos
- **THEN** o valor aparece como `R$ 1.234,56`

### Requirement: Confirmação de ações destrutivas

O sistema SHALL pedir confirmação explícita antes de remover lançamentos, desativar contratos ou sobrescrever saldos iniciais, exibindo o que será alterado.

#### Scenario: Cancelar remoção

- **WHEN** o usuário responde "não" à confirmação de remoção
- **THEN** o lançamento permanece inalterado

### Requirement: Conta e mês padrão

O sistema SHALL usar o mês corrente como padrão nos relatórios e a conta corrente como padrão em despesas, permitindo sobrescrever com `--mes` e `--conta`.

#### Scenario: Gasto sem conta explícita

- **WHEN** o usuário executa `fin gasto 10 lazer "cinema"` sem `--conta`
- **THEN** a despesa é registrada na conta corrente

#### Scenario: Relatório de outro mês

- **WHEN** o usuário executa `fin resumo --mes 2027-01`
- **THEN** o sistema exibe o resumo de janeiro/2027 em vez do mês corrente
