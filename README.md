# f1n4nc14l

Controle financeiro pessoal em linha de comando, em português, com dados locais em SQLite.

> **Aviso:** este repositório é público. Nunca faça commit de dados financeiros. O diretório `data/` é ignorado pelo Git; mantenha assim.

## Requisitos

- Node.js 26 ou superior (usa o módulo nativo `node:sqlite`)
- npm
- Opcional: [DB Browser for SQLite](https://sqlitebrowser.org/) para consultar o banco

## Instalação

```bash
npm install
npm link
```

Depois disso, o comando `fin` fica disponível no terminal.

## Primeiros passos

```bash
fin init                 # cria o banco, as views e o seed inicial
fin mes abrir 2026-12    # gera os lançamentos previstos de dezembro/2026
fin                      # abre o menu interativo
fin --help               # lista os comandos
```

O banco fica em `data/financas.db`. Ele é criado automaticamente e não deve ser versionado. Bancos criados antes da revisão do plano de março/2027 recebem as migrações `002_march_2027_plan.sql` e `003_fix_motorcycle_goal.sql` ao rodar `fin init` novamente; as migrações só alteram os valores antigos do seed e preservam lançamentos já registrados.

## Como os dados funcionam

- Dinheiro é armazenado em centavos inteiros; a interface mostra reais.
- Datas usam `AAAA-MM-DD` e meses usam `AAAA-MM`.
- Status: `previsto`, `pago`, `recebido` e `cancelado`.
- Saldos são calculados a partir do saldo inicial e das movimentações confirmadas (`pago` ou `recebido`).
- Transferências não entram como receita nem despesa.
- O aporte planejado do cofrinho é só projeção: o cofrinho muda quando você usa `fin transferir`.
- VA e VT são contas separadas, creditadas no dia 1º de cada mês, sem carryover e fora do fluxo de caixa.
- `FIN_DB_PATH` permite apontar para outro arquivo de banco.
- `FIN_TODAY=AAAA-MM-DD` congela a data atual, útil para testes e simulações.

## Comandos

### Inicialização

```bash
fin init
```

Cria `data/financas.db`, aplica migrações pendentes e insere contas, categorias, feriados, contratos, recorrências e a meta. Pode ser executado várias vezes sem duplicar dados.

### Contas e benefícios

```bash
fin contas listar
fin contas listar --mes 2026-12
fin contas ajustar corrente 500 --data 2026-12-01
fin transferir 800 corrente cofrinho --data 2026-12-10 --desc "Aporte do mês"
fin transferir 100 cofrinho corrente --data 2027-01-05 --desc "Retirada"
```

- `contas listar` mostra o saldo atual; para VA/VT, mostra o saldo do mês informado.
- `contas ajustar` altera o saldo inicial da conta, nunca o saldo derivado. Pede confirmação; use `--sim` para pular.
- `transferir` aceita apelidos: `corrente`, `conta`, `carteira`, `dinheiro`, `cofrinho`, `poupanca`, `va`, `vt`.

### Gastos e lançamentos

```bash
fin gasto 25,90 mercado "feira"
fin gasto 50 refeicoes "almoço" --conta va --data 2026-12-09
fin despesa add 280 --desc "Autoescola" --categoria outros --data 2026-12-15
fin receita add 1700 --desc "Salário" --categoria salario --data 2026-12-07
fin lancamentos --mes 2026-12
fin lancamentos --mes 2026-12 --status previsto --tipo despesa
fin lancamentos --mes 2026-12 --categoria mercado --conta corrente
fin editar <id> --desc "Mercado do mês" --valor 120,50
fin editar <id> --vencimento 2026-12-20
fin editar <id> --vencimento a-definir
fin remover <id>
fin remover <id> --sim
fin pagar <id> --data 2026-12-20
fin pagar <id> --valor 312,45 --data 2026-12-20
fin receber <id> --data 2026-12-07
fin receber <id> --valor 1650 --data 2026-12-07
```

Os IDs aparecem na primeira coluna de `fin lancamentos`.

- `gasto` cria uma despesa já paga, com data atual por padrão.
- `despesa add` cria prevista; use `--pago` para criar já paga.
- `receita add` cria prevista; use `--recebido` para criar já recebida.
- `pagar` e `receber` aceitam valor diferente do previsto.
- `remover` pede confirmação; `--sim` pula a pergunta. Lançamentos gerados por contrato ou recorrência não podem ser removidos.

### Planejamento mensal

```bash
fin mes abrir 2026-12
fin mes abrir 2027-01
fin previsao
fin previsao --mes 2027-01
```

- `mes abrir` gera os previstos de recorrências e contratos de forma idempotente; rodar duas vezes não duplica.
- `previsao` não grava nada. Mostra receitas, contas fixas, contratos, outros gastos, fluxo, aporte planejado, disponível e saldos projetados.
- O salário é calculado no 5º dia útil, considerando fins de semana e feriados nacionais cadastrados.
- O 13º é gerado apenas em dezembro.
- Autoescola entra apenas em dezembro/2026.

### Contratos

```bash
fin contratos listar
fin contratos editar 3 --vencimento 10
fin contratos editar 3 --valor 70
fin contratos editar 5 --inativo
fin contratos editar 5 --ativo
```

`contratos listar` mostra parcela, parcelas restantes, saldo restante, mês de término, vencimento e situação. O saldo restante desconta as parcelas já pagas. O total restante inicial é R$ 1.290,21. `--inativo` pede confirmação; use `--sim` para pular.

### Relatórios

```bash
fin resumo
fin resumo --mes 2026-12
fin categorias --mes 2026-12
fin evolucao --meses 6
fin evolucao --meses 12 --mes 2027-12
fin semana
fin semana --data 2026-12-07
```

- `resumo` separa previsto de realizado, mostra aporte planejado, disponível, caixa, cofrinho, VA/VT e contratos restantes.
- `categorias` separa gastos do caixa dos gastos pagos com benefícios.
- `evolucao` usa os valores realizados de cada mês e o saldo do cofrinho ao final.
- `semana` mostra a semana de segunda a domingo, os gastos registrados, as pendências dos próximos sete dias, os saldos de VA/VT e o disponível do mês.

### Cofrinho, meta e simulação

```bash
fin meta
fin simular moto
fin simular moto --cnh 100 --entrada 3500 --parcela 780 --parcelas 48 --capacete 500 --mes 2027-03 --aporte 850
fin simular moto --entrada 3000 --parcela 700 --parcelas 36 --mes 2027-12 --aporte 500
```

- A meta padrão é a moto: R$ 4.880,00 até março/2027, com aporte planejado de R$ 850,00/mês. O alvo cobre CNH (R$ 100,00), entrada (R$ 3.500,00), primeira parcela (R$ 780,00) e capacete (R$ 500,00).
- `meta` mostra o saldo do cofrinho, percentual, quanto falta, aportes e retiradas registrados e a projeção no ritmo atual. Também exibe uma tabela mês a mês com entradas, contas fixas, contratos, outros gastos, valor disponível, aporte planejado, sobra e saldo projetado do cofrinho, além da sobra ou falta após a compra.
- `simular moto` não grava nada. Calcula o cofrinho projetado, o desembolso total, o restante, o fluxo mensal com os contratos ainda ativos, a última parcela e a cobertura do saldo restante. Use `--cnh`, `--entrada`, `--parcela`, `--parcelas`, `--capacete`, `--mes` e `--aporte` para simular outro cenário.

### Menu interativo

```bash
fin
```

O menu mostra o resumo do mês, o saldo das contas, o cofrinho, VA/VT e os gastos da semana. A partir dele é possível registrar gasto ou receita, ver o mês, ver a semana, pagar uma pendência, consultar contratos, ver a meta com a projeção, ver a previsão do próximo mês, simular a moto e sair.

## Consultando no DB Browser for SQLite

1. Abra `data/financas.db` no DB Browser for SQLite.
2. Feche o DB Browser antes de executar comandos que gravam, para evitar bloqueio do arquivo.
3. Consulte as views em reais:

- `v_lancamentos`
- `v_resumo_mensal`
- `v_categorias`
- `v_contratos`
- `v_metas`
- `v_beneficios`

## Backup manual

O MVP não faz backup automático. Para copiar com segurança:

1. Feche o aplicativo e o DB Browser for SQLite.
2. Copie `data/financas.db` para uma pasta fora do repositório, por exemplo `Documentos/backups-financas/financas-2026-12-01.db`.
3. Guarde a cópia em local seguro.

Não copie o banco com o app aberto. Não há senha nem criptografia: proteja o arquivo e a pasta de backup.

## Testes

```bash
npm test
```

A suíte cobre domínio, persistência, casos de uso, CLI e o fluxo completo em banco temporário. Nenhum teste grava em `data/financas.db`.

## Estrutura

```text
bin/fin.js                 entrada da CLI
src/domain/                regras puras (dinheiro, datas, dias úteis, agenda, resumo, meta)
src/application/           casos de uso (contas, lançamentos, contratos, planejamento, relatórios, metas)
src/infrastructure/        SQLite, migrações, seed e repositórios
src/cli/                   comandos, menu, tabelas e formatação
test/                      testes com node:test
data/                      banco local (ignorado pelo Git)
openspec/                  especificações e planejamento do projeto
```
