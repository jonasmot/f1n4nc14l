# Spec Delta

## Purpose

Persiste os dados localmente em um único arquivo SQLite versionado, com valores em centavos, views para consulta no DB Browser e proteção contra versionamento de dados financeiros.

## ADDED Requirements

### Requirement: Banco local único

O sistema SHALL armazenar os dados em `data/financas.db`, criando o diretório e o arquivo em `fin init`. O banco SHALL habilitar chaves estrangeiras e tempo de espera para locks.

#### Scenario: Primeira inicialização

- **WHEN** o usuário executa `fin init` em um repositório sem `data/`
- **THEN** o sistema cria `data/financas.db` com schema, seed e views, sem exigir configuração externa

#### Scenario: Banco já existente

- **WHEN** o usuário executa `fin init` com o banco já criado
- **THEN** o sistema não apaga dados e aplica apenas migrações pendentes

### Requirement: Migrações versionadas

O sistema SHALL controlar a versão do schema em `schema_migrations` e aplicar migrações em ordem, de forma idempotente e transacional.

#### Scenario: Aplicar migração pendente

- **WHEN** o sistema encontra uma versão de schema anterior à esperada
- **THEN** aplica as migrações pendentes em uma transação e registra a nova versão

#### Scenario: Falha na migração

- **WHEN** uma migração falha
- **THEN** o sistema desfaz a transação e mantém a versão anterior

### Requirement: Representação de dados

O sistema SHALL armazenar dinheiro como inteiro em centavos, datas em ISO `YYYY-MM-DD` e meses em `YYYY-MM`. A conversão para reais SHALL ocorrer apenas na saída e nas views.

#### Scenario: Valor persistido

- **WHEN** o usuário registra R$ 1.244,35
- **THEN** o banco armazena `124435` e a interface exibe `R$ 1.244,35`

### Requirement: Views para DB Browser

O sistema SHALL criar as views `v_lancamentos`, `v_resumo_mensal`, `v_categorias`, `v_contratos`, `v_metas` e `v_beneficios`, com valores monetários convertidos para reais e nomes legíveis.

#### Scenario: Abrir no DB Browser

- **WHEN** o usuário abre `data/financas.db` no DB Browser for SQLite
- **THEN** as views listam lançamentos, resumo, categorias, contratos, metas e benefícios com valores em reais

### Requirement: Proteção dos dados no Git

O sistema SHALL manter `data/`, arquivos `*.db` e `*.db-*` fora do controle de versão, e o README SHALL alertar que dados financeiros nunca devem ser commitados. Nenhum comando SHALL criar commit automaticamente.

#### Scenario: Status do Git limpo

- **WHEN** o usuário executa `git status` após usar o app
- **THEN** nenhum arquivo de `data/` aparece como modificado ou não rastreado

### Requirement: Backup manual documentado

O sistema SHALL documentar no README como copiar o banco com segurança. O MVP não SHALL automatizar backups nem exigir senha ou criptografia.

#### Scenario: Copiar o banco

- **WHEN** o usuário segue o README para backup
- **THEN** encontra instruções para fechar o app e copiar `data/financas.db` para outro local
