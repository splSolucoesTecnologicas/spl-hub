# spl-hub

Monorepo da [SPL Soluções Tecnológicas](https://splsolucoes.com). O repositório no GitHub é `splSolucoesTecnologicas/spl-hub` (o nome antigo `spl-landing-page` redireciona).

| Pasta | O que é | Onde fica |
|---|---|---|
| `apps/landing` | Site institucional (Vite). Hoje no GitHub Pages | `splsolucoes.com` |
| `apps/hub` | Hub interno (Next.js, `basePath` `/hub`) | `splsolucoes.com/hub` |
| `apps/api` | API do hub (Fastify 5, hexagonal) | `splsolucoes.com/api` |
| `packages/contracts` | Zod + OpenAPI compartilhados | — |

A arquitetura da API está em [docs/ARQUITETURA.md](docs/ARQUITETURA.md). Identidade: verde `#00FF66`, preto `#050605`, Sora nos títulos e Inter no corpo.

## Como rodar

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm db:up                                  # Postgres 17. Opcional no dia a dia.
pnpm --filter @spl/api prisma:migrate       # só se PERSISTENCIA=prisma
pnpm dev                                    # landing :5173, hub :3000, api :3333
pnpm test
pnpm --filter @spl/contracts openapi
```

Sem Docker a API usa repositórios em memória (`PERSISTENCIA=memory`, padrão) e semeia dados **marcados como exemplo**.

Login de exemplo (não usar em produção):

- `segatto@splsolucoes.com` / `SplExemplo#2026` (admin, sem 2FA)
- `lucas@splsolucoes.com` / a mesma senha, com TOTP. Segredo de exemplo: `JBSWY3DPEHPK3PXP`

`SEED_EXEMPLO=false` e `NODE_ENV=production` não criam esses usuários. O primeiro admin real sai de `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_SENHA`.

O hub em dev abre em `http://localhost:3000/hub` (`basePath`). A landing em dev fica em `5173`.

```bash
docker compose up --build
```

Portas locais, sem Traefik: landing `8080`, hub `3000` (caminho `/hub`), API `3333`.

## Deploy

Hoje a landing de produção continua no **GitHub Pages** (workflow `.github/workflows/deploy.yml`, branch `main`, domínio `splsolucoes.com`). O `pnpm build` gera `./dist` com o `CNAME`. O workflow recusa o artefato se o CNAME não for `splsolucoes.com`. Nada disso muda até o DNS sair do Pages.

O blog é buscado **no build** (`apps/landing/scripts/buscar-noticias.mjs`). Sem notícia publicada, ou se a API não responde, a landing não mostra seção, links nem `/blog`. Com pelo menos uma notícia, o rebuild coloca tudo no ar. O workflow também escuta `workflow_dispatch` e `repository_dispatch` `blog-publicado`. A API só pede esse rebuild se `PAGES_DISPATCH_TOKEN` e `PAGES_DISPATCH_REPOSITORIO` existirem.

### Dokploy (Traefik), um arquivo de compose

O caminho do compose no Dokploy é só `docker-compose.prod.yml`. Ele não publica porta no host: o Traefik da rede `dokploy-network` encaminha o domínio. Depois de mudar as labels, use **Redeploy** nesse compose.

Na porta 80 cada serviço tem um router no entrypoint `web` que redireciona para HTTPS (301). O caminho `/.well-known/acme-challenge/` fica de fora: o Traefik do Dokploy responde o HTTP-01 da Let's Encrypt nele, com prioridade máxima. Sem esse 200 na porta 80 o certificado não sai e o HTTPS continua com o certificado padrão do Traefik. `www.splsolucoes.com` redireciona para `https://splsolucoes.com`. Todo router declara `service` — sem isso o Traefik responde 500. O `stripprefix` de `/api` fica só no router HTTPS.

| Caminho | Serviço | Porta interna |
|---|---|---|
| `splsolucoes.com/` | `apps/landing` (nginx, export estático) | 80 |
| `splsolucoes.com/hub` | `apps/hub` (Next, `basePath: '/hub'`) | 3000 |
| `splsolucoes.com/api` | `apps/api` (o Traefik remove o prefixo `/api`) | 3333 |

O Postgres lê `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_DB`. A senha é obrigatória (`${POSTGRES_PASSWORD:?}`): sem ela o compose não sobe. A `DATABASE_URL` da API é montada com esses três valores. Não preencha a URL à mão.

`PERSISTENCIA=prisma` e `TAREFAS_REPO=prisma`. Cada subida da API roda `prisma migrate deploy` antes do processo. O banco fica no volume nomeado `spl_pgdata`.

Cole no ambiente do Dokploy o que está em [`.env.producao.example`](.env.producao.example). `SEED_EXEMPLO` fica `false` no compose. O primeiro login sai de `BOOTSTRAP_ADMIN_EMAIL` e `BOOTSTRAP_ADMIN_SENHA`.

A sessão do hub é o cookie `spl_sessao` com `Path=/hub` (e `Secure` só em HTTPS). A landing em `/` não recebe esse cookie. A API recebe `Authorization: Bearer`.

Quem preferir os dois arquivos locais, em vez do arquivo único:

```bash
docker compose -f docker-compose.yml -f docker-compose.dokploy.yml up -d --build
```

O `docker compose up` da raiz continua sendo o ambiente local, com senha `spl` se `POSTGRES_PASSWORD` não estiver definida.

### Troca de DNS (quando for a hora)

O workflow de Pages e o `CNAME` continuam. Esta etapa não desliga nada.

1. No Dokploy, compose `docker-compose.prod.yml` e o ambiente do exemplo. Abra `/hub` e `/api/health` por um host de teste.
2. Criar o registro **A** de `splsolucoes.com` para o IP do servidor.
3. Esperar o certificado e conferir `/`, `/hub` e `/api/health`.
4. Só então desligar o GitHub Pages, para o domínio não disputar com o A.
5. Notícia nova pede rebuild da imagem da landing no Dokploy. O dispatch para o Pages pode sair.

`GITHUB_ADAPTER=fake` (padrão) não chama o GitHub. `GITHUB_ADAPTER=http` escolhe o adapter real, que ainda responde 501.

## O que ainda é esboço

Reuniões, Podcast, Drive e Configurações. Projetos, Clientes, Sócios (decisões e objetivos), Tarefas, Blog, Time e Acesso falam com a API. Em produção (`NODE_ENV=production` e `SEED_EXEMPLO=false`) essas listas começam vazias: não há cliente, projeto nem pessoa de exemplo. O login não mostra senha nem segredo TOTP.

As fontes do hub são Inter e Sora em `apps/hub/public/fonts`, servidas em `/hub/fonts`. Não há variável nova de ambiente. O redeploy da API aplica a migration `20261031120000_painel`. O hub passa a subir com `node .next/standalone/apps/hub/server.js` (`HOSTNAME=0.0.0.0`): `next start` com `output: standalone` respondia 500 nas rotas do painel.

## Commits

`tipo(escopo): descrição em português`, no imperativo. Tipos do guia da org, inclusive `version`. Branches de produto: `feature/…` e `hotfix/…`. Esta entrega foi aberta pela automação em `cursor/monorepo-hub-b520`.
