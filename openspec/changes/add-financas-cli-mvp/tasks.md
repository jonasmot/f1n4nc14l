# Tasks

## 1. Base do repositório

- [x] 1.1 Substituir o `.gitignore` de Python por regras Node/SQLite que ignorem `node_modules/`, `data/`, `*.db`, `*.db-*` e arquivos temporários; verificar com `git status --ignored` que `data/` aparece como ignorado
- [x] 1.2 Criar `package.json` com nome `financas-cli`, `"type": "module"`, bin `fin`, `engines.node >= 26`, scripts `test` e `start`, e instalar `commander` e `@inquirer/prompts`; verificar que `npm install` conclui sem erros
- [x] 1.3 Criar a estrutura `bin/`, `src/domain/`, `src/application/`, `src/infrastructure/`, `src/cli/`, `test/` e `data/.gitkeep`; verificar que os diretórios existem e que `data/financas.db` não existe ainda
- [x] 1.4 Escrever o README inicial com requisitos (Node 26), instalação, `npm link`, aviso de dados financeiros e backup manual; verificar que os passos documentados funcionam em uma cópia limpa

## 2. Domínio puro

- [x] 2.1 Implementar `domain/money.js` com parsing de `25`, `25.90` e `25,90` para centavos e formatação BRL; verificar com testes de valores válidos, inválidos e negativos
- [x] 2.2 Implementar `domain/dates.js` com validação ISO, mês `YYYY-MM`, último dia, soma de meses e formatação pt-BR; verificar com testes de virada de ano e fevereiro bissexto
- [x] 2.3 Implementar `domain/business-days.js` com feriados e cálculo do n-ésimo dia útil; verificar que dez/2026 retorna 07/12, jan/2027 retorna 08/01 e fev/2027 retorna 05/02
- [x] 2.4 Implementar `domain/schedule.js` com agenda e saldo restante de contratos; verificar total de R$ 1.290,21 e términos jan/2027, mar/2027, fev/2028, abr/2027 e dez/2026
- [x] 2.5 Implementar `domain/summary.js` com totais previstos/realizados, fluxo, disponível e patrimônio; verificar dez/2026 com fluxo R$ 1.856,11 e disponível R$ 1.056,11 após aporte de R$ 800,00
- [x] 2.6 Implementar a simulação da moto no domínio; verificar cofrinho de R$ 14.500,00, saída de R$ 4.280,00, restante de R$ 10.220,00, fluxo de R$ 487,00, fluxo com aporte de −R$ 313,00 e última parcela em fev/2032

## 3. Persistência SQLite

- [x] 3.1 Implementar `infrastructure/db.js` com abertura do arquivo, `foreign_keys=ON`, `busy_timeout=5000`, `journal_mode=DELETE` e caminho configurável por `FIN_DB_PATH`; verificar com teste em banco temporário
- [x] 3.2 Implementar o executor de migrações transacional com `schema_migrations`; verificar que reaplicar não duplica versões e que falha faz rollback
- [x] 3.3 Criar a migração `001_initial.sql` com todas as tabelas, checks, índices e o índice único de idempotência `(origin, origin_id, month)`; verificar o schema com `PRAGMA table_info` e um teste de constraint
- [x] 3.4 Criar as views `v_lancamentos`, `v_resumo_mensal`, `v_categorias`, `v_contratos`, `v_metas` e `v_beneficios` em reais; verificar cada view com dados de teste
- [x] 3.5 Implementar o seed idempotente com contas, categorias, feriados, cinco contratos, seis regras, meta e autoescola; verificar contagens e valores após rodar `init` duas vezes
- [x] 3.6 Implementar repositórios de contas, categorias e configurações; verificar CRUD e leitura de saldos derivados
- [x] 3.7 Implementar repositório de transações com filtros por mês, status, categoria, conta e tipo; verificar criação, edição, cancelamento e somas
- [x] 3.8 Implementar repositórios de recorrências, contratos e metas; verificar leitura das regras ativas e da agenda de parcelas

## 4. Casos de uso financeiros

- [x] 4.1 Implementar listagem e ajuste de contas e transferência entre contas; verificar que transferir R$ 800,00 move os saldos sem alterar receitas/despesas
- [x] 4.2 Implementar registro de receita e despesa, atalho de gasto pago e listagem de lançamentos; verificar status padrão e filtros por mês
- [x] 4.3 Implementar pagamento e recebimento com data e valor ajustado, além de edição e remoção com confirmação; verificar que pagar R$ 300,00 por R$ 312,45 atualiza o realizado
- [x] 4.4 Implementar saldo mensal de VA/VT sem carryover; verificar que uma compra com VA reduz o benefício e não altera o caixa

## 5. Planejamento mensal

- [x] 5.1 Implementar geração de lançamentos a partir de regras recorrentes, incluindo salário no 5º dia útil, 13º anual, contas fixas e créditos VA/VT; verificar as datas e valores de dez/2026
- [x] 5.2 Implementar geração de parcelas de contratos a partir de `paid_before_start`, `next_month` e `total_installments`; verificar que dez/2026 soma R$ 230,89 e que o Contrato 5 não aparece em jan/2027
- [x] 5.3 Implementar `mes abrir` idempotente e transacional; verificar 12 lançamentos em dez/2026, 9 em jan/2027 e zero duplicados na segunda execução
- [x] 5.4 Implementar `previsao` sem escrita, reutilizando o cálculo de geração; verificar jan/2027 com receitas R$ 1.700,00, despesas R$ 574,28, fluxo R$ 1.125,72 e disponível R$ 325,72
- [x] 5.5 Garantir que o aporte planejado não gera transferência automática e que o cofrinho reflete apenas transferências reais; verificar com um aporte de R$ 500,00

## 6. Relatórios

- [x] 6.1 Implementar o resumo mensal com previsto, realizado, fluxo, aporte, disponível, saldos e contratos restantes; verificar os números de dez/2026 e jan/2027
- [x] 6.2 Implementar gastos por categoria com percentual e seção separada de benefícios; verificar totais de uma massa de teste
- [x] 6.3 Implementar evolução dos últimos N meses com receitas, despesas, fluxo e cofrinho; verificar uma série de três meses
- [x] 6.4 Implementar resumo semanal de segunda a domingo com gastos, pendências de sete dias, VA/VT e disponível; verificar semana com e sem gastos

## 7. Meta e simulação

- [x] 7.1 Implementar progresso da meta, aportes e retiradas do cofrinho, com percentual e impacto no prazo; verificar meta de R$ 3.500,00 e saldo inicial de R$ 1.700,00
- [x] 7.2 Implementar `simular moto` como cálculo puro com os parâmetros padrão e cobertura do saldo restante; verificar que nenhuma escrita ocorre no banco

## 8. CLI e menu

- [x] 8.1 Criar `bin/fin.js` e o parser Commander com ajuda em português, códigos de saída e tratamento de `DomainError`; verificar `fin --help` e um erro de valor inválido
- [x] 8.2 Implementar comandos de contas, receitas, despesas, gasto, lançamentos, editar, remover, pagar e receber; verificar com testes de integração em banco temporário
- [x] 8.3 Implementar comandos de mês, contratos, previsão, transferência, meta e simulação; verificar as saídas principais em banco temporário
- [x] 8.4 Implementar o menu interativo com resumo do mês, ações numeradas e retorno ao menu; verificar o fluxo de registrar gasto e sair sem alterar dados
- [x] 8.5 Implementar formatação de tabelas, dinheiro, datas e sinais; verificar que R$ 133,00 de despesa aparece como `-R$ 133,00`
- [x] 8.6 Documentar todos os comandos e exemplos no README; verificar que cada exemplo executa em um banco temporário

## 9. Integração final

- [x] 9.1 Criar um teste E2E em banco temporário: `init`, abrir dez/2026, transferir R$ 800,00, conferir resumo, prever jan/2027, simular moto e consultar as views; verificar todas as asserções
- [x] 9.2 Executar `npm test` completo e `git status --porcelain`; verificar que todos os testes passam e que nenhum arquivo de `data/` aparece no Git
- [x] 9.3 Revisar README e documentação de backup manual; verificar que copiar `data/financas.db` com o app fechado é o procedimento descrito

## Workflow follow-up

- Mostrar o diff completo ao usuário e aguardar aprovação antes de qualquer commit.
- Arquivar a mudança `add-financas-cli-mvp` somente após a aceitação do MVP.
