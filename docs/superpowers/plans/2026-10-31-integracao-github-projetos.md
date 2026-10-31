# Integração GitHub Projetos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Linkar cada Projeto do Hub a um repositório + board (GitHub Projects v2) via o GitHub App já instalado, sincronizando issues e colunas nos dois sentidos (push explícito/automático do Hub, webhook do GitHub).

**Architecture:** Segue a arquitetura hexagonal já usada no monorepo (domain/application/adapters por módulo). Porta `GitHubProjetos` cresce; `FakeGitHubProjetos` cobre os testes (sem rede); `AppGitHubProjetos` é o adapter real, usando `fetch` nativo do Node e `node:crypto` pra assinar o JWT do App (sem SDK novo). Webhook entra como rota isolada com content-type parser próprio pra ter acesso ao corpo bruto (necessário pra verificar assinatura HMAC).

**Tech Stack:** Node 24 (fetch, crypto nativos), Fastify, Prisma, Zod, React/Next.js (hub). Sem dependências novas.

**Spec:** `docs/superpowers/specs/2026-10-31-integracao-github-projetos-design.md`

## Global Constraints

- Chave privada e webhook secret só via variável de ambiente (`GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`); nunca no banco nem no git.
- Webhook sem assinatura válida → rejeitado antes de tocar em qualquer dado.
- Caminho de entrada (webhook) nunca chama o caminho de saída (push pro GitHub) — evita loop.
- `FakeGitHubProjetos` continua sendo o adapter de teste/dev; nenhum teste automatizado bate na API real do GitHub.
- Vincular/editar repo+board de um Projeto exige permissão `projetos`/`editar` (igual já existe hoje para editar Projeto).

---

### Task 1: Schema — campos novos em Projeto e Tarefa

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261031140000_github_integracao/migration.sql`

**Interfaces:**
- Produces: colunas `githubProjectNumero Int?`, `githubColunaMap Json?` em `Projeto`; `githubIssueNumero Int?`, `githubItemNodeId String?` em `Tarefa`.

- [ ] **Step 1:** Em `schema.prisma`, no `model Projeto`, logo após `adminUrl String?`, adicionar:
  ```prisma
  githubProjectNumero Int?
  githubColunaMap      Json?
  ```
  No `model Tarefa`, logo após `pullRequest String?`, adicionar:
  ```prisma
  githubIssueNumero Int?
  githubItemNodeId  String?
  ```
- [ ] **Step 2:** Criar `apps/api/prisma/migrations/20261031140000_github_integracao/migration.sql`:
  ```sql
  -- AlterTable
  ALTER TABLE "projetos" ADD COLUMN "githubProjectNumero" INTEGER,
  ADD COLUMN "githubColunaMap" JSONB;

  -- AlterTable
  ALTER TABLE "tarefas" ADD COLUMN "githubIssueNumero" INTEGER,
  ADD COLUMN "githubItemNodeId" TEXT;
  ```
- [ ] **Step 3:** Rodar `pnpm --filter @spl/api exec prisma generate` (sem `DATABASE_URL`, só gera o client) e confirmar que termina sem erro.
- [ ] **Step 4:** Commit:
  ```bash
  git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20261031140000_github_integracao
  git commit -m "feat(api): schema p/ vínculo de Projeto/Tarefa com GitHub"
  ```

---

### Task 2: Domínio — Projeto ganha vínculo GitHub

**Files:**
- Modify: `apps/api/src/modules/operacao/domain/projeto.ts`
- Test: `apps/api/test/operacao.domain.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: `ProjetoProps.githubProjectNumero: number | null`, `ProjetoProps.githubColunaMap: Record<Coluna, string> | null` (chaves fixas: `a_fazer`, `fazendo`, `revisao`, `feito`); getters `projeto.githubProjectNumero`, `projeto.githubColunaMap`; `Projeto.criar`/`projeto.atualizar` aceitam os dois campos.

- [ ] **Step 1: Teste falhando** — em `apps/api/test/operacao.domain.test.ts`, adicionar:
  ```ts
  it('valida o mapeamento de colunas do GitHub', () => {
    const agora = new Date();
    const projeto = Projeto.criar({ id: 'p1', nome: 'Teste', tipo: 'produto', status: 'piloto', cor: '#4c8dff', agora });
    expect(() => projeto.atualizar({ githubColunaMap: { a_fazer: 'opt1' } as any }, agora)).toThrow(/mapeamento/);
    projeto.atualizar({ githubProjectNumero: 3, githubColunaMap: { a_fazer: 'opt1', fazendo: 'opt2', revisao: 'opt3', feito: 'opt4' } }, agora);
    expect(projeto.githubProjectNumero).toBe(3);
    expect(projeto.githubColunaMap?.feito).toBe('opt4');
  });
  ```
- [ ] **Step 2:** Rodar `pnpm --filter @spl/api exec vitest run test/operacao.domain.test.ts` — esperado FAIL (propriedade/validação não existe).
- [ ] **Step 3: Implementação** — em `projeto.ts`:
  - Importar `COLUNAS` de `../../tarefas/domain/tarefa.js` (ou duplicar a lista local `['a_fazer','fazendo','revisao','feito'] as const` pra não criar dependência cruzada entre módulos — **usar a lista local**, já que `operacao` não depende hoje de `tarefas`).
  - Em `ProjetoProps`, adicionar `githubProjectNumero: number | null; githubColunaMap: Record<string, string> | null;`.
  - No `static criar`, no objeto inicial (linha com `repositorio: null, quadroUrl: null, ...`), adicionar `githubProjectNumero: null, githubColunaMap: null,`.
  - No método privado `aplicar`, no parâmetro de entrada, adicionar `githubProjectNumero?: number | null; githubColunaMap?: Record<string, string> | null;`.
  - Dentro de `aplicar`, antes de `this.props.nome = nome;`, validar e montar:
    ```ts
    const COLUNAS_HUB = ['a_fazer', 'fazendo', 'revisao', 'feito'] as const;
    if (input.githubColunaMap !== undefined && input.githubColunaMap !== null) {
      const chaves = Object.keys(input.githubColunaMap);
      const completo = COLUNAS_HUB.every((coluna) => typeof input.githubColunaMap![coluna] === 'string' && input.githubColunaMap![coluna].length > 0);
      if (!completo || chaves.length !== COLUNAS_HUB.length) {
        throw new ErroDeDominio('mapeamento_incompleto', 'Mapeamento de colunas precisa cobrir a_fazer, fazendo, revisao e feito');
      }
    }
    ```
  - No final de `aplicar`, junto das outras atribuições: `this.props.githubProjectNumero = input.githubProjectNumero ?? this.props.githubProjectNumero ?? null;` — **cuidado**: isso precisa só atualizar quando `input.githubProjectNumero !== undefined`. Usar:
    ```ts
    if (input.githubProjectNumero !== undefined) this.props.githubProjectNumero = input.githubProjectNumero;
    if (input.githubColunaMap !== undefined) this.props.githubColunaMap = input.githubColunaMap;
    ```
    (nota: `aplicar` hoje é chamado tanto por `criar` — que passa tudo — quanto por `atualizar`, que faz `{ ...this.props, ...input }` antes de chamar `aplicar`; então `input.githubProjectNumero` SEMPRE vem definido nesse spread. Seguir o padrão dos campos `repositorio`/`quadroUrl` já existentes: usar `=` direto, não `if`.)
  - Adicionar getters: `get githubProjectNumero() { return this.props.githubProjectNumero; }` e `get githubColunaMap() { return this.props.githubColunaMap; }`.
- [ ] **Step 4:** Rodar o teste de novo — esperado PASS. Rodar a suíte toda (`pnpm --filter @spl/api test`) pra garantir que não quebrou nada (`atualizar` é chamado em vários outros testes sem esses campos — como `atualizar` recebe `{ ...this.props, ...input }`, os campos antigos (`null`) se preservam).
- [ ] **Step 5:** Commit:
  ```bash
  git add apps/api/src/modules/operacao/domain/projeto.ts apps/api/test/operacao.domain.test.ts
  git commit -m "feat(api): Projeto valida e guarda vinculo com GitHub Projects"
  ```

---

### Task 3: Domínio — Tarefa ganha identificadores do GitHub

**Files:**
- Modify: `apps/api/src/modules/tarefas/domain/tarefa.ts`
- Test: `apps/api/test/tarefa.domain.test.ts`

**Interfaces:**
- Produces: `TarefaProps.githubIssueNumero: number | null`, `TarefaProps.githubItemNodeId: string | null`; getters `tarefa.githubIssueNumero`, `tarefa.githubItemNodeId`; novo método `tarefa.vincularGithub(issueNumero: number, issueNodeId: string | null, itemNodeId: string | null)`.

- [ ] **Step 1: Teste falhando** — em `apps/api/test/tarefa.domain.test.ts`:
  ```ts
  it('vincula a tarefa a uma issue do GitHub', () => {
    const tarefa = Tarefa.criar({ id: 't1', titulo: 'Testar vinculo', agora: new Date() });
    tarefa.vincularGithub(42, 'IT_issue', 'PVTI_item');
    expect(tarefa.githubIssueNumero).toBe(42);
    expect(tarefa.githubItemNodeId).toBe('PVTI_item');
  });
  ```
- [ ] **Step 2:** `pnpm --filter @spl/api exec vitest run test/tarefa.domain.test.ts` — FAIL esperado.
- [ ] **Step 3: Implementação** em `tarefa.ts`:
  - `TarefaProps`: adicionar `githubIssueNumero: number | null; githubItemNodeId: string | null;`.
  - `static criar`: no objeto retornado, adicionar `githubIssueNumero: null, githubItemNodeId: null,`.
  - Novo método (perto de `marcarSincronizada`):
    ```ts
    vincularGithub(issueNumero: number, _issueNodeId: string | null, itemNodeId: string | null): void {
      this.props.githubIssueNumero = issueNumero;
      if (itemNodeId) this.props.githubItemNodeId = itemNodeId;
    }
    ```
    (o parâmetro `_issueNodeId` fica reservado pra uso futuro — não precisamos persistir o node id da issue em si, só o do item do board; manter a assinatura de 3 argumentos deixa a chamada explícita no call site sobre o que está passando.)
  - Getters: `get githubIssueNumero() { return this.props.githubIssueNumero; }` e `get githubItemNodeId() { return this.props.githubItemNodeId; }`.
- [ ] **Step 4:** Rodar o teste — PASS. Rodar suíte toda.
- [ ] **Step 5:** Commit:
  ```bash
  git add apps/api/src/modules/tarefas/domain/tarefa.ts apps/api/test/tarefa.domain.test.ts
  git commit -m "feat(api): Tarefa guarda numero da issue e item do board GitHub"
  ```

---

### Task 4: Contratos — DTOs e schemas

**Files:**
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Produces: `ProjetoSchema`/`ProjetoDTO` com `githubProjectNumero: number | null`, `githubColunaMap: Record<string,string> | null`; `CriarProjetoSchema`/`AtualizarProjetoSchema` com os mesmos campos opcionais; `TarefaSchema`/`TarefaDTO` com `githubIssueNumero: number | null`; `GithubStatusSchema`/`GithubStatusDTO`; `GithubRepositorioSchema`, `GithubProjetoBoardSchema`, `GithubOpcaoStatusSchema`.

- [ ] **Step 1:** Em `ProjetoSchema` (depois de `adminUrl: z.string().nullable(),`), adicionar:
  ```ts
  githubProjectNumero: z.number().int().nullable(),
  githubColunaMap: z.record(z.string(), z.string()).nullable(),
  ```
- [ ] **Step 2:** Em `CriarProjetoSchema` (depois de `adminUrl: urlOpcional,`), adicionar:
  ```ts
  githubProjectNumero: z.number().int().nullable().optional(),
  githubColunaMap: z.record(z.string(), z.string()).nullable().optional(),
  ```
  (`AtualizarProjetoSchema` já é `CriarProjetoSchema.partial()`, herda automaticamente.)
- [ ] **Step 3:** Em `TarefaSchema` (depois de `pullRequest: z.string().nullable(),`), adicionar:
  ```ts
  githubIssueNumero: z.number().int().nullable(),
  ```
  Não expor `githubItemNodeId` no DTO público (é um detalhe interno do GraphQL do GitHub, sem uso na UI).
- [ ] **Step 4:** No fim do arquivo, antes da linha de export de `cidades.js`, adicionar:
  ```ts
  export const GithubStatusSchema = z.object({
    conectado: z.boolean(),
    organizacao: z.string().nullable(),
  }).openapi('GithubStatus');
  export type GithubStatusDTO = z.infer<typeof GithubStatusSchema>;

  export const GithubRepositorioSchema = z.object({ owner: z.string(), nome: z.string() }).openapi('GithubRepositorio');
  export type GithubRepositorioDTO = z.infer<typeof GithubRepositorioSchema>;

  export const GithubProjetoBoardSchema = z.object({ numero: z.number().int(), titulo: z.string() }).openapi('GithubProjetoBoard');
  export type GithubProjetoBoardDTO = z.infer<typeof GithubProjetoBoardSchema>;

  export const GithubOpcaoStatusSchema = z.object({ id: z.string(), nome: z.string() }).openapi('GithubOpcaoStatus');
  export type GithubOpcaoStatusDTO = z.infer<typeof GithubOpcaoStatusSchema>;
  ```
- [ ] **Step 5:** `pnpm --filter @spl/contracts exec tsc --noEmit` — confirmar que compila.
- [ ] **Step 6:** Commit:
  ```bash
  git add packages/contracts/src/index.ts
  git commit -m "feat(contracts): DTOs do vinculo GitHub em Projeto/Tarefa"
  ```

---

### Task 5: Porta `GitHubProjetos` ampliada + `FakeGitHubProjetos`

**Files:**
- Modify: `apps/api/src/modules/tarefas/application/ports/tarefa-repository.ts`
- Modify: `apps/api/src/modules/tarefas/adapters/out/fake-github-projetos.ts`
- Test: `apps/api/test/fake-github-projetos.test.ts` (novo arquivo)

**Interfaces:**
- Produces (porta `GitHubProjetos`, substitui a atual):
  ```ts
  interface GitHubProjetos {
    readonly modo: 'fake' | 'app';
    sincronizar(tarefas: { id: string; titulo: string; coluna: string; referencia: string | null }[]): Promise<{ atualizacoes: { id: string; referencia: string }[]; detalhes: string }>;
    listarRepositorios(): Promise<{ owner: string; nome: string }[]>;
    listarProjetosDoRepo(owner: string, repo: string): Promise<{ numero: number; titulo: string }[]>;
    listarOpcoesDeStatus(owner: string, repo: string, numeroProjeto: number): Promise<{ id: string; nome: string }[]>;
    criarOuAtualizarIssue(input: { owner: string; repo: string; issueNumero: number | null; titulo: string; estado: 'open' | 'closed' }): Promise<{ issueNumero: number; nodeId: string }>;
    definirStatusNoProjeto(input: { owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string }): Promise<{ itemNodeId: string }>;
    status(): Promise<{ conectado: boolean; organizacao: string | null }>;
  }
  ```

- [ ] **Step 1:** Reescrever `tarefa-repository.ts` com a interface acima (mantém `TarefaRepository` como está, só troca o bloco `GitHubProjetos`).
- [ ] **Step 2:** Reescrever `fake-github-projetos.ts` por completo:
  ```ts
  import type { GitHubProjetos } from '../../application/ports/tarefa-repository.js';

  /** Espelha tudo em memória. Usado em dev, testes e enquanto o App não está configurado. */
  export class FakeGitHubProjetos implements GitHubProjetos {
    readonly modo = 'fake' as const;
    private sequencia = 400;
    private itens = new Map<string, { opcaoStatusId: string }>();

    async sincronizar(tarefas: { id: string; titulo: string; coluna: string; referencia: string | null }[]) {
      const atualizacoes = tarefas.filter((tarefa) => !tarefa.referencia).map((tarefa) => ({ id: tarefa.id, referencia: `spl-hub#${++this.sequencia}` }));
      return { atualizacoes, detalhes: `Adapter fake: ${tarefas.length} tarefas espelhadas em memória, sem chamar a API do GitHub.` };
    }

    async listarRepositorios() {
      return [{ owner: 'splSolucoesTecnologicas', nome: 'exemplo-fake' }];
    }

    async listarProjetosDoRepo(_owner: string, _repo: string) {
      return [{ numero: 1, titulo: 'Board fake' }];
    }

    async listarOpcoesDeStatus(_owner: string, _repo: string, _numeroProjeto: number) {
      return [
        { id: 'opt-a-fazer', nome: 'Todo' },
        { id: 'opt-fazendo', nome: 'In Progress' },
        { id: 'opt-revisao', nome: 'In Review' },
        { id: 'opt-feito', nome: 'Done' },
      ];
    }

    async criarOuAtualizarIssue(input: { owner: string; repo: string; issueNumero: number | null; titulo: string; estado: 'open' | 'closed' }) {
      const issueNumero = input.issueNumero ?? ++this.sequencia;
      return { issueNumero, nodeId: `fake-issue-${issueNumero}` };
    }

    async definirStatusNoProjeto(input: { owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string }) {
      const itemNodeId = input.itemNodeId ?? `fake-item-${input.issueNodeId}`;
      this.itens.set(itemNodeId, { opcaoStatusId: input.opcaoStatusId });
      return { itemNodeId };
    }

    async status() {
      return { conectado: false, organizacao: null };
    }
  }
  ```
- [ ] **Step 3:** Criar `apps/api/test/fake-github-projetos.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { FakeGitHubProjetos } from '../src/modules/tarefas/adapters/out/fake-github-projetos.js';

  describe('FakeGitHubProjetos', () => {
    it('cria uma issue e define o status no board', async () => {
      const github = new FakeGitHubProjetos();
      const issue = await github.criarOuAtualizarIssue({ owner: 'spl', repo: 'hub', issueNumero: null, titulo: 'Testar', estado: 'open' });
      expect(issue.issueNumero).toBeGreaterThan(0);
      const item = await github.definirStatusNoProjeto({ owner: 'spl', repo: 'hub', numeroProjeto: 1, issueNodeId: issue.nodeId, itemNodeId: null, opcaoStatusId: 'opt-feito' });
      expect(item.itemNodeId).toContain(issue.nodeId);
    });

    it('status() informa que não está conectado', async () => {
      const github = new FakeGitHubProjetos();
      expect(await github.status()).toEqual({ conectado: false, organizacao: null });
    });
  });
  ```
- [ ] **Step 4:** `pnpm --filter @spl/api exec vitest run test/fake-github-projetos.test.ts` — PASS.
- [ ] **Step 5:** Rodar typecheck (`pnpm --filter @spl/api run typecheck`) — vai quebrar em `stub-github-projetos.ts` e `main.ts` (ainda implementam a interface velha). Deixar quebrado por enquanto — resolvido na Task 6. Confirmar que o erro é **só** nesses dois arquivos.
- [ ] **Step 6:** Commit:
  ```bash
  git add apps/api/src/modules/tarefas/application/ports/tarefa-repository.ts apps/api/src/modules/tarefas/adapters/out/fake-github-projetos.ts apps/api/test/fake-github-projetos.test.ts
  git commit -m "feat(api): porta GitHubProjetos cresce p/ repos/boards/issues/status"
  ```

---

### Task 6: Adapter real — autenticação e cliente HTTP do GitHub App

**Files:**
- Create: `apps/api/src/modules/tarefas/adapters/out/github-cliente.ts`
- Create: `apps/api/src/modules/tarefas/adapters/out/app-github-projetos.ts`
- Delete: `apps/api/src/modules/tarefas/adapters/out/stub-github-projetos.ts`
- Modify: `apps/api/src/main.ts`
- Test: `apps/api/test/github-cliente.test.ts` (novo)

**Interfaces:**
- Consumes: `GitHubProjetos` (Task 5).
- Produces: `gerarJwtApp(appId: string, chavePrivadaPem: string, agoraSegundos: number): string`; `class AppGitHubProjetos implements GitHubProjetos`.

- [ ] **Step 1: Teste falhando do JWT** — criar `apps/api/test/github-cliente.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { createPrivateKey, generateKeyPairSync } from 'node:crypto';
  import { gerarJwtApp } from '../src/modules/tarefas/adapters/out/github-cliente.js';

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();

  describe('gerarJwtApp', () => {
    it('gera um JWT com 3 partes assinado em RS256', () => {
      const token = gerarJwtApp('123', pem, 1_700_000_000);
      const partes = token.split('.');
      expect(partes).toHaveLength(3);
      const cabecalho = JSON.parse(Buffer.from(partes[0]!, 'base64url').toString());
      expect(cabecalho).toEqual({ alg: 'RS256', typ: 'JWT' });
      const corpo = JSON.parse(Buffer.from(partes[1]!, 'base64url').toString());
      expect(corpo.iss).toBe('123');
      expect(corpo.exp - corpo.iat).toBe(600);
    });
  });
  ```
  (usa `createPrivateKey` só pra garantir a import funciona em runtime se precisar depois; o teste em si só chama `gerarJwtApp`.)
- [ ] **Step 2:** `pnpm --filter @spl/api exec vitest run test/github-cliente.test.ts` — FAIL (`github-cliente.ts` não existe).
- [ ] **Step 3: Implementação** — criar `apps/api/src/modules/tarefas/adapters/out/github-cliente.ts`:
  ```ts
  import { createSign } from 'node:crypto';

  function base64url(input: Buffer | string): string {
    const buf = typeof input === 'string' ? Buffer.from(input) : input;
    return buf.toString('base64url');
  }

  /** JWT do App (RS256), válido por 10 minutos — usado só pra trocar por um token de instalação. */
  export function gerarJwtApp(appId: string, chavePrivadaPem: string, agoraSegundos: number): string {
    const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const corpo = base64url(JSON.stringify({ iat: agoraSegundos - 30, exp: agoraSegundos + 600, iss: appId }));
    const dados = `${cabecalho}.${corpo}`;
    const assinatura = createSign('RSA-SHA256').update(dados).sign(chavePrivadaPem, 'base64url');
    return `${dados}.${assinatura}`;
  }

  export interface ConfigGithubApp {
    appId: string;
    chavePrivada: string;
    installationId: string;
  }

  interface CacheToken { token: string; expiraEm: number }

  /** Troca o JWT do App por um token de instalação (~1h), com cache em processo. */
  export class GithubAuth {
    private cache: CacheToken | null = null;
    constructor(private readonly cfg: ConfigGithubApp) {}

    async token(): Promise<string> {
      const agora = Date.now();
      if (this.cache && this.cache.expiraEm - 60_000 > agora) return this.cache.token;
      const jwt = gerarJwtApp(this.cfg.appId, this.cfg.chavePrivada, Math.floor(agora / 1000));
      const resposta = await fetch(`https://api.github.com/app/installations/${this.cfg.installationId}/access_tokens`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      if (!resposta.ok) throw new Error(`Falha ao obter token de instalação do GitHub: ${resposta.status} ${await resposta.text()}`);
      const dados = (await resposta.json()) as { token: string; expires_at: string };
      this.cache = { token: dados.token, expiraEm: new Date(dados.expires_at).getTime() };
      return this.cache.token;
    }
  }

  export class GithubClienteHttp {
    constructor(private readonly auth: GithubAuth) {}

    async rest<T>(caminho: string, init?: RequestInit): Promise<T> {
      const token = await this.auth.token();
      const resposta = await fetch(`https://api.github.com${caminho}`, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      });
      if (!resposta.ok) throw new Error(`GitHub REST ${caminho}: ${resposta.status} ${await resposta.text()}`);
      return (await resposta.json()) as T;
    }

    async graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
      const token = await this.auth.token();
      const resposta = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      });
      if (!resposta.ok) throw new Error(`GitHub GraphQL: ${resposta.status} ${await resposta.text()}`);
      const corpo = (await resposta.json()) as { data?: T; errors?: { message: string }[] };
      if (corpo.errors?.length) throw new Error(`GitHub GraphQL: ${corpo.errors.map((e) => e.message).join('; ')}`);
      return corpo.data as T;
    }
  }
  ```
- [ ] **Step 4:** Rodar o teste — PASS.
- [ ] **Step 5: Implementação do adapter real** — criar `apps/api/src/modules/tarefas/adapters/out/app-github-projetos.ts`:
  ```ts
  import type { GitHubProjetos } from '../../application/ports/tarefa-repository.js';
  import { GithubAuth, GithubClienteHttp, type ConfigGithubApp } from './github-cliente.js';

  export class AppGitHubProjetos implements GitHubProjetos {
    readonly modo = 'app' as const;
    private readonly cliente: GithubClienteHttp;
    constructor(private readonly cfg: ConfigGithubApp) {
      this.cliente = new GithubClienteHttp(new GithubAuth(cfg));
    }

    async sincronizar(tarefas: { id: string; titulo: string; coluna: string; referencia: string | null }[]) {
      // Sincronização em lote fica restrita a tarefas já ligadas a um Projeto com repo configurado;
      // esse caminho genérico (sem saber o repo de cada tarefa) não cria issue nova — só reporta.
      return { atualizacoes: [], detalhes: `Adapter app: use a sincronização por Projeto (criarOuAtualizarIssue) — ${tarefas.length} tarefas não vinculadas a um repo não são tocadas aqui.` };
    }

    async listarRepositorios() {
      const dados = await this.cliente.rest<{ repositories: { name: string; owner: { login: string } }[] }>('/installation/repositories?per_page=100');
      return dados.repositories.map((repo) => ({ owner: repo.owner.login, nome: repo.name }));
    }

    async listarProjetosDoRepo(owner: string, repo: string) {
      const query = `query($owner:String!,$repo:String!){ repository(owner:$owner,name:$repo){ projectsV2(first:20){ nodes{ number title } } } }`;
      const dados = await this.cliente.graphql<{ repository: { projectsV2: { nodes: { number: number; title: string }[] } } }>(query, { owner, repo });
      return dados.repository.projectsV2.nodes.map((item) => ({ numero: item.number, titulo: item.title }));
    }

    async listarOpcoesDeStatus(owner: string, repo: string, numeroProjeto: number) {
      const query = `query($owner:String!,$repo:String!,$numero:Int!){ repository(owner:$owner,name:$repo){ projectV2(number:$numero){ field(name:"Status"){ ... on ProjectV2SingleSelectField { options { id name } } } } } }`;
      const dados = await this.cliente.graphql<{ repository: { projectV2: { field: { options: { id: string; name: string }[] } } } }>(query, { owner, repo, numero: numeroProjeto });
      return dados.repository.projectV2.field.options.map((item) => ({ id: item.id, nome: item.name }));
    }

    async criarOuAtualizarIssue(input: { owner: string; repo: string; issueNumero: number | null; titulo: string; estado: 'open' | 'closed' }) {
      if (input.issueNumero) {
        const issue = await this.cliente.rest<{ number: number; node_id: string }>(`/repos/${input.owner}/${input.repo}/issues/${input.issueNumero}`, {
          method: 'PATCH', body: JSON.stringify({ title: input.titulo, state: input.estado }),
        });
        return { issueNumero: issue.number, nodeId: issue.node_id };
      }
      const issue = await this.cliente.rest<{ number: number; node_id: string }>(`/repos/${input.owner}/${input.repo}/issues`, {
        method: 'POST', body: JSON.stringify({ title: input.titulo }),
      });
      return { issueNumero: issue.number, nodeId: issue.node_id };
    }

    async definirStatusNoProjeto(input: { owner: string; repo: string; numeroProjeto: number; issueNodeId: string; itemNodeId: string | null; opcaoStatusId: string }) {
      let itemNodeId = input.itemNodeId;
      if (!itemNodeId) {
        const projeto = await this.cliente.graphql<{ repository: { projectV2: { id: string } } }>(
          `query($owner:String!,$repo:String!,$numero:Int!){ repository(owner:$owner,name:$repo){ projectV2(number:$numero){ id } } }`,
          { owner: input.owner, repo: input.repo, numero: input.numeroProjeto },
        );
        const adicionado = await this.cliente.graphql<{ addProjectV2ItemById: { item: { id: string } } }>(
          `mutation($projectId:ID!,$contentId:ID!){ addProjectV2ItemById(input:{projectId:$projectId,contentId:$contentId}){ item { id } } }`,
          { projectId: projeto.repository.projectV2.id, contentId: input.issueNodeId },
        );
        itemNodeId = adicionado.addProjectV2ItemById.item.id;
      }
      const projetoId = await this.cliente.graphql<{ repository: { projectV2: { id: string; field: { id: string } } } }>(
        `query($owner:String!,$repo:String!,$numero:Int!){ repository(owner:$owner,name:$repo){ projectV2(number:$numero){ id field(name:"Status"){ ... on ProjectV2SingleSelectField { id } } } } }`,
        { owner: input.owner, repo: input.repo, numero: input.numeroProjeto },
      );
      await this.cliente.graphql(
        `mutation($projectId:ID!,$itemId:ID!,$fieldId:ID!,$optionId:String!){ updateProjectV2ItemFieldValue(input:{projectId:$projectId,itemId:$itemId,fieldId:$fieldId,value:{singleSelectOptionId:$optionId}}){ clientMutationId } }`,
        { projectId: projetoId.repository.projectV2.id, itemId: itemNodeId, fieldId: projetoId.repository.projectV2.field.id, optionId: input.opcaoStatusId },
      );
      return { itemNodeId };
    }

    async status() {
      try {
        const dados = await this.cliente.rest<{ account: { login: string } }>('/installation/repositories?per_page=1').then(async () => {
          const app = await this.cliente.rest<{ account: { login: string } }>(`/app`).catch(() => null);
          return app;
        });
        return { conectado: true, organizacao: dados?.account.login ?? null };
      } catch {
        return { conectado: false, organizacao: null };
      }
    }
  }
  ```
- [ ] **Step 6:** Apagar `apps/api/src/modules/tarefas/adapters/out/stub-github-projetos.ts` (`rm apps/api/src/modules/tarefas/adapters/out/stub-github-projetos.ts`).
- [ ] **Step 7:** Em `apps/api/src/main.ts`, trocar a função `githubDe`. A chave privada pode vir de duas formas — direto na env var `GITHUB_APP_PRIVATE_KEY` (conteúdo do `.pem`) ou de um arquivo montado (`GITHUB_APP_PRIVATE_KEY_PATH`, usado via File Mount do Dokploy, que evita problema de escaping de quebra de linha em env var multi-linha):
  ```ts
  import { readFileSync } from 'node:fs';
  // ...
  function chavePrivadaGithub(): string | undefined {
    if (process.env.GITHUB_APP_PRIVATE_KEY_PATH) return readFileSync(process.env.GITHUB_APP_PRIVATE_KEY_PATH, 'utf8');
    return process.env.GITHUB_APP_PRIVATE_KEY;
  }

  function githubDe(): GitHubProjetos {
    const chavePrivada = chavePrivadaGithub();
    if (process.env.GITHUB_ADAPTER === 'app' && process.env.GITHUB_APP_ID && chavePrivada && process.env.GITHUB_APP_INSTALLATION_ID) {
      return new AppGitHubProjetos({
        appId: process.env.GITHUB_APP_ID,
        chavePrivada,
        installationId: process.env.GITHUB_APP_INSTALLATION_ID,
      });
    }
    return new FakeGitHubProjetos();
  }
  ```
  Trocar o import `StubGitHubProjetos` por `AppGitHubProjetos` (de `./modules/tarefas/adapters/out/app-github-projetos.js`).
- [ ] **Step 8:** `pnpm --filter @spl/api run typecheck` — PASS (sem erros em nenhum arquivo).
- [ ] **Step 9:** `pnpm --filter @spl/api test` — PASS (toda a suíte).
- [ ] **Step 10:** Commit:
  ```bash
  git add apps/api/src/modules/tarefas/adapters/out/github-cliente.ts apps/api/src/modules/tarefas/adapters/out/app-github-projetos.ts apps/api/src/main.ts apps/api/test/github-cliente.test.ts
  git rm apps/api/src/modules/tarefas/adapters/out/stub-github-projetos.ts
  git commit -m "feat(api): adapter real do GitHub App (JWT, REST issues, GraphQL Projects v2)"
  ```

---

### Task 7: Casos de uso — vincular Projeto ao GitHub e sincronizar issue individual

**Files:**
- Modify: `apps/api/src/modules/operacao/application/use-cases.ts`
- Modify: `apps/api/src/modules/operacao/application/ports.ts` (se precisar expor `github` nas deps — ver Step 1)
- Test: `apps/api/test/operacao.use-cases.test.ts` (criar se não existir — ver `apps/api/test/*.test.ts` existentes pro padrão)

**Interfaces:**
- Consumes: `GitHubProjetos` (Task 5/6), `Projeto.githubProjectNumero`/`githubColunaMap` (Task 2).
- Produces: `casosDeUsoOperacao.listarRepositoriosGithub(ator)`, `.listarProjetosGithub(ator, owner, repo)`, `.listarOpcoesStatusGithub(ator, owner, repo, numero)`, `.statusGithub()`.

- [ ] **Step 1:** Checar a assinatura de `criarCasosDeUsoOperacao` em `apps/api/src/modules/operacao/application/use-cases.ts` (primeiras linhas do arquivo) pra ver como `deps` é tipado. Adicionar `github: GitHubProjetos` em `DepsOperacao` (ou tipo equivalente já usado) e no destructuring `const { clientes, projetos, decisoes, objetivos, relogio, ids, github } = deps;`. Em `apps/api/src/app.ts`, na linha `const operacao = criarCasosDeUsoOperacao(deps);`, como `deps` já é o objeto `Dependencias` completo (que já tem `github`), **nenhuma mudança extra é necessária ali** — só garantir que o tipo de entrada de `criarCasosDeUsoOperacao` aceite/use o campo.
- [ ] **Step 2: Teste falhando** — em `apps/api/test/operacao.use-cases.test.ts` (ver padrão de outros arquivos de teste tipo `acesso.use-cases.test.ts` pra montar o `memoria()`/fixture equivalente do módulo operacao — provavelmente já existe um helper; procurar com `grep -rn "criarCasosDeUsoOperacao" apps/api/test`):
  ```ts
  it('lista repositorios, projetos e opcoes de status via o adapter configurado', async () => {
    const { operacao, admin } = contexto(); // usar o helper de fixture já existente no arquivo/padrão do módulo
    const repos = await operacao.listarRepositoriosGithub(admin);
    expect(repos.length).toBeGreaterThan(0);
    const boards = await operacao.listarProjetosGithub(admin, repos[0]!.owner, repos[0]!.nome);
    expect(boards.length).toBeGreaterThan(0);
    const opcoes = await operacao.listarOpcoesStatusGithub(admin, repos[0]!.owner, repos[0]!.nome, boards[0]!.numero);
    expect(opcoes.map((o) => o.nome)).toContain('Done');
  });
  ```
  (adaptar `contexto()`/`admin` pro helper real que o arquivo de teste de operacao já usa — inspecionar o arquivo antes de escrever, pra não inventar uma API que não existe.)
- [ ] **Step 3:** Rodar o teste — FAIL.
- [ ] **Step 4: Implementação** — em `use-cases.ts`, perto dos outros métodos de projeto, adicionar:
  ```ts
  async listarRepositoriosGithub(ator: Usuario) {
    ator.exigir('projetos', 'editar');
    return github.listarRepositorios();
  },
  async listarProjetosGithub(ator: Usuario, owner: string, repo: string) {
    ator.exigir('projetos', 'editar');
    return github.listarProjetosDoRepo(owner, repo);
  },
  async listarOpcoesStatusGithub(ator: Usuario, owner: string, repo: string, numero: number) {
    ator.exigir('projetos', 'editar');
    return github.listarOpcoesDeStatus(owner, repo, numero);
  },
  async statusGithub() {
    return github.status();
  },
  ```
- [ ] **Step 5:** Rodar o teste — PASS. Rodar suíte toda.
- [ ] **Step 6:** Commit:
  ```bash
  git add apps/api/src/modules/operacao/application/use-cases.ts apps/api/test/operacao.use-cases.test.ts
  git commit -m "feat(api): casos de uso p/ listar repos/boards/status do GitHub"
  ```

---

### Task 8: Push automático Hub → GitHub ao criar/mover Tarefa

**Files:**
- Modify: `apps/api/src/modules/tarefas/application/use-cases.ts`
- Test: `apps/api/test/tarefa.use-cases.test.ts`

**Interfaces:**
- Consumes: `ProjetoRepository` (precisa ser injetado nas deps de `criarCasosDeUsoTarefas` — hoje só tem `repo`/`github`/`relogio`/`ids`), `Projeto.repositorio`/`githubProjectNumero`/`githubColunaMap`.
- Produces: `criar`/`atualizar` passam a chamar `github.criarOuAtualizarIssue` + `github.definirStatusNoProjeto` quando a Tarefa pertence a um Projeto com repo+board+mapa configurados.

- [ ] **Step 1:** Em `apps/api/src/modules/tarefas/application/use-cases.ts`, adicionar `ProjetoRepository` como dependência: `criarCasosDeUsoTarefas(deps: { repo: TarefaRepository; github: GitHubProjetos; projetos: ProjetoRepository; relogio: Relogio; ids: GeradorId })`. Importar o tipo de `../../operacao/application/ports.js`.
- [ ] **Step 2:** Em `apps/api/src/app.ts`, na linha que monta `tarefas`, passar `projetos: deps.projetos` também: `criarCasosDeUsoTarefas({ repo: deps.tarefas, github: deps.github, projetos: deps.projetos, relogio: deps.relogio, ids: deps.ids })`.
- [ ] **Step 3: Teste falhando** — em `apps/api/test/tarefa.use-cases.test.ts`, inspecionar o fixture usado (provavelmente uma função local tipo `contexto()` que monta `InMemoryTarefaRepository`/`FakeGitHubProjetos`) e adaptar pra incluir um `InMemoryProjetoRepository` com um Projeto já vinculado (`repositorio: 'spl/teste'`, `githubProjectNumero: 1`, `githubColunaMap: {...}`). Teste:
  ```ts
  it('cria a issue no GitHub quando a tarefa pertence a um projeto vinculado', async () => {
    const { tarefas, projetos, github } = contexto(); // adaptar ao fixture real do arquivo
    const projeto = Projeto.criar({ id: 'proj1', nome: 'Com GitHub', tipo: 'produto', status: 'piloto', cor: '#4c8dff', agora: new Date(), repositorio: 'spl/teste' });
    projeto.atualizar({ githubProjectNumero: 1, githubColunaMap: { a_fazer: 'opt-a-fazer', fazendo: 'opt-fazendo', revisao: 'opt-revisao', feito: 'opt-feito' } }, new Date());
    await projetos.salvar(projeto);
    const tarefa = await tarefas.criar(ator, { titulo: 'Linkar com GitHub', projetoId: 'proj1' });
    expect(tarefa.githubIssueNumero).not.toBeNull();
  });
  ```
- [ ] **Step 4:** Rodar — FAIL.
- [ ] **Step 5: Implementação** — dentro de `criarCasosDeUsoTarefas`, criar uma função privada:
  ```ts
  async function sincronizarComGithubSeVinculado(tarefa: Tarefa) {
    if (!tarefa.projetoId) return;
    const projeto = await projetos.buscarPorId(tarefa.projetoId);
    if (!projeto?.repositorio || projeto.githubProjectNumero == null || !projeto.githubColunaMap) return;
    const [owner, repo] = projeto.repositorio.split('/');
    if (!owner || !repo) return;
    const opcaoStatusId = projeto.githubColunaMap[tarefa.coluna];
    if (!opcaoStatusId) return;
    const issue = await github.criarOuAtualizarIssue({
      owner, repo, issueNumero: tarefa.githubIssueNumero, titulo: tarefa.titulo, estado: tarefa.coluna === 'feito' ? 'closed' : 'open',
    });
    const item = await github.definirStatusNoProjeto({
      owner, repo, numeroProjeto: projeto.githubProjectNumero, issueNodeId: issue.nodeId, itemNodeId: tarefa.githubItemNodeId, opcaoStatusId,
    });
    tarefa.vincularGithub(issue.issueNumero, issue.nodeId, item.itemNodeId);
    await repo_tarefas.salvar(tarefa); // ver nota abaixo
  }
  ```
  **Nota de nomes:** dentro de `criarCasosDeUsoTarefas`, o repositório de tarefas já se chama `repo` (parâmetro desestruturado `const { repo, github, relogio, ids } = deps;`) — então usar `repo.salvar(tarefa)`, não `repo_tarefas`. Ajustar o snippet acima pra `await repo.salvar(tarefa);`. E essa função usa `projetos` (novo) do destructuring do Step 1 — atualizar `const { repo, github, projetos, relogio, ids } = deps;`.
  - Chamar `await sincronizarComGithubSeVinculado(tarefa);` no fim de `criar(...)` (antes do `return tarefa;`, depois do `await repo.salvar(tarefa);` original) e no fim de `atualizar(...)` (mesma posição). Envolver a chamada em `try/catch` que só loga (`console.error`) e não derruba a requisição — um 500 no GitHub não pode quebrar o fluxo normal do Hub:
    ```ts
    try { await sincronizarComGithubSeVinculado(tarefa); } catch (erro) { console.error('Falha ao sincronizar com GitHub:', erro); }
    ```
- [ ] **Step 6:** Rodar o teste — PASS. Rodar suíte toda (`pnpm --filter @spl/api test`).
- [ ] **Step 7:** Commit:
  ```bash
  git add apps/api/src/modules/tarefas/application/use-cases.ts apps/api/src/app.ts apps/api/test/tarefa.use-cases.test.ts
  git commit -m "feat(api): Tarefa cria/atualiza issue no GitHub quando o projeto esta vinculado"
  ```

---

### Task 9: Endpoint de webhook (entrada GitHub → Hub)

**Files:**
- Create: `apps/api/src/modules/tarefas/adapters/in/http/github-webhook-routes.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/github-webhook.test.ts` (novo)

**Interfaces:**
- Consumes: `ProjetoRepository`, `TarefaRepository`, `GeradorId`, `Relogio`.
- Produces: rota `POST /github/webhook`, função exportada `verificarAssinatura(corpoBruto: Buffer, assinaturaHeader: string | undefined, secret: string): boolean` (testável isoladamente).

- [ ] **Step 1: Teste falhando da assinatura** — criar `apps/api/test/github-webhook.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { createHmac } from 'node:crypto';
  import { verificarAssinatura } from '../src/modules/tarefas/adapters/in/http/github-webhook-routes.js';

  describe('verificarAssinatura', () => {
    it('aceita uma assinatura HMAC-SHA256 valida', () => {
      const corpo = Buffer.from('{"a":1}');
      const secret = 'segredo-teste';
      const assinatura = 'sha256=' + createHmac('sha256', secret).update(corpo).digest('hex');
      expect(verificarAssinatura(corpo, assinatura, secret)).toBe(true);
    });
    it('rejeita assinatura ausente ou errada', () => {
      const corpo = Buffer.from('{"a":1}');
      expect(verificarAssinatura(corpo, undefined, 'segredo-teste')).toBe(false);
      expect(verificarAssinatura(corpo, 'sha256=errado', 'segredo-teste')).toBe(false);
    });
  });
  ```
- [ ] **Step 2:** Rodar — FAIL (arquivo não existe).
- [ ] **Step 3: Implementação** — criar `apps/api/src/modules/tarefas/adapters/in/http/github-webhook-routes.ts`:
  ```ts
  import type { FastifyInstance } from 'fastify';
  import { createHmac, timingSafeEqual } from 'node:crypto';
  import { randomUUID } from 'node:crypto';
  import { Tarefa } from '../../../domain/tarefa.js';
  import type { TarefaRepository } from '../../../application/ports/tarefa-repository.js';
  import type { ProjetoRepository } from '../../../../operacao/application/ports.js';

  export function verificarAssinatura(corpoBruto: Buffer, assinaturaHeader: string | undefined, secret: string): boolean {
    if (!assinaturaHeader?.startsWith('sha256=')) return false;
    const esperada = Buffer.from('sha256=' + createHmac('sha256', secret).update(corpoBruto).digest('hex'));
    const recebida = Buffer.from(assinaturaHeader);
    if (esperada.length !== recebida.length) return false;
    return timingSafeEqual(esperada, recebida);
  }

  interface StatusOptionPorProjeto { [projetoId: string]: Record<string, string> }

  function colunaPelaOpcao(mapa: Record<string, string> | null, opcaoStatusId: string): string | null {
    if (!mapa) return null;
    const entrada = Object.entries(mapa).find(([, id]) => id === opcaoStatusId);
    return entrada ? entrada[0] : null;
  }

  export function githubWebhookRoutes(deps: { tarefas: TarefaRepository; projetos: ProjetoRepository; webhookSecret: string | undefined; relogio: { agora: () => Date }; ids: { novo: () => string } }) {
    return async (app: FastifyInstance) => {
      app.register(async (escopo) => {
        escopo.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
          (req as unknown as { rawBody: Buffer }).rawBody = body as Buffer;
          try { done(null, JSON.parse((body as Buffer).toString('utf8'))); } catch { done(null, {}); }
        });

        escopo.post('/github/webhook', async (req, reply) => {
          const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
          const assinatura = req.headers['x-hub-signature-256'] as string | undefined;
          if (!deps.webhookSecret || !verificarAssinatura(rawBody, assinatura, deps.webhookSecret)) {
            return reply.code(401).send({ erro: 'assinatura_invalida' });
          }
          const evento = req.headers['x-github-event'] as string | undefined;
          try {
            if (evento === 'issues') await tratarEventoIssue(req.body as Record<string, unknown>, deps);
            else if (evento === 'projects_v2_item') await tratarEventoItemProjeto(req.body as Record<string, unknown>, deps);
          } catch (erro) {
            console.error('Falha ao processar webhook do GitHub:', erro);
          }
          return reply.code(200).send({ ok: true });
        });
      });
    };
  }

  async function tratarEventoIssue(payload: Record<string, unknown>, deps: { tarefas: TarefaRepository; projetos: ProjetoRepository; relogio: { agora: () => Date }; ids: { novo: () => string } }) {
    const acao = payload.action as string;
    const issue = payload.issue as { number: number; title: string; state: 'open' | 'closed'; node_id: string } | undefined;
    const repositorioFull = (payload.repository as { full_name: string } | undefined)?.full_name;
    if (!issue || !repositorioFull || !['opened', 'edited', 'closed', 'reopened'].includes(acao)) return;
    const projetos = await deps.projetos.listarTodos();
    const projeto = projetos.find((item) => item.repositorio === repositorioFull);
    if (!projeto) return;
    const todas = await deps.tarefas.listarTodas();
    const existente = todas.find((tarefa) => tarefa.projetoId === projeto.id && tarefa.githubIssueNumero === issue.number);
    const coluna = issue.state === 'closed' ? 'feito' : existente?.coluna === 'feito' ? 'a_fazer' : (existente?.coluna ?? 'a_fazer');
    if (existente) {
      existente.atualizar({ titulo: issue.title, coluna }, deps.relogio.agora());
      existente.vincularGithub(issue.number, issue.node_id, existente.githubItemNodeId);
      await deps.tarefas.salvar(existente);
      return;
    }
    if (acao !== 'opened') return;
    const nova = Tarefa.criar({ id: deps.ids.novo(), titulo: issue.title, agora: deps.relogio.agora(), coluna, projetoId: projeto.id, referencia: `${repositorioFull}#${issue.number}` });
    nova.vincularGithub(issue.number, issue.node_id, null);
    await deps.tarefas.salvar(nova);
  }

  async function tratarEventoItemProjeto(payload: Record<string, unknown>, deps: { tarefas: TarefaRepository; projetos: ProjetoRepository; relogio: { agora: () => Date } }) {
    const acao = payload.action as string;
    if (acao !== 'edited') return;
    const changes = payload.changes as { field_value?: { field_node_id?: string; to?: { id?: string } } } | undefined;
    const opcaoStatusId = changes?.field_value?.to?.id;
    const itemNodeId = (payload.projects_v2_item as { node_id?: string } | undefined)?.node_id;
    if (!opcaoStatusId || !itemNodeId) return;
    const todas = await deps.tarefas.listarTodas();
    const tarefa = todas.find((item) => item.githubItemNodeId === itemNodeId);
    if (!tarefa || !tarefa.projetoId) return;
    const projeto = await deps.projetos.buscarPorId(tarefa.projetoId);
    const coluna = colunaPelaOpcao(projeto?.githubColunaMap ?? null, opcaoStatusId);
    if (!coluna) return;
    tarefa.atualizar({ coluna: coluna as Tarefa['coluna'] }, deps.relogio.agora());
    await deps.tarefas.salvar(tarefa);
  }
  ```
  **Nota honesta:** o payload exato de `projects_v2_item` (nomes de campos em `changes.field_value`) pode variar — o formato acima segue a documentação pública do GitHub no momento desta escrita, mas **precisa ser confirmado com um evento real** depois do deploy (ver Task 11). Deixar um `console.log(JSON.stringify(payload))` temporário é aceitável na primeira semana em produção pra validar o formato — remover depois de confirmar.
- [ ] **Step 4:** Em `apps/api/src/app.ts`, registrar a rota nova (fora do bloco de `cors`/outras rotas que dependem de JSON parse padrão — como essa rota tem seu próprio parser encapsulado, registrar junto das outras com `app.register(...)`):
  ```ts
  import { githubWebhookRoutes } from './modules/tarefas/adapters/in/http/github-webhook-routes.js';
  // ...
  app.register(githubWebhookRoutes({ tarefas: deps.tarefas, projetos: deps.projetos, webhookSecret: process.env.GITHUB_WEBHOOK_SECRET, relogio: deps.relogio, ids: deps.ids }));
  ```
- [ ] **Step 5:** Rodar `pnpm --filter @spl/api exec vitest run test/github-webhook.test.ts` — PASS.
- [ ] **Step 6:** Rodar suíte toda + typecheck.
- [ ] **Step 7:** Commit:
  ```bash
  git add apps/api/src/modules/tarefas/adapters/in/http/github-webhook-routes.ts apps/api/src/app.ts apps/api/test/github-webhook.test.ts
  git commit -m "feat(api): endpoint de webhook do GitHub (issues + projects_v2_item)"
  ```

---

### Task 10: Rotas HTTP — status, repositórios, boards, opções de status

**Files:**
- Modify: `apps/api/src/modules/operacao/adapters/in/http/routes.ts`

**Interfaces:**
- Produces: `GET /github/status` (sem auth obrigatória? — **decisão:** exige sessão válida, igual tudo mais no Hub, mas qualquer pessoa logada pode ler), `GET /projetos/github/repositorios`, `GET /projetos/github/repositorios/:owner/:repo/boards`, `GET /projetos/github/repositorios/:owner/:repo/boards/:numero/opcoes-status`.

- [ ] **Step 1:** Em `operacaoRoutes`, dentro do `return async (app) => { ... }`, adicionar (perto das rotas de `/projetos`):
  ```ts
  app.get('/github/status', async (req) => {
    await atorDe(req); // só confirma sessão válida
    return casos.statusGithub();
  });

  app.get('/projetos/github/repositorios', async (req) => casos.listarRepositoriosGithub(await atorDe(req)));

  app.get<{ Params: { owner: string; repo: string } }>('/projetos/github/repositorios/:owner/:repo/boards', async (req) =>
    casos.listarProjetosGithub(await atorDe(req), req.params.owner, req.params.repo));

  app.get<{ Params: { owner: string; repo: string; numero: string } }>('/projetos/github/repositorios/:owner/:repo/boards/:numero/opcoes-status', async (req) =>
    casos.listarOpcoesStatusGithub(await atorDe(req), req.params.owner, req.params.repo, Number(req.params.numero)));
  ```
  **Atenção à ordem das rotas:** Fastify precisa que `/projetos/github/...` seja registrado e não colida com `/projetos/:id` (rota existente, se houver — checar no arquivo antes de inserir; se `/projetos/:id` já existe, registrar `/projetos/github/...` **antes** dela no arquivo, porque Fastify por padrão já desambigua rotas estáticas vs. parametrizadas corretamente, mas confirmar rodando o teste do Step seguinte).
- [ ] **Step 2:** Também adicionar `githubProjectNumero`/`githubColunaMap` no `projetoDto` **não precisa de alteração** — já é coberto pelo spread `...projeto.toJSON()` (Task 2 já adicionou os campos em `ProjetoProps`/`toJSON`).
- [ ] **Step 3:** Adicionar um teste de integração simples em `apps/api/test/api.http.integration.test.ts` (seguir o padrão dos testes HTTP já existentes nesse arquivo — inspecionar antes de escrever) cobrindo `GET /github/status` respondendo 200 com `{ conectado: false, organizacao: null }` no modo fake.
- [ ] **Step 4:** Rodar a suíte toda + typecheck.
- [ ] **Step 5:** Commit:
  ```bash
  git add apps/api/src/modules/operacao/adapters/in/http/routes.ts apps/api/test/api.http.integration.test.ts
  git commit -m "feat(api): rotas HTTP p/ status, repos, boards e opcoes de status do GitHub"
  ```

---

### Task 11: Hub — Configurações mostra status da integração

**Files:**
- Modify: `apps/hub/components/Configuracoes.tsx`

**Interfaces:**
- Consumes: `GET /github/status` → `GithubStatusDTO`.

- [ ] **Step 1:** Em `Configuracoes.tsx`, adicionar estado `const [github, setGithub] = useState<{ conectado: boolean; organizacao: string | null } | null>(null);` e, num `useEffect` próprio (`useEffect(() => { void api<{ conectado: boolean; organizacao: string | null }>('/github/status').then(setGithub).catch(() => setGithub({ conectado: false, organizacao: null })); }, []);`), carregar o status.
- [ ] **Step 2:** Adicionar um `<article className="painel">` novo (antes do painel "esboço nesta entrega"):
  ```tsx
  <article className="painel">
    <h2>Integração GitHub</h2>
    {github == null && <p className="aviso">Verificando…</p>}
    {github && (
      <p>
        <span className={`chip ${github.conectado ? 'green' : ''}`}>{github.conectado ? 'Conectada' : 'Não conectada'}</span>
        {github.conectado && github.organizacao && <span className="aviso"> · organização {github.organizacao}</span>}
      </p>
    )}
  </article>
  ```
- [ ] **Step 3:** `pnpm --filter @spl/hub run typecheck` — PASS.
- [ ] **Step 4:** Commit:
  ```bash
  git add apps/hub/components/Configuracoes.tsx
  git commit -m "feat(hub): Configuracoes mostra status da integracao GitHub"
  ```

---

### Task 12: Hub — vincular Projeto ao GitHub (repo, board, mapeamento de colunas)

**Files:**
- Modify: `apps/hub/components/Projetos.tsx`

**Interfaces:**
- Consumes: `GET /projetos/github/repositorios`, `GET /projetos/github/repositorios/:owner/:repo/boards`, `GET /projetos/github/repositorios/:owner/:repo/boards/:numero/opcoes-status`.
- Produces: `Rascunho` ganha `githubProjectNumero: string` e `githubColunaMap: Record<string,string>`; `corpoDe` envia os dois campos.

- [ ] **Step 1:** Em `Rascunho`, adicionar `githubProjectNumero: string; githubColunaMap: Record<string, string>;`. Em `base()`, adicionar `githubProjectNumero: '', githubColunaMap: {},`. Em `deProjeto`, adicionar `githubProjectNumero: projeto.githubProjectNumero != null ? String(projeto.githubProjectNumero) : '', githubColunaMap: projeto.githubColunaMap ?? {},`. Em `corpoDe`, adicionar `githubProjectNumero: rascunho.githubProjectNumero ? Number(rascunho.githubProjectNumero) : null, githubColunaMap: Object.keys(rascunho.githubColunaMap).length === 4 ? rascunho.githubColunaMap : null,`.
- [ ] **Step 2:** Dentro de `FormularioProjeto`, logo depois do campo `Repositório GitHub`, adicionar um bloco que só aparece quando `rascunho.repositorio` tem o formato `dono/nome`:
  ```tsx
  {/^[\w.-]+\/[\w.-]+$/.test(rascunho.repositorio) && (
    <VinculoGithub rascunho={rascunho} setRascunho={setRascunho} />
  )}
  ```
- [ ] **Step 3:** Criar o componente `VinculoGithub` (no mesmo arquivo `Projetos.tsx`, antes de `FormularioProjeto` ou depois — qualquer lugar no nível de módulo):
  ```tsx
  const COLUNAS_MAPA: { id: 'a_fazer' | 'fazendo' | 'revisao' | 'feito'; nome: string }[] = [
    { id: 'a_fazer', nome: 'A fazer' }, { id: 'fazendo', nome: 'Fazendo' }, { id: 'revisao', nome: 'Revisão' }, { id: 'feito', nome: 'Feito' },
  ];

  function VinculoGithub({ rascunho, setRascunho }: { rascunho: Rascunho; setRascunho: (valor: Rascunho) => void }) {
    const [boards, setBoards] = useState<{ numero: number; titulo: string }[]>([]);
    const [opcoes, setOpcoes] = useState<{ id: string; nome: string }[]>([]);
    const [owner, repo] = rascunho.repositorio.split('/');

    useEffect(() => {
      void api<{ numero: number; titulo: string }[]>(`/projetos/github/repositorios/${owner}/${repo}/boards`).then(setBoards).catch(() => setBoards([]));
    }, [owner, repo]);

    useEffect(() => {
      if (!rascunho.githubProjectNumero) { setOpcoes([]); return; }
      void api<{ id: string; nome: string }[]>(`/projetos/github/repositorios/${owner}/${repo}/boards/${rascunho.githubProjectNumero}/opcoes-status`).then(setOpcoes).catch(() => setOpcoes([]));
    }, [owner, repo, rascunho.githubProjectNumero]);

    return (
      <>
        <label>Board do GitHub Projects
          <select className="campo" value={rascunho.githubProjectNumero} onChange={(e) => setRascunho({ ...rascunho, githubProjectNumero: e.target.value })}>
            <option value="">Sem board vinculado</option>
            {boards.map((board) => <option key={board.numero} value={board.numero}>{board.titulo}</option>)}
          </select>
        </label>
        {opcoes.length > 0 && (
          <div className="linha">
            {COLUNAS_MAPA.map((coluna) => (
              <label key={coluna.id}>{coluna.nome}
                <select className="campo" value={rascunho.githubColunaMap[coluna.id] ?? ''} onChange={(e) => setRascunho({ ...rascunho, githubColunaMap: { ...rascunho.githubColunaMap, [coluna.id]: e.target.value } })}>
                  <option value="">—</option>
                  {opcoes.map((opcao) => <option key={opcao.id} value={opcao.id}>{opcao.nome}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}
      </>
    );
  }
  ```
  Adicionar `useEffect` ao import de `react` no topo do arquivo (já importa `useState`/`useEffect`? conferir — hoje importa `useEffect, useMemo, useState`, então só falta nada).
- [ ] **Step 4:** `pnpm --filter @spl/hub run typecheck` — PASS.
- [ ] **Step 5:** Commit:
  ```bash
  git add apps/hub/components/Projetos.tsx
  git commit -m "feat(hub): vincular Projeto a um board do GitHub Projects com mapeamento de colunas"
  ```

---

### Task 13: Hub — aba "Issues" no detalhe do Projeto + badge no quadro

**Files:**
- Modify: `apps/hub/components/Projetos.tsx` (dentro de `DetalheProjeto`)
- Modify: `apps/hub/components/Quadro.tsx`

**Interfaces:**
- Consumes: `GET /tarefas?projetoId=...&limite=100` (já existe).

- [ ] **Step 1:** Em `DetalheProjeto`, trocar o tipo de `aba` pra incluir `'issues'`: `useState<'geral' | 'quadro' | 'issues' | 'admin' | 'clientes' | 'repo'>('geral')`. Na lista de abas (linha com `[['geral', 'Visão geral'], ...]`), inserir `['issues', 'Issues']` depois de `['quadro', 'Quadro']`.
- [ ] **Step 2:** Adicionar estado `const [tarefasComIssue, setTarefasComIssue] = useState<TarefaDTO[]>([]);` (importar `TarefaDTO` de `@spl/contracts`) e, dentro de `carregar()`, depois do bloco que já busca `/tarefas?projetoId=${id}&limite=100` pra calcular `tarefasAbertas`, guardar a lista completa também:
  ```ts
  const quadro = await api<Pagina<TarefaDTO>>(`/tarefas?projetoId=${id}&limite=100`);
  setTarefasAbertas(quadro.data.filter((item) => item.coluna !== 'feito').length);
  setEmRevisao(quadro.data.filter((item) => item.coluna === 'revisao').length);
  setTarefasComIssue(quadro.data.filter((item) => item.githubIssueNumero != null));
  ```
  (isso substitui o bloco equivalente já existente — não duplicar a chamada `api(...)`.)
- [ ] **Step 3:** Adicionar o bloco de renderização da aba, perto de `{aba === 'quadro' && ...}`:
  ```tsx
  {aba === 'issues' && (
    <article className="painel">
      <h2>Issues do GitHub</h2>
      {tarefasComIssue.length === 0 && <p className="aviso">Nenhuma issue vinculada ainda. Issues aparecem aqui quando a tarefa é criada ou sincronizada com o repositório.</p>}
      {tarefasComIssue.map((tarefa) => (
        <div className="decisao" key={tarefa.id}>
          <span>{tarefa.titulo}</span>
          <small>
            {tarefa.coluna === 'a_fazer' ? 'A fazer' : tarefa.coluna === 'fazendo' ? 'Fazendo' : tarefa.coluna === 'revisao' ? 'Revisão' : 'Feito'}
            {projeto.repositorio && <> · <a href={`https://github.com/${projeto.repositorio}/issues/${tarefa.githubIssueNumero}`} target="_blank" rel="noreferrer">#{tarefa.githubIssueNumero}</a></>}
          </small>
        </div>
      ))}
    </article>
  )}
  ```
- [ ] **Step 4:** Em `Quadro.tsx`, no card (`<article key={tarefa.id} className="cartao" ...>`), trocar a linha `{tarefa.referencia && <span>{tarefa.referencia}</span>}` por um link quando houver `githubIssueNumero` e a tarefa pertencer a um projeto com repo conhecido — como `Quadro.tsx` não carrega a lista de Projetos hoje, a forma mais simples sem buscar dados extras é continuar mostrando `tarefa.referencia` como texto (já é isso que `/github/webhook` e o sync preenchem no formato `dono/repo#numero`), só tornando clicável quando o texto bate nesse padrão:
  ```tsx
  {tarefa.referencia && (
    /^[\w.-]+\/[\w.-]+#\d+$/.test(tarefa.referencia)
      ? <a href={`https://github.com/${tarefa.referencia.replace('#', '/issues/')}`} target="_blank" rel="noreferrer">{tarefa.referencia}</a>
      : <span>{tarefa.referencia}</span>
  )}
  ```
- [ ] **Step 5:** `pnpm --filter @spl/hub run typecheck` — PASS.
- [ ] **Step 6:** Commit:
  ```bash
  git add apps/hub/components/Projetos.tsx apps/hub/components/Quadro.tsx
  git commit -m "feat(hub): aba Issues no projeto e link p/ GitHub no quadro"
  ```

---

### Task 14: Verificação final e checklist de deploy

**Files:** nenhum arquivo novo — só validação.

- [ ] **Step 1:** Rodar `pnpm -r run typecheck` na raiz do monorepo — tudo PASS.
- [ ] **Step 2:** Rodar `pnpm -r run test` na raiz — tudo PASS.
- [ ] **Step 3:** Revisar `git log --oneline` desde o início dessa plan — confirmar que cada task virou um commit, sem nada solto fora de commit (`git status` limpo).
- [ ] **Step 4:** Escrever (nesse momento, na conversa com o usuário — não é um arquivo) o checklist final de variáveis de ambiente do Dokploy e o lembrete de rodar `prisma migrate deploy` no próximo deploy, já que isso não é código e o usuário pediu pra ser avisado separadamente.
- [ ] **Step 5:** Push: `git push origin main`.

---

## Observações para quem executar

- Alguns `Step` pedem pra **inspecionar um arquivo de teste existente antes de escrever** (padrão de fixture do módulo) em vez de assumir uma API de teste que pode não existir — isso é proposital: o padrão de cada arquivo de teste nesse repo varia um pouco (`contexto()`, `memoria()`, etc.) e é mais seguro copiar o padrão real do arquivo do que inventar um.
- O payload do evento `projects_v2_item` (Task 9) é a parte menos testável sem um GitHub real — o teste automatizado cobre só a verificação de assinatura e o roteamento; a tradução do campo `changes.field_value` precisa de validação manual pós-deploy com um evento real (mover um card no board e checar os logs).
- Nenhuma task depende de rede durante os testes — tudo roda contra `FakeGitHubProjetos` e repositórios em memória.
