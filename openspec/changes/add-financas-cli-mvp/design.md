# Design

## Context

Projeto novo, sem código de aplicação no repositório. O ambiente é Windows com Node.js 26.13.1, que já inclui `node:sqlite`. O controle começa em dezembro/2026 com saldos iniciais, cinco contratos ativos e receitas previstas. O repositório é público, então dados financeiros nunca podem entrar no Git. O script `f1n4nc14l.js` existente serve apenas como referência dos valores iniciais e não será alterado.

Ver `proposal.md` para motivação e `specs/` para o comportamento exigido.

## Goals / Non-Goals

**Goals:**

- Monólito modular local-first, com domínio puro e reutilizável por um futuro servidor HTTP.
- Um único arquivo SQLite, simples de copiar e abrir no DB Browser for SQLite.
- Cálculos determinísticos de dia útil, parcelas, resumo e projeções, cobertos por testes.
- Abertura de mês idempotente, sem duplicar lançamentos automáticos.
- Interface pt-BR previsível, com comandos e menu usando os mesmos casos de uso.

**Non-Goals:**

- Servidor, API, autenticação, acesso remoto e multiusuário.
- Cartão de crédito, orçamento por categoria, conciliação bancária e importação de extratos.
- Backup automático, criptografia, senha e sincronização em nuvem.
- Quitação antecipada como comando dedicado; o fluxo de pagamento com valor ajustado cobre o caso.

## Decisions

### 1. Runtime e acesso ao SQLite

Usar `node:sqlite` (`DatabaseSync`) nativo do Node 26, sem ORM e sem dependência nativa compilada.

- **Por quê:** zero build tools no Windows, menos dependências e SQL explícito, adequado a um app pessoal.
- **Alternativas:** `better-sqlite3` (rápido, mas exige compilação/Prebuilt), Prisma/Drizzle (peso e abstração desnecessários para um arquivo local).
- **Consequência:** o projeto exige Node >= 26; a API do `node:sqlite` fica encapsulada em `src/infrastructure/db.js`.

### 2. Monólito modular em quatro camadas

```
bin/fin.js                → entrada, parsing e composição
src/domain/               → regras puras (dinheiro, datas, agenda, resumo)
src/application/          → casos de uso (contas, lançamentos, contratos, relatórios)
src/infrastructure/       → SQLite, migrações, repositórios, configuração
src/cli/                  → comandos, prompts, tabelas e formatação
```

- **Por quê:** o domínio não conhece SQLite nem terminal; os testes rodam sem banco. O futuro servidor reutiliza `application`.
- **Regra de dependência:** `cli → application → domain`; `infrastructure` implementa persistência e é injetada na composição. O domínio não importa nada das outras camadas.

### 3. Dinheiro em centavos inteiros

Todo valor é `INTEGER` em centavos. O parsing recebe string e converte sem `parseFloat`: separa parte inteira e decimal, aceita vírgula ou ponto e rejeita mais de duas casas. A formatação usa `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.

- **Por quê:** elimina erros de ponto flutuante em somas e comparações.
- **Alternativa descartada:** `REAL` em reais, que acumula arredondamentos e dificulta igualdade.

### 4. Datas civis em ISO

Datas são strings `YYYY-MM-DD` e meses `YYYY-MM`, sem conversão para UTC. Aritmética de calendário é feita em funções próprias (ano, mês, dia, dias no mês, dia da semana). O fuso `America/Sao_Paulo` é usado apenas para decidir “hoje” na CLI.

- **Por quê:** evita o clássico erro de data mudar de dia ao converter para UTC.
- **Dia útil:** considera sábado, domingo e a tabela `holidays`. O quinto dia útil é calculado pela contagem sequencial, não por fórmula fixa.
- **Feriados:** seed com feriados nacionais de 2026–2028; o usuário pode adicionar/remover depois.

### 5. Schema relacional enxuto

Tabelas: `accounts`, `categories`, `transactions`, `recurring_rules`, `installment_plans`, `goals`, `settings`, `holidays`, `schema_migrations`.

- `transactions` unifica receita, despesa, transferência e ajuste. Transferência usa `counter_account_id`; receita/despesa usam `category_id`.
- Saldos não são gravados: são calculados a partir do saldo inicial e das transações confirmadas. Transferências só movem saldo quando `status = 'pago'`.
- Status: `previsto`, `pago`, `recebido`, `cancelado`. Relatórios “previstos” incluem previsto + confirmado; “realizados” incluem apenas confirmado.
- Índice único parcial em `(origin, origin_id, month)` para idempotência dos lançamentos gerados. Lançamentos manuais têm `origin = 'manual'` e `origin_id` nulo, sem conflito.
- `installment_plans` guarda `paid_before_start`, `next_month` e `total_installments`; a agenda é derivada, não materializada.

### 6. Abertura de mês idempotente

`fin mes abrir YYYY-MM` executa em transação:

1. carrega regras ativas e contratos com parcela no mês;
2. calcula data/vencimento de cada previsto;
3. insere com `ON CONFLICT DO NOTHING` no índice de idempotência;
4. retorna quantos lançamentos foram criados e quantos já existiam.

- **Por quê:** o usuário pode rodar o comando várias vezes sem medo.
- **Regra:** a abertura nunca altera lançamentos manuais e nunca reabre lançamentos cancelados.
- **Aporte:** o aporte planejado da meta não é uma transação automática. Ele entra apenas em projeções e no “disponível após aporte”; o cofrinho só muda com `fin transferir`. Isso evita duplicar o aporte quando o valor real for diferente de R$ 800.

### 7. Benefícios VA/VT separados do caixa

Créditos de VA/VT são transações do tipo receita nas contas `flash-va` e `flash-vt`, mas contas do tipo `beneficio` ficam fora dos relatórios de caixa. O saldo do benefício é mensal: créditos do mês menos despesas do mês naquela conta, sem carryover e sem transação de expiração.

- **Por quê:** o usuário não quer aviso de expiração nem saldo acumulado; o valor é recurso do mês.
- **Efeito:** `fin contas listar` mostra o disponível do mês corrente para VA/VT; o histórico continua auditável pelos lançamentos.

### 8. Relatórios derivados

Nenhum total é persistido. `summary.js` recebe listas de transações e devolve totais:

- **previsto:** todas as transações não canceladas do mês;
- **realizado:** apenas `pago`/`recebido`;
- **fluxo:** receitas − despesas, sem transferências;
- **disponível:** fluxo previsto − aporte planejado da meta;
- **patrimônio:** contas de caixa + cofrinho + benefícios do mês.

As views do DB Browser replicam os mesmos conceitos em reais para consulta independente da CLI.

### 9. CLI com Commander e Inquirer

`commander` para comandos/opções e `@inquirer/prompts` para o menu e confirmações. Tabelas são formatadas por um helper próprio com largura de coluna e `util.styleText` para cores; sem chalk e sem cli-table.

- **Por quê:** duas dependências pequenas, saída controlada e testável.
- **Testes:** casos de uso recebem `today` e repositórios; a CLI é testada por spawn de `bin/fin.js` com banco temporário via `FIN_DB_PATH`.
- **Erros:** `DomainError` com mensagem pt-BR; a CLI imprime e retorna código 1. Comandos de leitura retornam 0.

### 10. Seed e dados iniciais

`fin init` cria schema, views, feriados, contas, categorias, contratos, regras, meta e o previsto de autoescola de dezembro. `fin mes abrir 2026-12` gera os demais previstos. O seed é idempotente por chaves naturais (`accounts.name`, `categories.name`, etc.).

Contas: `conta-corrente`, `carteira`, `cofrinho`, `flash-va`, `flash-vt`.
Contratos: C1 45,86 (2 restantes), C2 14,22 (4), C3 64,60 (15), C4 16,60 (5), C5 89,61 (1).
Regras: salário 1.700 (5º dia útil), 13º 1.100 (18/12), energia 300, internet 133, VA 500, VT 200.
Meta: Moto, 3.500 até 2028-03, aporte 800, início 2026-12.

### 11. Simulação da moto

`fin simular moto` é cálculo puro, sem escrita. Meses de aporte = do mês inicial da meta (ou mês corrente, o que for maior) até o mês da compra, inclusive. Saída = entrada + primeira parcela. Fluxo pós-compra = salário − contas fixas − parcela; se o aporte continuar, subtrai o aporte. Cobertura do cofrinho = saldo restante ÷ déficit mensal.

## Risks / Trade-offs

- **`node:sqlite` relativamente novo** → API encapsulada em um único módulo; testes de integração cobrem migração e CRUD; requisito `engines: >=26`.
- **DB Browser aberto trava escrita** → `busy_timeout=5000`, `journal_mode=DELETE`, mensagem clara de erro e recomendação de fechar o DB Browser durante o uso.
- **Repositório público** → `.gitignore` com `data/`, `*.db`, `*.db-*`; README com alerta; `fin init` avisa se `data/` não estiver ignorado.
- **Seed com suposições** (parcelas pagas, datas estimadas) → valores editáveis; comandos de edição e testes fixam o cenário acordado.
- **Benefício sem carryover** → saldo mensal derivado pode surpreender quem espera conta corrente; o resumo rotula “VA/VT do mês”.
- **Aporte planejado ≠ transferência** → relatórios mostram os dois valores separados para evitar falsa sensação de saldo.
- **Feriados incompletos** → tabela editável; o cálculo do 5º dia útil depende do cadastro correto.

## Migration Plan

1. Banco novo: `fin init` aplica a migração `001_initial.sql`, insere o seed e cria as views.
2. Evolução futura: cada alteração vira `00N_descricao.sql`, aplicada em transação e registrada em `schema_migrations`.
3. Rollback: como não há dados de produção no início, basta apagar `data/financas.db` e rodar `fin init`; depois do uso real, restaurar a cópia manual documentada no README.
4. Nenhuma migração cria ou altera arquivos fora de `data/`.

## Open Questions

- Dias de vencimento de energia, internet e contratos seguem “a definir”; serão editáveis sem impacto no schema.
- O crédito de VA/VT foi fixado no dia 1º conforme o acordo final; se o Flash creditar no último dia do mês anterior, basta ajustar a regra de data, sem mudar o modelo.
