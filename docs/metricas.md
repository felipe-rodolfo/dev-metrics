# Regras de métricas e decisões técnicas

Este documento descreve o que cada métrica mede, como cada fonte é consultada e as decisões que afetam o resultado. Para uso e configuração, veja o [README](../README.md).

## Objetivo

Gerar, sob demanda, um relatório local de métricas de **um** desenvolvedor, em um intervalo de datas, para apoiar a avaliação semestral. Cada pessoa roda a ferramenta com os próprios tokens, e só consulta dados aos quais já tem acesso.

O relatório mostra números acompanhados do contexto que os explica. Não é uma nota automática de desempenho: métricas isoladas são fáceis de interpretar mal, então o relatório mostra a divisão por tipo de issue e o tamanho dos PRs/MRs junto com os totais.

## Intervalo de datas

`--from` e `--to` são **inclusivos** nos dois extremos. Cada evento é atribuído pela data em UTC.

## Métricas

### Jira: entregas

- **Issues concluídas**: issues que o usuário autenticado moveu para um status da categoria *concluído* dentro do período, agrupadas por tipo.
- Os nomes dos statuses concluídos vêm da própria instância (`GET /rest/api/3/status`, categoria `done`), e não ficam fixos no código. Isso é necessário porque os nomes variam por idioma e configuração.
- **Atribuição**: a data usada é a de resolução da issue (`resolutiondate`), e não a data exata da transição. Se uma issue for reaberta e concluída de novo, a data pode cair em outro mês.
- **Story points**: média e mediana sobre as issues concluídas no período, ignorando issues sem estimativa. Se nenhuma issue do período tiver estimativa, aparece como "no data".
- O campo de story points é um custom field do Jira, cujo ID varia por instância. O adaptador descobre o campo em `GET /rest/api/3/field`, procurando por um nome como "Story Points" ou "Story point estimate". Quando a instância usa outro nome, defina `JIRA_STORY_POINTS_FIELD` com o ID do campo (ex.: `customfield_10016`) para pular a busca por nome.

### GitHub e GitLab: atividade de código

Cada plataforma tem a própria seção no relatório, com as métricas calculadas só com os dados dela.

- **PRs/MRs abertos**: criados no período e ainda abertos.
- **PRs/MRs mergeados**: mergeados no período, mesmo que tenham sido criados antes.
- **Fechados sem merge**: criados no período e fechados sem merge.
- **Tamanho mediano**: mediana de linhas alteradas (adições + remoções) e de arquivos alterados, só nos PRs/MRs mergeados no período. Se não houver nenhum, aparece como "no data", e não como zero.
- **Commits**: commits do próprio usuário com data dentro do período.
- **Cycle time**: média e mediana, em horas, do tempo entre a abertura e o merge, só nos PRs/MRs mergeados no período. Se não houver nenhum, aparece como "no data".

A mediana é usada no lugar da média para que um PR muito grande não distorça o resultado.

### O que "cycle time" significa aqui

É o tempo entre a abertura e o merge do PR/MR, não o tempo de ciclo de status do Jira (do início do trabalho até a conclusão da issue). Esse segundo tipo de cycle time exigiria o histórico de transições de status de cada issue (uma chamada extra por issue) e uma definição de "início do trabalho" que varia por time, e por isso continua fora do escopo desta ferramenta.

## Decisões técnicas

### Identidade do usuário vem do token

Como cada pessoa usa o próprio token, a identidade é obtida pela API: `/myself` no Jira, `/user` no GitHub e no GitLab. Não é preciso cruzar identidades entre sistemas.

### Falha parcial, nunca silenciosa

Se uma fonte falhar, o relatório é gerado com a seção dessa fonte marcada como incompleta, com o motivo. A CLI sai com código diferente de zero. Os dados das outras fontes continuam no relatório.

Se o token for recusado, a CLI para antes de buscar qualquer dado.

### Limite de 1000 resultados no GitHub

A API de busca do GitHub devolve no máximo 1000 resultados por consulta. Se a consulta tiver mais, o adaptador **falha** em vez de contar a menos. Um total silenciosamente incompleto seria um erro difícil de perceber.

### Bulk push no GitLab

Quando um push ultrapassa o limite `push_event_activities_limit` da instância, o GitLab envia um evento *bulk push* com `commit_count: 0`, sem a lista de commits. Nesse caso a contagem de commits fica subestimada.

O adaptador marca a contagem de commits como incompleta quando encontra um push com contagem zero, **exceto** criação ou remoção de branch, que também têm contagem zero, mas não são bulk push.

Essa detecção é conservadora: pode haver um aviso sem bulk push real. Não há como confirmar se um evento é bulk push só pela resposta da API.

### Tokens e segurança

- Tokens só vêm de variáveis de ambiente. Nunca aparecem no relatório, nos logs ou em mensagens de erro.
- O arquivo `.env` é ignorado pelo git.
- Os tokens são enviados em cabeçalhos (`Authorization` ou `PRIVATE-TOKEN`), nunca na URL.

### Relatório em inglês, arquivo em `reports/`

O relatório é gerado em inglês, em `reports/report-<from>_<to>.md`. A pasta `reports/` é ignorada pelo git, porque o relatório contém dados de avaliação de uma pessoa.

## Permissões necessárias

### GitHub (token fine-grained)

- Repositórios: acesso aos repositórios em que o usuário trabalha.
- Permissões: `Metadata: read` e `Pull requests: read`.

### GitLab (token fine-grained)

A API recusa a chamada com erro `insufficient_granular_scope` quando falta uma permissão, e informa qual é. As que foram exigidas no teste com a conta real:

- **User: Read** (grupo *System Access*)
- **Event: Read** e **Project: Read** (grupo *Projects*)
- **Merge Request: Read** (grupo *Repository*)

Para a leitura dos diffs das MRs e dos commits, também está marcada a permissão de **Code: Read** e **Commit: Read** no grupo *Repository*. Essas duas não foram verificadas isoladamente.

### Jira

- API token da conta Atlassian, com `JIRA_BASE_URL` e `JIRA_EMAIL`. O adaptador usa a API **Cloud** (`/rest/api/3`). Data Center ou Server não são suportados.

## Limitações conhecidas

- A verificação ponta a ponta com um bulk push real ainda não foi feita.
- O caminho positivo do Jira (uma issue movida para concluído aparecendo no relatório) foi testado só com testes unitários, porque a conta de teste não tinha nenhuma issue concluída.
- A consulta do GitHub depende do login do usuário autenticado. Commits feitos com outro login não entram na contagem.
