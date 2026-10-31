import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';

export const MODULOS = [
  'inicio', 'tarefas', 'frentes', 'projetos', 'clientes', 'reunioes', 'blog', 'podcast', 'drive', 'time', 'socios', 'configuracoes', 'admin_thumdra', 'admin_corujuris',
] as const;
export type Modulo = (typeof MODULOS)[number];
export type Vinculo = 'socio' | 'colaborador';
export type Area = 'dev' | 'marketing' | 'administracao' | 'comercial' | 'financeiro' | 'juridico' | 'infra';
export type Nivel = 'off' | 'so_frentes' | 'ler' | 'editar';

export interface PermissaoModulo { nivel: Nivel; extraAte: string | null }
export type Permissoes = Record<Modulo, PermissaoModulo>;

const ORDEM: Nivel[] = ['off', 'so_frentes', 'ler', 'editar'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AREAS: Area[] = ['dev', 'marketing', 'administracao', 'comercial', 'financeiro', 'juridico', 'infra'];
const NIVEIS: Nivel[] = ['off', 'so_frentes', 'ler', 'editar'];

export function nivelAtende(atual: Nivel, minimo: Nivel): boolean {
  return ORDEM.indexOf(atual) >= ORDEM.indexOf(minimo);
}

const nivel = (valor: Nivel): PermissaoModulo => ({ nivel: valor, extraAte: null });

export function permissoesPadrao(vinculo: Vinculo): Permissoes {
  const todas = Object.fromEntries(MODULOS.map((modulo) => [modulo, nivel('ler')])) as Permissoes;
  if (vinculo === 'socio') {
    todas.tarefas = nivel('editar');
    todas.socios = nivel('editar');
    todas.time = nivel('editar');
    todas.projetos = nivel('editar');
    todas.clientes = nivel('editar');
    todas.blog = nivel('editar');
    todas.admin_thumdra = nivel('off');
    todas.admin_corujuris = nivel('off');
    return todas;
  }
  todas.inicio = nivel('so_frentes');
  todas.frentes = nivel('so_frentes');
  todas.tarefas = nivel('editar');
  todas.blog = nivel('off');
  todas.podcast = nivel('off');
  todas.socios = nivel('off');
  todas.configuracoes = nivel('off');
  todas.admin_thumdra = nivel('off');
  todas.admin_corujuris = nivel('off');
  return todas;
}

export interface UsuarioProps {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  totpSegredo: string | null;
  totpAtivo: boolean;
  vinculo: Vinculo;
  area: Area;
  cidade: string | null;
  uf: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  admin: boolean;
  permissoes: Permissoes;
  layoutInicio: unknown | null;
  frentes: string[];
  exemplo: boolean;
  tentativas: number;
  bloqueadoAte: Date | null;
  ultimoAcesso: Date | null;
  criadoEm: Date;
}

export class Usuario {
  private constructor(private props: UsuarioProps) {}

  static criar(input: {
    id: string; nome: string; email: string; senhaHash: string; vinculo: Vinculo; area: Area;
    cidade?: string | null; uf?: string | null; latitude?: number | null; longitude?: number | null; admin?: boolean; frentes?: string[]; exemplo?: boolean;
    permissoes?: Permissoes; totpSegredo?: string | null; totpAtivo?: boolean; criadoEm: Date;
  }): Usuario {
    const nome = input.nome.trim();
    if (nome.length < 2) throw new ErroDeDominio('nome_curto', 'Nome precisa de pelo menos 2 caracteres');
    const email = input.email.trim().toLowerCase();
    if (!EMAIL.test(email)) throw new ErroDeDominio('email_invalido', 'E-mail inválido');
    if (!AREAS.includes(input.area)) throw new ErroDeDominio('area_invalida', 'Área inválida');
    const permissoes = input.permissoes ?? permissoesPadrao(input.vinculo);
    const usuario = new Usuario({
      id: input.id,
      nome,
      email,
      senhaHash: input.senhaHash,
      totpSegredo: input.totpSegredo ?? null,
      totpAtivo: input.totpAtivo ?? false,
      vinculo: input.vinculo,
      area: input.area,
      cidade: input.cidade ?? null,
      uf: input.uf ? input.uf.toUpperCase() : null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      ativo: true,
      admin: input.admin ?? false,
      permissoes,
      layoutInicio: null,
      frentes: input.frentes ?? [],
      exemplo: input.exemplo ?? false,
      tentativas: 0,
      bloqueadoAte: null,
      ultimoAcesso: null,
      criadoEm: input.criadoEm,
    });
    usuario.validarCoordenadas();
    usuario.validarPermissoes(permissoes);
    return usuario;
  }

  static restaurar(props: UsuarioProps): Usuario {
    return new Usuario({ ...props, permissoes: { ...props.permissoes }, frentes: [...props.frentes] });
  }

  private validarPermissoes(permissoes: Permissoes): void {
    for (const modulo of MODULOS) {
      const item = permissoes[modulo];
      if (!item || !NIVEIS.includes(item.nivel)) throw new ErroDeDominio('permissao_ausente', `Permissão ausente: ${modulo}`);
    }
    if (this.props.vinculo === 'colaborador' && permissoes.socios.nivel !== 'off') {
      throw new ErroDeDominio('socios_restrito', 'Módulo Sócios é exclusivo de quem tem vínculo de sócio');
    }
  }

  pode(modulo: Modulo, minimo: Nivel): boolean {
    if (!this.props.ativo) return false;
    if (this.props.admin) return true;
    return nivelAtende(this.props.permissoes[modulo].nivel, minimo);
  }

  exigir(modulo: Modulo, minimo: Nivel): void {
    if (!this.pode(modulo, minimo)) throw new ErroDeDominio('sem_permissao', 'Sem permissão para esta ação');
  }

  garantirNaoBloqueado(agora: Date): void {
    if (this.props.bloqueadoAte && this.props.bloqueadoAte > agora) {
      throw new ErroDeDominio('bloqueado', 'Muitas tentativas. Tente de novo em alguns minutos');
    }
  }

  registrarFalha(agora: Date): void {
    this.props.tentativas += 1;
    if (this.props.tentativas >= 5) this.props.bloqueadoAte = new Date(agora.getTime() + 15 * 60 * 1000);
  }

  registrarSucesso(agora: Date): void {
    this.props.tentativas = 0;
    this.props.bloqueadoAte = null;
    this.props.ultimoAcesso = agora;
  }

  alterarPerfil(input: { nome?: string; vinculo?: Vinculo; area?: Area; cidade?: string | null; uf?: string | null; latitude?: number | null; longitude?: number | null; frentes?: string[]; ativo?: boolean }): void {
    if (input.nome !== undefined) {
      const nome = input.nome.trim();
      if (nome.length < 2) throw new ErroDeDominio('nome_curto', 'Nome precisa de pelo menos 2 caracteres');
      this.props.nome = nome;
    }
    if (input.vinculo) this.props.vinculo = input.vinculo;
    if (input.area) {
      if (!AREAS.includes(input.area)) throw new ErroDeDominio('area_invalida', 'Área inválida');
      this.props.area = input.area;
    }
    if (input.cidade !== undefined) this.props.cidade = input.cidade;
    if (input.uf !== undefined) this.props.uf = input.uf ? input.uf.toUpperCase() : null;
    if (input.latitude !== undefined) this.props.latitude = input.latitude;
    if (input.longitude !== undefined) this.props.longitude = input.longitude;
    if (input.frentes) this.props.frentes = [...new Set(input.frentes.map((frente) => frente.trim()).filter(Boolean))];
    if (input.ativo !== undefined) this.props.ativo = input.ativo;
    if (this.props.vinculo === 'colaborador') this.props.permissoes.socios = nivel('off');
    this.validarCoordenadas();
    this.validarPermissoes(this.props.permissoes);
  }

  definirAdmin(admin: boolean): void {
    this.props.admin = admin;
  }

  definirLayoutInicio(layout: unknown | null): void {
    this.props.layoutInicio = layout;
  }

  private validarCoordenadas(): void {
    const { latitude, longitude } = this.props;
    if (latitude == null && longitude == null) return;
    if (latitude == null || longitude == null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new ErroDeDominio('coordenada_invalida', 'Latitude ou longitude fora do intervalo');
    }
  }

  definirPermissoes(permissoes: Permissoes): void {
    this.validarPermissoes(permissoes);
    this.props.permissoes = permissoes;
  }

  conceder(modulo: Modulo, valor: Nivel): void {
    const proximas = { ...this.props.permissoes, [modulo]: { nivel: valor, extraAte: this.props.permissoes[modulo]?.extraAte ?? null } };
    this.definirPermissoes(proximas);
  }

  iniciarTotp(segredo: string): void {
    this.props.totpSegredo = segredo;
    this.props.totpAtivo = false;
  }

  ativarTotp(): void {
    if (!this.props.totpSegredo) throw new ErroDeDominio('totp_ausente', 'Não há segredo TOTP pendente');
    this.props.totpAtivo = true;
  }

  desativarTotp(): void {
    this.props.totpAtivo = false;
    this.props.totpSegredo = null;
  }

  get id() { return this.props.id; }
  get nome() { return this.props.nome; }
  get email() { return this.props.email; }
  get senhaHash() { return this.props.senhaHash; }
  get totpSegredo() { return this.props.totpSegredo; }
  get totpAtivo() { return this.props.totpAtivo; }
  get vinculo() { return this.props.vinculo; }
  get area() { return this.props.area; }
  get cidade() { return this.props.cidade; }
  get uf() { return this.props.uf; }
  get latitude() { return this.props.latitude; }
  get longitude() { return this.props.longitude; }
  get ativo() { return this.props.ativo; }
  get admin() { return this.props.admin; }
  get permissoes() { return this.props.permissoes; }
  get layoutInicio() { return this.props.layoutInicio; }
  get frentes() { return this.props.frentes; }
  get exemplo() { return this.props.exemplo; }
  get tentativas() { return this.props.tentativas; }
  get bloqueadoAte() { return this.props.bloqueadoAte; }
  get ultimoAcesso() { return this.props.ultimoAcesso; }
  get criadoEm() { return this.props.criadoEm; }

  toJSON(): UsuarioProps {
    return { ...this.props, permissoes: { ...this.props.permissoes }, frentes: [...this.props.frentes] };
  }
}

const ROTULOS_AREA: Record<Area, string> = {
  dev: 'Dev', marketing: 'Marketing', administracao: 'Administração', comercial: 'Comercial', financeiro: 'Financeiro', juridico: 'Jurídico', infra: 'Infra',
};

export function papeisDe(usuario: Usuario): string[] {
  return [usuario.vinculo === 'socio' ? 'Sócio' : 'Colaborador', ROTULOS_AREA[usuario.area], ...(usuario.admin ? ['Admin'] : [])];
}
