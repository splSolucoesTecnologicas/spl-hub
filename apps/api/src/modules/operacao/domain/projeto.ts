import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';

export const TIPOS_PROJETO = ['produto', 'sob_medida', 'interno'] as const;
export type TipoProjeto = (typeof TIPOS_PROJETO)[number];
export const STATUS_PROJETO = ['piloto', 'validacao', 'em_desenvolvimento', 'proposta', 'pausado', 'concluido'] as const;
export type StatusProjeto = (typeof STATUS_PROJETO)[number];
export const AREAS_RESPONSAVEL = ['dev', 'marketing', 'administracao', 'comercial', 'financeiro', 'juridico', 'infra', 'admin_produto'] as const;
export type AreaResponsavel = (typeof AREAS_RESPONSAVEL)[number];
export const STATUS_MARCO = ['em_andamento', 'aguardando_resposta', 'em_revisao', 'feito'] as const;
export type StatusMarco = (typeof STATUS_MARCO)[number];

export interface ResponsavelProjeto { area: AreaResponsavel; usuarioId: string }
export interface MarcoProjeto { id: string; titulo: string; status: StatusMarco; detalhe: string; ordem: number }

const COR = /^#[0-9a-fA-F]{6}$/;
const REPO = /^[\w.-]+\/[\w.-]+$/;
const URL = /^https?:\/\/\S+$/;
const COLUNAS_HUB = ['a_fazer', 'fazendo', 'revisao', 'feito'] as const;

export interface ProjetoProps {
  id: string;
  nome: string;
  tipo: TipoProjeto;
  status: StatusProjeto;
  descricao: string;
  cor: string;
  repositorio: string | null;
  quadroUrl: string | null;
  adminUrl: string | null;
  githubProjectNumero: number | null;
  githubColunaMap: Record<string, string> | null;
  progresso: number;
  progressoRotulo: string;
  responsaveis: ResponsavelProjeto[];
  clienteIds: string[];
  marcos: MarcoProjeto[];
  criadoEm: Date;
  atualizadoEm: Date;
}

export class Projeto {
  private constructor(private props: ProjetoProps) {}

  static criar(input: Omit<ProjetoProps, 'criadoEm' | 'atualizadoEm' | 'descricao' | 'repositorio' | 'quadroUrl' | 'adminUrl' | 'githubProjectNumero' | 'githubColunaMap' | 'progresso' | 'progressoRotulo' | 'responsaveis' | 'clienteIds' | 'marcos'> & {
    agora: Date; descricao?: string; repositorio?: string | null; quadroUrl?: string | null; adminUrl?: string | null;
    githubProjectNumero?: number | null; githubColunaMap?: Record<string, string> | null;
    progresso?: number; progressoRotulo?: string; responsaveis?: ResponsavelProjeto[]; clienteIds?: string[]; marcos?: MarcoProjeto[];
  }): Projeto {
    const projeto = new Projeto({
      id: input.id, nome: '', tipo: 'produto', status: 'piloto', descricao: '', cor: '#4c8dff',
      repositorio: null, quadroUrl: null, adminUrl: null, githubProjectNumero: null, githubColunaMap: null, progresso: 0, progressoRotulo: '',
      responsaveis: [], clienteIds: [], marcos: [], criadoEm: input.agora, atualizadoEm: input.agora,
    });
    projeto.aplicar(input);
    return projeto;
  }

  static restaurar(props: ProjetoProps): Projeto {
    return new Projeto({
      ...props,
      responsaveis: props.responsaveis.map((item) => ({ ...item })),
      clienteIds: [...props.clienteIds],
      marcos: props.marcos.map((item) => ({ ...item })),
    });
  }

  atualizar(input: Partial<Omit<ProjetoProps, 'id' | 'criadoEm' | 'atualizadoEm'>>, agora: Date): void {
    this.aplicar({ ...this.props, ...input });
    this.props.atualizadoEm = agora;
  }

  private aplicar(input: {
    nome: string; tipo: TipoProjeto; status: StatusProjeto; cor: string; descricao?: string;
    repositorio?: string | null; quadroUrl?: string | null; adminUrl?: string | null; progresso?: number;
    githubProjectNumero?: number | null; githubColunaMap?: Record<string, string> | null;
    progressoRotulo?: string; responsaveis?: ResponsavelProjeto[]; clienteIds?: string[]; marcos?: MarcoProjeto[];
  }): void {
    const nome = input.nome.trim();
    if (nome.length < 2) throw new ErroDeDominio('nome_curto', 'Nome precisa de pelo menos 2 caracteres');
    if (!TIPOS_PROJETO.includes(input.tipo)) throw new ErroDeDominio('tipo_invalido', 'Tipo de projeto inválido');
    if (!STATUS_PROJETO.includes(input.status)) throw new ErroDeDominio('status_invalido', 'Status de projeto inválido');
    if (!COR.test(input.cor)) throw new ErroDeDominio('cor_invalida', 'Cor precisa ser hexadecimal, como #00FF66');
    const progresso = input.progresso ?? 0;
    if (!Number.isInteger(progresso) || progresso < 0 || progresso > 100) throw new ErroDeDominio('progresso_invalido', 'Progresso fica entre 0 e 100');
    const repositorio = limpar(input.repositorio);
    const quadroUrl = limpar(input.quadroUrl);
    const adminUrl = limpar(input.adminUrl);
    if (repositorio && !REPO.test(repositorio)) throw new ErroDeDominio('repositorio_invalido', 'Repositório no formato dono/nome');
    if (quadroUrl && !URL.test(quadroUrl)) throw new ErroDeDominio('url_invalida', 'Link do quadro precisa ser uma URL http(s)');
    if (adminUrl && !URL.test(adminUrl)) throw new ErroDeDominio('url_invalida', 'URL do admin precisa ser http(s)');
    if (input.githubColunaMap != null) {
      const completo = COLUNAS_HUB.every((coluna) => typeof input.githubColunaMap![coluna] === 'string' && input.githubColunaMap![coluna].length > 0);
      if (!completo || Object.keys(input.githubColunaMap).length !== COLUNAS_HUB.length) {
        throw new ErroDeDominio('mapeamento_incompleto', 'Mapeamento de colunas precisa cobrir a_fazer, fazendo, revisao e feito');
      }
    }
    const responsaveis = (input.responsaveis ?? []).map((item) => ({ area: item.area, usuarioId: item.usuarioId }));
    for (const item of responsaveis) {
      if (!AREAS_RESPONSAVEL.includes(item.area)) throw new ErroDeDominio('area_invalida', 'Área do responsável inválida');
    }
    const marcos = (input.marcos ?? []).map((item, indice) => {
      const titulo = item.titulo.trim();
      if (titulo.length < 2) throw new ErroDeDominio('titulo_curto', 'Marco precisa de um título');
      if (!STATUS_MARCO.includes(item.status)) throw new ErroDeDominio('status_invalido', 'Status do marco inválido');
      return { id: item.id, titulo, status: item.status, detalhe: (item.detalhe ?? '').trim(), ordem: item.ordem ?? indice };
    });
    this.props.nome = nome;
    this.props.tipo = input.tipo;
    this.props.status = input.status;
    this.props.descricao = (input.descricao ?? '').trim();
    this.props.cor = input.cor.toLowerCase();
    this.props.repositorio = repositorio;
    this.props.quadroUrl = quadroUrl;
    this.props.adminUrl = adminUrl;
    this.props.githubProjectNumero = input.githubProjectNumero ?? null;
    this.props.githubColunaMap = input.githubColunaMap ?? null;
    this.props.progresso = progresso;
    this.props.progressoRotulo = (input.progressoRotulo ?? '').trim();
    this.props.responsaveis = responsaveis;
    this.props.clienteIds = [...new Set(input.clienteIds ?? [])];
    this.props.marcos = marcos;
  }

  get id() { return this.props.id; }
  get nome() { return this.props.nome; }
  get tipo() { return this.props.tipo; }
  get status() { return this.props.status; }
  get descricao() { return this.props.descricao; }
  get cor() { return this.props.cor; }
  get repositorio() { return this.props.repositorio; }
  get quadroUrl() { return this.props.quadroUrl; }
  get adminUrl() { return this.props.adminUrl; }
  get githubProjectNumero() { return this.props.githubProjectNumero; }
  get githubColunaMap() { return this.props.githubColunaMap; }
  get progresso() { return this.props.progresso; }
  get progressoRotulo() { return this.props.progressoRotulo; }
  get responsaveis() { return this.props.responsaveis; }
  get clienteIds() { return this.props.clienteIds; }
  get marcos() { return this.props.marcos; }
  get criadoEm() { return this.props.criadoEm; }
  get atualizadoEm() { return this.props.atualizadoEm; }
  toJSON(): ProjetoProps { return { ...this.props, responsaveis: this.props.responsaveis.map((item) => ({ ...item })), clienteIds: [...this.props.clienteIds], marcos: this.props.marcos.map((item) => ({ ...item })) }; }
}

function limpar(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? '';
  return texto.length ? texto : null;
}
