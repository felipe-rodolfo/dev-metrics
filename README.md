# dev-metrics

Gera um relatório local de métricas de um desenvolvedor (Jira, GitHub e GitLab) em um intervalo de datas, para avaliação semestral. Cada pessoa roda a ferramenta para si mesma, com os próprios tokens.

## Como obter os tokens

- **Jira**: crie um API token em https://id.atlassian.com/manage-profile/security/api-tokens. A URL base é a do seu site, por exemplo `https://sua-empresa.atlassian.net`.
- **GitHub**: crie um fine-grained personal access token com leitura de repositórios e de metadados.
- **GitLab**: crie um personal access token com o escopo `read_api`.

## Uso

```bash
export JIRA_BASE_URL=https://sua-empresa.atlassian.net
export JIRA_EMAIL=voce@empresa.com
export JIRA_API_TOKEN=...
export GITHUB_TOKEN=...
export GITLAB_BASE_URL=https://gitlab.com
export GITLAB_TOKEN=...

npm run build
node dist/cli.js --from 2026-01-01 --to 2026-06-30
```

Defina só os tokens das fontes que você usa. Uma fonte sem token é ignorada.

O relatório é gravado em `./reports/report-<from>_<to>.md`. A pasta `reports/` fica fora do git.

Se uma fonte falhar, o relatório é gerado com a seção dela marcada como incompleta, e a CLI sai com código diferente de zero.

## Testes

```bash
npm test
```

Os testes não chamam APIs reais. A verificação com contas reais é manual, seguindo o uso acima.
