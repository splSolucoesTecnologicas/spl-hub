# spl-hub

Monorepo da [SPL Soluções Tecnológicas](https://splsolucoes.com). O repositório no GitHub é `splSolucoesTecnologicas/spl-hub` (o nome antigo `spl-landing-page` redireciona).

| Pasta | O que é | Domínio |
|---|---|---|
| `apps/landing` | Site institucional (Vite, o mesmo de produção) | splsolucoes.com |
| `apps/hub` | Hub interno (Next.js) | hub.splsolucoes.com |
| `apps/api` | API do hub (Fastify 5, hexagonal) | api atrás do Traefik |
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

O blog é buscado **no build** (`apps/landing/scripts/buscar-noticias.mjs`) e gravado no JS e no `index.html`. Sem a variável `VITE_API_URL`, a seção sai vazia e o site no ar segue igual. O workflow também escuta `workflow_dispatch` e `repository_dispatch` `blog-publicado`. A API só pede esse rebuild se `PAGES_DISPATCH_TOKEN` e `PAGES_DISPATCH_REPOSITORIO` existirem.

### Alvo: um domínio no Dokploy (Traefik)

Quando o DNS apontar para o servidor, o mesmo host divide os três apps. O compose **não** dispara esse deploy; só deixa os Dockerfiles e as labels prontos.

| Caminho | Serviço | Porta interna |
|---|---|---|
| `splsolucoes.com/` | `apps/landing` (nginx, export estático) | 80 |
| `splsolucoes.com/hub` | `apps/hub` (Next, `basePath: '/hub'`) | 3000 |
| `splsolucoes.com/api` | `apps/api` (o Traefik remove o prefixo `/api`) | 3333 |

A sessão do hub é um cookie `spl_sessao` com `Path=/hub` (e `Secure` só em HTTPS). A landing em `/` não recebe esse cookie. Chamadas à API levam `Authorization: Bearer`, porque o cookie não vale em `/api`.

No servidor:

```bash
docker compose -f docker-compose.yml -f docker-compose.dokploy.yml up -d --build
```

O override entra na rede externa `dokploy-network`, tira as portas do host e define `NEXT_PUBLIC_API_URL` e `VITE_API_URL` como `https://splsolucoes.com/api`. As labels usam o entrypoint `websecure` e o certresolver `letsencrypt`. Prioridade maior em `/hub` e `/api`; o resto cai na landing.

### Troca de DNS (quando for a hora)

1. Subir o compose no Dokploy e abrir `https://splsolucoes.com`, `/hub` e `/api/health` pelo IP ou por um host de teste.
2. Criar o registro **A** de `splsolucoes.com` para o IP do servidor.
3. Esperar o certificado e conferir os três caminhos.
4. Desligar o GitHub Pages (Settings → Pages) para o domínio não disputar com o A.
5. A partir daí, notícia nova pede rebuild da **imagem da landing** no Dokploy. O dispatch para o Pages pode sair.

`GITHUB_ADAPTER=fake` (padrão) não chama o GitHub. `GITHUB_ADAPTER=http` escolhe o adapter real, que ainda responde 501.

## O que ainda é esboço

No hub: Projetos, Reuniões, Podcast, Drive, Sócios e Configurações. Clientes é uma tabela de exemplo (sem módulo na API) ligada ao mapa. Blog, Tarefas, Time e Acesso já falam com a API. Decisões e objetivos da Início são dados de exemplo, marcados na tela.

## Commits

`tipo(escopo): descrição em português`, no imperativo. Tipos do guia da org, inclusive `version`. Branches de produto: `feature/…` e `hotfix/…`. Esta entrega foi aberta pela automação em `cursor/monorepo-hub-b520`.
