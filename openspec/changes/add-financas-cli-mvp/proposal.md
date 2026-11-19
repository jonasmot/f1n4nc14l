# Proposal

## Why

O controle financeiro atual vive em um script hardcoded (`f1n4nc14l.js`), sem banco de dados, sem histórico e sem forma prática de registrar o dia a dia. O projeto precisa de um CLI local em pt-BR, com dados em SQLite, que acompanhe receitas, despesas, contratos, benefícios VA/VT, cofrinho e projeções mensais a partir de dezembro/2026 — e que sirva de base para um servidor local no futuro.

## What Changes

- Criar o pacote `financas-cli` com o comando `fin`, instalável via `npm link`, em JavaScript sobre `node:sqlite` (sem ORM, sem Docker).
- Implementar um monólito modular com camadas `domain`, `application`, `infrastructure` e `cli`, para que um futuro servidor reaproveite o núcleo.
- Criar o banco `data/financas.db` com migrações versionadas, seed de dezembro/2026 e views em reais para uso no DB Browser for SQLite.
- Registrar receitas e despesas individuais, com status `previsto` / `pago` / `recebido` / `cancelado`, e permitir pagar/receber com valor ajustado.
- Modelar contas (corrente, carteira, cofrinho, VA, VT), transferências, benefícios mensais sem carryover, recorrências (salário, 13º, energia, internet, VA/VT) e os 5 contratos com parcelas restantes.
- Implementar `fin mes abrir <YYYY-MM>` idempotente, que gera os lançamentos previstos do mês a partir de recorrências e contratos, e `fin previsao` que projeta sem gravar.
- Implementar relatórios derivados: resumo mensal, gastos por categoria, evolução mês a mês e resumo semanal com “disponível”.
- Implementar a meta do cofrinho (moto: CNH R$ 100, entrada R$ 3.500, primeira parcela R$ 780 e capacete R$ 500, total R$ 4.880 até março/2027, aporte planejado de R$ 850/mês), a projeção mês a mês e a simulação de financiamento R$ 780 × 48 sem gravar dados.
- Criar menu interativo em pt-BR, além dos comandos, e documentar uso e backup manual no README.
- Substituir o `.gitignore` de Python por regras Node/SQLite que excluem `data/` e arquivos `*.db`; nenhum dado financeiro pode ser commitado.

## Capabilities

### New Capabilities

- `accounts`: cadastro e consulta de contas, saldos, transferências e benefícios VA/VT com renovação mensal.
- `transactions`: lançamentos de receita e despesa, edição/remoção e ciclo de status até pagamento ou recebimento.
- `recurring-rules`: regras recorrentes de salário, 13º, energia, internet e créditos de VA/VT, incluindo cálculo do 5º dia útil.
- `contracts`: planos de parcelamento dos 5 contratos, agenda de parcelas, saldo restante e mês de término.
- `monthly-planning`: abertura idempotente do mês com geração de previstos e projeção de meses futuros sem gravação.
- `reporting`: resumo mensal, gastos por categoria, evolução histórica e resumo semanal com disponível.
- `savings-goal`: cofrinho como reserva separada, meta da moto, aportes e simulação de financiamento.
- `cli`: comandos em pt-BR, menu interativo e formatos de saída.
- `storage`: schema SQLite, migrações, views para DB Browser, integridade e proteção dos dados locais.

### Modified Capabilities

Nenhuma — projeto sem specs existentes.

## Impact

- **Código:** cria `bin/`, `src/domain`, `src/application`, `src/infrastructure`, `src/cli`, `test/`, `package.json` e `data/.gitkeep` no repositório `C:\Users\jonas\Documentos\clone\f1n4nc14l`.
- **Dependências:** Node.js 26.x (`node:sqlite` nativo), `commander`, `@inquirer/prompts`; testes com `node:test`. Sem ORM e sem Docker.
- **Dados:** banco local em `data/financas.db`, ignorado pelo Git; seed inicial de dezembro/2026 com contas, categorias, 5 contratos, recorrências e meta.
- **Integrações:** DB Browser for SQLite via views; Git permanece público e sem commits automáticos.
- **Fora de escopo:** cartão de crédito, orçamento por categoria, backup automático, criptografia, servidor/API e quitação antecipada de contratos.
