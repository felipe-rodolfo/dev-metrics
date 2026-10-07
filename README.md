# dev-metrics

Gera um relatório local de métricas de um desenvolvedor (Jira, GitHub e GitLab) em um intervalo de datas, para avaliação semestral. Cada pessoa roda a ferramenta para si mesma, com os próprios tokens.

## Como obter os tokens

- **Jira**: crie um API token em https://id.atlassian.com/manage-profile/security/api-tokens. A URL base é a do seu site, por exemplo `https://sua-empresa.atlassian.net`.
- **GitHub**: crie um fine-grained personal access token com leitura de repositórios e de metadados.
- **GitLab**: crie um personal access token com o escopo `read_api`.

## Uso

Crie um arquivo `.env` na pasta do projeto (ele já está no `.gitignore`):

```bash
JIRA_BASE_URL=https://sua-empresa.atlassian.net
JIRA_EMAIL=voce@empresa.com
JIRA_API_TOKEN=...
GITHUB_TOKEN=...
GITLAB_BASE_URL=https://gitlab.com
GITLAB_TOKEN=...
```

```bash
npm run build
node dist/cli.js --from 2026-01-01 --to 2026-06-30
# ou com os aliases curtos:
node dist/cli.js -f 2026-01-01 -t 2026-06-30 -o ./relatorios
```

Veja todas as opções com `node dist/cli.js --help`, e a versão instalada com `node dist/cli.js --version`.

A CLI lê o `.env` da pasta de execução. Variáveis já definidas no terminal têm prioridade sobre ele.

O Jira é obrigatório. Defina também pelo menos um entre `GITHUB_TOKEN` e `GITLAB_TOKEN`. Se você usa as duas plataformas, defina as duas.

O relatório é gravado em `./reports/report-<from>_<to>.md` e, com as mesmas métricas, em `./reports/report-<from>_<to>.xlsx` (uma aba por fonte, mais uma aba "Sources" com o status de cada uma). A pasta `reports/` fica fora do git.

Se uma fonte falhar, o relatório é gerado com a seção dela marcada como incompleta, e a CLI sai com código diferente de zero.

## Testes

```bash
npm test
```

Os testes não chamam APIs reais. A verificação com contas reais é manual, seguindo o uso acima.
