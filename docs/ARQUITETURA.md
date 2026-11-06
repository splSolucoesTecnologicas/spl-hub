# Arquitetura — regras das camadas

Monólito modular hexagonal em `apps/api`. As setas de dependência apontam para dentro.

## Camadas
| Camada | Pasta | Pode importar | Não pode importar |
|---|---|---|---|
| Domínio | `modules/*/domain` | o próprio domínio e `shared/domain` | zod, prisma, fastify, fetch, process.env |
| Aplicação | `modules/*/application` | domínio, suas portas, `shared/application` | adapters, frameworks, banco |
| Adapters de entrada | `adapters/in/*` | casos de uso, `@spl/contracts`, Fastify | Prisma |
| Adapters de saída | `adapters/out/*`, `integrations/*` | portas, domínio, libs de infra | rotas HTTP |
| Composição | `src/app.ts`, `src/main.ts`, `src/configuracao.ts`, `src/seed` | tudo | — |

## Módulos deste corte
- **acesso** — login e-mail + senha, TOTP, sessão, vínculo sócio/colaborador, área, permissões por módulo, auditoria.
- **tarefas** — CRUD e colunas do quadro. A sincronização com o GitHub vive inteira em `application/sincronizacao-github.ts`: envio da Tarefa como issue e status no board, eventos do webhook, importação de issues e ressincronização manual. O webhook só verifica a assinatura e traduz o payload.
- **operacao** — clientes, projetos, decisões e objetivos. O Projeto guarda o `VinculoGithub` (repositório, board e mapa coluna ⇄ opção de status); a porta `CatalogoGithub` lista repositórios, boards e opções para a tela de edição.
- **blog** — publicação autenticada e leitura pública (`GET /blog`, `GET /blog/:slug`) consumida pela landing.

`integrations/github` tem os adapters do GitHub (App real, fake em memória e desligado), cada um atendendo `GitHubProjetos` e `CatalogoGithub`. `integrations/thumdra` segue o template: porta `ThumdraAdminClient`, fake e HTTP com client credentials em `/admin/v1`.

## Regras
1. Domínio valida invariantes e lança `ErroDeDominio`.
2. Adapters implementam portas; a aplicação não conhece Prisma nem o GitHub.
3. Casos de uso recebem repositório, relógio e gerador de id por parâmetro.
4. Entrada HTTP é validada com Zod de `@spl/contracts`.
5. Módulos não leem a tabela de outro módulo.
6. Thumdra e os outros produtos só entram por API, nunca pelo banco deles.
7. Erros HTTP em `application/problem+json` (RFC 9457).
8. Listas paginadas por cursor: `{ data, nextCursor }`.
9. Variáveis de ambiente só são lidas em `src/configuracao.ts`. O resto recebe valores já validados; o que deixaria a API rodando errado em silêncio impede a subida, e o que só desliga uma integração vira aviso no log.

## Hub
As telas pedem dados a `apps/hub/lib/dados.ts` pelo nome do recurso: rotas, paginação por cursor, conferência com os schemas de `@spl/contracts` e cache de pessoas e clientes ficam ali. O transporte é o seam: HTTP em produção, em memória nos testes (`pnpm --filter @spl/hub test`). Carga e erro passam por `useCarregamento` e `useAcao`.

## Testes
Domínio e casos de uso sem I/O. Integração com `app.inject`. Postgres real só se `TEST_DATABASE_URL` estiver definida — o padrão da suíte é o adapter em memória.
