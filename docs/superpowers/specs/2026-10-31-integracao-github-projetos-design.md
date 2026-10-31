# Integração com GitHub para Projetos — Design

## Contexto

O Hub já tem um módulo de Tarefas (quadro Kanban: a_fazer/fazendo/revisao/feito) e um botão "Sincronizar"
que empurra tarefas pro GitHub como issues, usando um único token compartilhado
(`GITHUB_TOKEN`/`GITHUB_OWNER`/`GITHUB_PROJECT`). O adapter real (`StubGitHubProjetos`) está esboçado mas
nunca chamou a API de verdade — só existe `FakeGitHubProjetos`, que espelha em memória.

Cada Projeto no Hub já tem um campo `repositorio` (texto, validado no formato `dono/nome`), mas hoje é só
um link de exibição — não conecta com nada.

A SPL quer: cada Projeto linkado ao seu próprio repositório privado do GitHub; uma aba "Issues" na página do
Projeto listando as issues desse repo; o quadro Kanban de Tarefas espelhando essas issues; e sincronização
em **dois sentidos** — mudar uma issue no GitHub (incluindo mover no board do GitHub Projects) reflete no
Hub, e vice-versa.

## Decisões já tomadas (conversa com o usuário)

- **Identidade**: GitHub App instalado na organização (não OAuth por pessoa). O App já foi criado:
  `spl-hub-projetos`, App ID `5557350`, Installation ID `177273178`, permissões Issues (R/W),
  Metadata (R), Projects de organização (R/W), webhook ativo com eventos `issues` e `projects_v2_item`.
- **Escopo do vínculo**: por Projeto — cada Projeto do Hub aponta pro seu próprio repositório.
- **Organizações**: uma só (`splSolucoesTecnologicas`). Os "produtos" internos (Thumdra, Corujuris etc.) são
  só uma tag de categoria no Hub, não orgs separadas no GitHub — não precisa de múltiplas instalações do App.
- **Granularidade do quadro**: sincroniza as colunas reais do GitHub Projects (board v2), não só aberta/fechada.
- **Visibilidade**: um card em Configurações mostra pra qualquer pessoa logada se a integração está conectada.

## Não-objetivos (fora desta entrega)

- Criar repositórios novos pelo Hub — só linka repositórios que já existem.
- OAuth por pessoa / "Conectar minha conta GitHub".
- Sincronizar Pull Requests (o campo `pullRequest` da Tarefa continua sendo preenchido manualmente, como hoje).
- Suporte a múltiplas organizações GitHub.
- Comentários de issue espelhados no Hub (fica para uma entrega futura, se precisar).

## Arquitetura

### Autenticação: App → token de instalação

O App assina um JWT curto (RS256, com a chave privada `.pem`), troca esse JWT por um **token de instalação**
via `POST /app/installations/{installation_id}/access_tokens` — token válido por ~1h, com as permissões do
App. Um `GitHubAuthProvider` no backend mantém esse token em cache de processo e renova quando expira ou
falta pouco tempo. Isso substitui o token fixo de hoje; variáveis de ambiente novas:

```
GITHUB_APP_ID=5557350
GITHUB_APP_PRIVATE_KEY=<conteúdo do .pem, ou caminho de arquivo — decide na seção Operações>
GITHUB_APP_INSTALLATION_ID=177273178
GITHUB_WEBHOOK_SECRET=<o secret definido na criação do App>
GITHUB_ADAPTER=app   # substitui o antigo "http"
```

### Porta `GitHubProjetos` (ampliada)

A interface hoje só tem `sincronizar()`. Cresce para cobrir o necessário, mantendo `FakeGitHubProjetos` como
implementação de testes/dev (sem rede) e uma nova `AppGitHubProjetos` como implementação real:

```ts
interface GitHubProjetos {
  readonly modo: 'fake' | 'app';
  listarRepositorios(): Promise<{ owner: string; nome: string }[]>;
  listarProjetosDoRepo(owner: string, repo: string): Promise<{ numero: number; titulo: string }[]>;
  listarOpcoesDeStatus(owner: string, numeroProjeto: number): Promise<{ id: string; nome: string }[]>;
  criarOuAtualizarIssue(input: {
    owner: string; repo: string; issueNumero: number | null; titulo: string; estado: 'open' | 'closed';
  }): Promise<{ issueNumero: number; nodeId: string }>;
  definirStatusNoProjeto(input: {
    owner: string; numeroProjeto: number; itemNodeId: string | null; issueNodeId: string; opcaoStatusId: string;
  }): Promise<{ itemNodeId: string }>;
}
```

`AppGitHubProjetos` usa `@octokit/rest` (issues) e `@octokit/graphql` (Projects v2, que só existe em GraphQL).
Chamadas de leitura (`listarRepositorios`, etc.) alimentam as telas de configuração do vínculo; as de escrita
alimentam o sync de saída (Hub → GitHub).

## Modelo de dados

### Projeto (reaproveita e estende)

O campo `repositorio` já existe e já é validado como `dono/nome` — vira o vínculo com o repo, sem mudança de
schema para isso. Dois campos novos:

```prisma
githubProjectNumero Int?      // número do board do GitHub Projects (v2) linkado
githubColunaMap      Json?    // { a_fazer: "<id da opção Status>", fazendo: "...", revisao: "...", feito: "..." }
```

`githubColunaMap` é preenchido uma vez, quando a pessoa linka o Projeto (ver seção UI). Sem ele, o projeto
fica só com leitura de issues (sem mover coluna automaticamente) — degrada graciosamente.

### Tarefa (dois campos novos, para casar com itens do GitHub de forma confiável)

```prisma
githubIssueNumero   Int?     // número da issue no repo (distinto de "referencia", que é só o texto exibido)
githubItemNodeId    String?  // node id do item no board do GitHub Projects v2 (necessário pra mutations)
```

`referencia` continua existindo como está (texto tipo `dono/repo#42`, mostrado na UI); os campos novos são uso
interno pra casar webhook ↔ tarefa e pra chamar a API sem reconstruir nada a partir de texto.

## Fluxo de sincronização

### Hub → GitHub (saída)

Disparado quando uma Tarefa de um Projeto com `repositorio` + `githubProjectNumero` preenchidos é criada,
tem o título editado, ou muda de coluna:

1. Sem `githubIssueNumero` ainda → cria a issue (`criarOuAtualizarIssue`), guarda `githubIssueNumero`,
   `referencia` e o node id da issue.
2. Adiciona a issue ao board do GitHub Projects (se ainda não estiver) e chama `definirStatusNoProjeto` com a
   opção de Status correspondente à coluna atual, via `githubColunaMap`.
3. Se a tarefa for pra coluna `feito`, fecha a issue (`estado: 'closed'`); sair de `feito` reabre.

O botão "Sincronizar" que já existe continua funcionando como uma passada manual em lote (útil pra tarefas
antigas ou se um evento de webhook falhar).

### GitHub → Hub (entrada, via webhook)

`POST /github/webhook`:

1. Verifica a assinatura (`X-Hub-Signature-256`, HMAC-SHA256 com `GITHUB_WEBHOOK_SECRET`, comparação em tempo
   constante). Assinatura inválida → 401, não processa.
2. Evento `issues` (ações `opened`, `edited`, `closed`, `reopened`): acha a Tarefa pelo par
   (`projetoId` do Projeto cujo `repositorio` bate com o repo do evento) + `githubIssueNumero`. Se não achar
   e a ação for `opened`, cria uma Tarefa nova vinculada ao Projeto (alguém abriu a issue direto no GitHub).
   Atualiza título e, se fechou/reabriu, move pra `feito`/`a_fazer`.
3. Evento `projects_v2_item` (ação `edited`, campo alterado é o de Status): acha a Tarefa pelo
   `githubItemNodeId`, traduz a opção de Status recebida pra coluna via `githubColunaMap` (busca reversa) e
   atualiza `coluna`.
4. Esse caminho **nunca chama o código de saída** (não reaplica em GitHub o que acabou de vir de lá) — isso
   evita loop infinito entre os dois lados. Responde `200` rápido mesmo se algo falhar (loga o erro), porque é
   assim que o GitHub espera que um webhook se comporte.

## UI

### Vincular Projeto ao GitHub (tela de edição de Projeto, admin)

1. Campo `repositorio` continua como está (texto `dono/nome` — passa a também poder ser escolhido de uma
   lista, via `GET /github/repositorios`, que lista os repos que o App tem acesso).
2. Dropdown com os boards de GitHub Projects daquele repo (`GET /github/repositorios/:owner/:repo/projetos`).
3. Depois de escolher o board, uma tela de mapeamento: 4 dropdowns (um por coluna do Hub) com as opções de
   Status daquele board, pra montar o `githubColunaMap`. Pode ser refeito depois se o board mudar.

### Aba "Issues" no Projeto

Na página de detalhe do Projeto (`/projetos/[id]`), uma aba nova "Issues" lista as Tarefas daquele
`projetoId` que têm `githubIssueNumero` — título, coluna atual (traduzida pro nome em pt-BR), link pra issue
no GitHub. É a mesma informação do quadro Kanban de Tarefas, só filtrada por projeto e em lista em vez de
colunas.

### Quadro de Tarefas

Cards com `referencia` preenchida ganham um indicador visual (ícone + link) de que vieram do GitHub —
ajuste pequeno de estilo no `.cartao` já existente, sem mudar a estrutura do quadro.

### Configurações — status da integração

Card novo, visível a qualquer pessoa logada (não só admin), mostrando se a integração está conectada:
`GET /github/status` retorna `{ conectado: boolean, organizacao: string | null }` (não expõe token nem
nenhum segredo — só confirma que o backend conseguiu emitir um token de instalação).

## Segurança

- Chave privada e webhook secret só em variável de ambiente, nunca no banco nem no repositório.
- Assinatura do webhook é obrigatória; sem ela, a requisição é rejeitada antes de tocar em qualquer dado.
- Vincular/desvincular repositório e editar o mapeamento de colunas exige permissão `projetos`/`editar`
  (mesma regra que já existe pra editar Projeto).
- O App só tem acesso aos repositórios selecionados na instalação — nunca à organização inteira por padrão.

## Testes

- `FakeGitHubProjetos` ganha os métodos novos, com dados em memória, pra testar os casos de uso sem rede
  (padrão já usado no projeto).
- Testes de domínio: validação do `githubColunaMap` (precisa cobrir as 4 colunas), tradução
  coluna → opção de Status e volta.
- Teste do endpoint de webhook: assinatura inválida rejeita; evento `issues` cria/atualiza Tarefa; evento
  `projects_v2_item` move de coluna; nenhum dos dois chama o caminho de saída (sem loop).
- Sem teste de integração real contra a API do GitHub (precisaria de credenciais reais) — fica pra validação
  manual depois do deploy, com um repositório de teste.

## Fora do código: Operações (resumo — detalhado à parte no chat)

- Variáveis de ambiente novas no Dokploy do serviço `api`.
- O arquivo `.pem` baixado vira o conteúdo de `GITHUB_APP_PRIVATE_KEY` (nunca comitado).
- Rodar a migração de banco (`githubProjectNumero`, `githubColunaMap` em Projeto; `githubIssueNumero`,
  `githubItemNodeId` em Tarefa) no deploy.
