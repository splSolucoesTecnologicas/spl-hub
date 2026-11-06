import {
  AtualizarClienteSchema, AtualizarDecisaoSchema, AtualizarNoticiaSchema, AtualizarObjetivoSchema, AtualizarProjetoSchema,
  AtualizarTarefaSchema, AtualizarUsuarioSchema, AuditoriaSchema, ClienteSchema, CriarClienteSchema, CriarDecisaoSchema,
  CriarNoticiaSchema, CriarObjetivoSchema, CriarProjetoSchema, CriarTarefaSchema, CriarUsuarioSchema, DecisaoSchema,
  GithubOpcaoStatusSchema, GithubProjetoBoardSchema, GithubRepositorioSchema, GithubStatusSchema, ImportacaoIssuesSchema,
  LoginRespostaSchema, LoginSchema, NoticiaSchema, ObjetivoSchema, PaginaClientesSchema, PaginaNoticiasPublicasSchema,
  PaginaNoticiasSchema, PaginaProjetosSchema, PaginaTarefasSchema, PaginaUsuariosSchema, ProjetoSchema, SincronizacaoSchema,
  SolicitacaoAcessoSchema, TarefaSchema, TotpSchema, UsuarioSchema, type GithubStatusDTO, type UsuarioDTO,
} from '@spl/contracts';
import { transporteHttp, type Requisicao, type Transporte } from './api';

interface ProblemaDeEsquema { path: (string | number)[]; message: string }

/** O pedaço de um schema Zod que o módulo usa; o hub não depende do zod direto, só dos schemas do contrato. */
interface Esquema {
  readonly _input: unknown;
  readonly _output: unknown;
  safeParse(dado: unknown): { success: boolean; data?: unknown; error?: { issues: ProblemaDeEsquema[] } };
}
type Saida<S extends Esquema> = S['_output'];
type Entrada<S extends Esquema> = S['_input'];
type EsquemaDePagina = Esquema & { readonly _output: { data: unknown[]; nextCursor: string | null } };

export class ErroDeContrato extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeContrato';
  }
}

export interface DadosOpcoes {
  transporte: Transporte;
  /** Resposta fora do contrato lança no desenvolvimento e nos testes; em produção só vai para o console. */
  estrito: boolean;
  /** Por quanto tempo pessoas e clientes ficam em cache, em milissegundos. */
  validadeDoCache?: number;
  agora?: () => number;
}

const ITENS_POR_PAGINA = 100;
const MAXIMO_DE_PAGINAS = 50;

/** Acesso do hub à API: rotas, contratos, paginação e cache ficam aqui, e as telas pedem os dados pelo nome. */
export function criarDados({ transporte, estrito, validadeDoCache = 60_000, agora = () => Date.now() }: DadosOpcoes) {
  function foraDoContrato(mensagem: string): void {
    if (estrito) throw new ErroDeContrato(mensagem);
    console.error(mensagem);
  }

  function conferir<S extends Esquema>(esquema: S, dado: unknown, onde: string): Saida<S> {
    const resultado = esquema.safeParse(dado);
    if (resultado.success) return resultado.data as Saida<S>;
    const detalhe = (resultado.error?.issues ?? []).slice(0, 3)
      .map((problema) => `${problema.path.join('.') || '(raiz)'}: ${problema.message}`)
      .join('; ');
    foraDoContrato(`Resposta de ${onde} fora do contrato: ${detalhe}`);
    return dado as Saida<S>;
  }

  function conferirLista<S extends Esquema>(esquema: S, dado: unknown, onde: string): Saida<S>[] {
    if (!Array.isArray(dado)) {
      foraDoContrato(`Resposta de ${onde} fora do contrato: esperava uma lista`);
      return [];
    }
    return dado.map((item, indice) => conferir(esquema, item, `${onde} [${indice}]`));
  }

  async function um<S extends Esquema>(esquema: S, requisicao: Requisicao): Promise<Saida<S>> {
    return conferir(esquema, await transporte(requisicao), `${requisicao.metodo} ${requisicao.caminho}`);
  }

  async function semResposta(requisicao: Requisicao): Promise<void> {
    await transporte(requisicao);
  }

  async function arranjo<S extends Esquema>(esquema: S, caminho: string): Promise<Saida<S>[]> {
    return conferirLista(esquema, await transporte({ metodo: 'GET', caminho }), `GET ${caminho}`);
  }

  /** Listas sem paginação, no formato { data }. */
  async function lista<S extends Esquema>(esquema: S, caminho: string): Promise<Saida<S>[]> {
    const corpo = await transporte({ metodo: 'GET', caminho });
    const data = corpo !== null && typeof corpo === 'object' ? (corpo as { data?: unknown }).data : undefined;
    return conferirLista(esquema, data, `GET ${caminho}`);
  }

  /** Segue o cursor até o fim: as telas recebem a lista inteira, não só a primeira página. */
  async function todas<S extends EsquemaDePagina>(esquema: S, caminho: string, filtros: Record<string, string | undefined> = {}): Promise<Saida<S>['data']> {
    const itens: Saida<S>['data'] = [];
    let cursor: string | null = null;
    for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina++) {
      const query = new URLSearchParams({ limite: String(ITENS_POR_PAGINA) });
      for (const [chave, valor] of Object.entries(filtros)) if (valor) query.set(chave, valor);
      if (cursor) query.set('cursor', cursor);
      const resposta: Saida<S> = await um(esquema, { metodo: 'GET', caminho: `${caminho}?${query.toString()}` });
      itens.push(...resposta.data);
      if (!resposta.nextCursor) return itens;
      cursor = resposta.nextCursor;
    }
    foraDoContrato(`GET ${caminho} passou de ${MAXIMO_DE_PAGINAS} páginas; a lista foi cortada`);
    return itens;
  }

  function emCache<T>(carregar: () => Promise<T[]>) {
    let atual: { promessa: Promise<T[]>; em: number } | null = null;
    return {
      async obter(): Promise<T[]> {
        if (!atual || agora() - atual.em >= validadeDoCache) {
          const entrada = { promessa: carregar(), em: agora() };
          atual = entrada;
          // Falha não fica guardada: a próxima tela tenta de novo.
          entrada.promessa.catch(() => { if (atual === entrada) atual = null; });
        }
        return [...await atual.promessa];
      },
      limpar() { atual = null; },
    };
  }

  const pessoas = emCache(() => todas(PaginaUsuariosSchema, '/acesso/usuarios'));
  const clientes = emCache(() => todas(PaginaClientesSchema, '/clientes'));

  async function mudando<T>(cache: { limpar(): void }, operacao: Promise<T>): Promise<T> {
    try {
      return await operacao;
    } finally {
      cache.limpar();
    }
  }

  const caminhoDoRepo = (owner: string, repo: string) => `/projetos/github/repositorios/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  return {
    /** Chamar ao entrar e ao sair: o cache é de quem está logado. */
    limparCache(): void {
      pessoas.limpar();
      clientes.limpar();
    },

    acesso: {
      entrar: (corpo: Entrada<typeof LoginSchema>) => um(LoginRespostaSchema, { metodo: 'POST', caminho: '/acesso/login', corpo }),
      confirmarTotp: (corpo: Entrada<typeof TotpSchema>) => um(LoginRespostaSchema, { metodo: 'POST', caminho: '/acesso/login/totp', corpo }),
      eu: () => um(UsuarioSchema, { metodo: 'GET', caminho: '/acesso/eu' }),
      sair: () => semResposta({ metodo: 'POST', caminho: '/acesso/logout' }),
      solicitacoes: () => lista(SolicitacaoAcessoSchema, '/acesso/solicitacoes'),
      decidirSolicitacao: (id: string, decisao: 'autorizar' | 'recusar') =>
        um(SolicitacaoAcessoSchema, { metodo: 'POST', caminho: `/acesso/solicitacoes/${id}/${decisao}` }),
      auditoria: () => lista(AuditoriaSchema, '/acesso/auditoria'),
    },

    pessoas: {
      listar: () => pessoas.obter(),
      criar: (corpo: Entrada<typeof CriarUsuarioSchema>) => mudando(pessoas, um(UsuarioSchema, { metodo: 'POST', caminho: '/acesso/usuarios', corpo })),
      atualizar: (id: string, corpo: Entrada<typeof AtualizarUsuarioSchema>) =>
        mudando(pessoas, um(UsuarioSchema, { metodo: 'PATCH', caminho: `/acesso/usuarios/${id}`, corpo })),
      remover: (id: string) => mudando(pessoas, semResposta({ metodo: 'DELETE', caminho: `/acesso/usuarios/${id}` })),
    },

    tarefas: {
      listar: (filtros: { filtro?: 'minhas' | 'de_olho' | 'todas'; projetoId?: string } = {}) => todas(PaginaTarefasSchema, '/tarefas', filtros),
      criar: (corpo: Entrada<typeof CriarTarefaSchema>) => um(TarefaSchema, { metodo: 'POST', caminho: '/tarefas', corpo }),
      atualizar: (id: string, corpo: Entrada<typeof AtualizarTarefaSchema>) => um(TarefaSchema, { metodo: 'PATCH', caminho: `/tarefas/${id}`, corpo }),
      remover: (id: string) => semResposta({ metodo: 'DELETE', caminho: `/tarefas/${id}` }),
      sincronizar: () => um(SincronizacaoSchema, { metodo: 'POST', caminho: '/tarefas/sincronizar' }),
      importarIssues: (projetoId: string) => um(ImportacaoIssuesSchema, { metodo: 'POST', caminho: '/tarefas/importar-issues', corpo: { projetoId } }),
    },

    projetos: {
      listar: () => todas(PaginaProjetosSchema, '/projetos'),
      obter: (id: string) => um(ProjetoSchema, { metodo: 'GET', caminho: `/projetos/${id}` }),
      criar: (corpo: Entrada<typeof CriarProjetoSchema>) => um(ProjetoSchema, { metodo: 'POST', caminho: '/projetos', corpo }),
      atualizar: (id: string, corpo: Entrada<typeof AtualizarProjetoSchema>) => um(ProjetoSchema, { metodo: 'PATCH', caminho: `/projetos/${id}`, corpo }),
      remover: (id: string) => semResposta({ metodo: 'DELETE', caminho: `/projetos/${id}` }),
    },

    clientes: {
      listar: () => clientes.obter(),
      criar: (corpo: Entrada<typeof CriarClienteSchema>) => mudando(clientes, um(ClienteSchema, { metodo: 'POST', caminho: '/clientes', corpo })),
      atualizar: (id: string, corpo: Entrada<typeof AtualizarClienteSchema>) =>
        mudando(clientes, um(ClienteSchema, { metodo: 'PATCH', caminho: `/clientes/${id}`, corpo })),
      remover: (id: string) => mudando(clientes, semResposta({ metodo: 'DELETE', caminho: `/clientes/${id}` })),
    },

    github: {
      /** Sem resposta da API, a integração aparece como não conectada. */
      status: (): Promise<GithubStatusDTO> =>
        um(GithubStatusSchema, { metodo: 'GET', caminho: '/github/status' }).catch((falha: unknown) => {
          if (falha instanceof ErroDeContrato) throw falha;
          return { conectado: false, organizacao: null };
        }),
      repositorios: () => arranjo(GithubRepositorioSchema, '/projetos/github/repositorios'),
      boards: (owner: string, repo: string) => arranjo(GithubProjetoBoardSchema, `${caminhoDoRepo(owner, repo)}/boards`),
      opcoesDeStatus: (owner: string, repo: string, numeroBoard: number) =>
        arranjo(GithubOpcaoStatusSchema, `${caminhoDoRepo(owner, repo)}/boards/${numeroBoard}/opcoes-status`),
    },

    decisoes: {
      listar: () => lista(DecisaoSchema, '/decisoes'),
      criar: (corpo: Entrada<typeof CriarDecisaoSchema>) => um(DecisaoSchema, { metodo: 'POST', caminho: '/decisoes', corpo }),
      atualizar: (id: string, corpo: Entrada<typeof AtualizarDecisaoSchema>) => um(DecisaoSchema, { metodo: 'PATCH', caminho: `/decisoes/${id}`, corpo }),
      remover: (id: string) => semResposta({ metodo: 'DELETE', caminho: `/decisoes/${id}` }),
    },

    objetivos: {
      listar: () => lista(ObjetivoSchema, '/objetivos'),
      criar: (corpo: Entrada<typeof CriarObjetivoSchema>) => um(ObjetivoSchema, { metodo: 'POST', caminho: '/objetivos', corpo }),
      atualizar: (id: string, corpo: Entrada<typeof AtualizarObjetivoSchema>) => um(ObjetivoSchema, { metodo: 'PATCH', caminho: `/objetivos/${id}`, corpo }),
      remover: (id: string) => semResposta({ metodo: 'DELETE', caminho: `/objetivos/${id}` }),
    },

    blog: {
      publicadas: async (limite: number) => (await um(PaginaNoticiasPublicasSchema, { metodo: 'GET', caminho: `/blog?limite=${limite}` })).data,
      todas: () => todas(PaginaNoticiasSchema, '/blog/admin'),
      criar: (corpo: Entrada<typeof CriarNoticiaSchema>) => um(NoticiaSchema, { metodo: 'POST', caminho: '/blog/admin', corpo }),
      atualizar: (id: string, corpo: Entrada<typeof AtualizarNoticiaSchema>) => um(NoticiaSchema, { metodo: 'PATCH', caminho: `/blog/admin/${id}`, corpo }),
      remover: (id: string) => semResposta({ metodo: 'DELETE', caminho: `/blog/admin/${id}` }),
      publicar: (id: string) => um(NoticiaSchema, { metodo: 'POST', caminho: `/blog/admin/${id}/publicar` }),
      despublicar: (id: string) => um(NoticiaSchema, { metodo: 'POST', caminho: `/blog/admin/${id}/despublicar` }),
    },
  };
}

export type Dados = ReturnType<typeof criarDados>;

export const dados: Dados = criarDados({ transporte: transporteHttp, estrito: process.env.NODE_ENV !== 'production' });

export function mensagemDeErro(falha: unknown, padrao: string): string {
  return falha instanceof Error && falha.message ? falha.message : padrao;
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** Nome de quem está ligado a um registro: "—" sem ninguém, "pessoa removida" se o id não existe mais. */
export function nomeDaPessoa(pessoas: readonly UsuarioDTO[], id: string | null, forma: 'completo' | 'curto' = 'completo'): string {
  if (!id) return '—';
  const pessoa = pessoas.find((item) => item.id === id);
  if (!pessoa) return 'pessoa removida';
  return forma === 'curto' ? primeiroNome(pessoa.nome) : pessoa.nome;
}
