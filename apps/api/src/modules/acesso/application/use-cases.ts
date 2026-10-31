import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';
import type { GeradorId, Relogio } from '../../../shared/application/tempo.js';
import { DesafioTotp, Sessao, SolicitacaoAcesso } from '../domain/sessao.js';
import { MODULOS, Usuario, type Modulo, type Nivel, type Permissoes, type Vinculo, type Area } from '../domain/usuario.js';
import type { AuditoriaRepository, DesafioRepository, Senhas, SessaoRepository, SolicitacaoRepository, Tokens, TotpPort, UsuarioRepository } from './ports.js';

export class UsuarioNaoEncontrado extends ErroDeDominio {
  constructor() { super('nao_encontrada', 'Usuário não encontrado'); }
}

const MODULO_SET = new Set<string>(MODULOS);
const NIVEIS = new Set<string>(['off', 'so_frentes', 'ler', 'editar']);

function comoModulo(valor: string): Modulo {
  if (!MODULO_SET.has(valor)) throw new ErroDeDominio('modulo_invalido', 'Módulo inválido');
  return valor as Modulo;
}
function comoNivel(valor: string): Nivel {
  if (!NIVEIS.has(valor)) throw new ErroDeDominio('nivel_invalido', 'Nível inválido');
  return valor as Nivel;
}

export function criarCasosDeUsoAcesso(deps: {
  usuarios: UsuarioRepository;
  sessoes: SessaoRepository;
  desafios: DesafioRepository;
  solicitacoes: SolicitacaoRepository;
  auditoria: AuditoriaRepository;
  senhas: Senhas;
  totp: TotpPort;
  tokens: Tokens;
  relogio: Relogio;
  ids: GeradorId;
}) {
  const { usuarios, sessoes, desafios, solicitacoes, auditoria, senhas, totp, tokens, relogio, ids } = deps;

  async function abrirSessao(usuario: Usuario) {
    const token = tokens.novo();
    const agora = relogio.agora();
    usuario.registrarSucesso(agora);
    await usuarios.salvar(usuario);
    const sessao = Sessao.abrir(ids.novo(), usuario.id, tokens.hash(token), agora);
    await sessoes.salvar(sessao);
    return { requer2fa: false as const, token, usuario };
  }

  return {
    async entrar(input: { email: string; senha: string }) {
      const usuario = await usuarios.buscarPorEmail(input.email.trim().toLowerCase());
      const agora = relogio.agora();
      if (!usuario || !usuario.ativo) throw new ErroDeDominio('credenciais_invalidas', 'E-mail ou senha inválidos');
      usuario.garantirNaoBloqueado(agora);
      const ok = await senhas.confere(input.senha, usuario.senhaHash);
      if (!ok) {
        usuario.registrarFalha(agora);
        await usuarios.salvar(usuario);
        throw new ErroDeDominio('credenciais_invalidas', 'E-mail ou senha inválidos');
      }
      if (usuario.totpAtivo) {
        const desafio = DesafioTotp.abrir(ids.novo(), usuario.id, agora);
        await desafios.salvar(desafio);
        return { requer2fa: true as const, desafio: desafio.id };
      }
      return abrirSessao(usuario);
    },

    async confirmarTotp(input: { desafio: string; codigo: string }) {
      const desafio = await desafios.buscar(input.desafio);
      if (!desafio) throw new ErroDeDominio('codigo_invalido', 'Desafio de 2FA inválido');
      const agora = relogio.agora();
      desafio.garantirValido(agora);
      const usuario = await usuarios.buscarPorId(desafio.usuarioId);
      if (!usuario || !usuario.totpSegredo) throw new ErroDeDominio('codigo_invalido', 'Desafio de 2FA inválido');
      if (!totp.confere(usuario.totpSegredo, input.codigo, agora)) throw new ErroDeDominio('codigo_invalido', 'Código autenticador inválido');
      await desafios.consumir(desafio.id);
      return abrirSessao(usuario);
    },

    async sair(token: string) {
      await sessoes.revogar(tokens.hash(token));
    },

    async usuarioDoToken(token: string) {
      const sessao = await sessoes.buscarPorHash(tokens.hash(token));
      if (!sessao || !sessao.valida(relogio.agora())) throw new ErroDeDominio('nao_autenticado', 'Sessão ausente ou expirada');
      const usuario = await usuarios.buscarPorId(sessao.usuarioId);
      if (!usuario || !usuario.ativo) throw new ErroDeDominio('nao_autenticado', 'Sessão ausente ou expirada');
      return usuario;
    },

    async listarUsuarios(ator: Usuario, params: { limite?: number; cursor?: string }) {
      ator.exigir('time', 'ler');
      return usuarios.listar({ limite: Math.min(params.limite ?? 50, 100), cursor: params.cursor });
    },

    async atualizarUsuario(ator: Usuario, id: string, input: {
      nome?: string; vinculo?: Vinculo; area?: Area; cidade?: string | null; uf?: string | null;
      latitude?: number | null; longitude?: number | null; frentes?: string[];
      permissoes?: Permissoes; ativo?: boolean; admin?: boolean; layoutInicio?: unknown | null;
    }) {
      const souEu = ator.id === id;
      if (!ator.admin && !souEu) throw new ErroDeDominio('sem_permissao', 'Só admin edita outras pessoas');
      const alvo = await usuarios.buscarPorId(id);
      if (!alvo) throw new UsuarioNaoEncontrado();
      const entrada = ator.admin
        ? input
        : { nome: input.nome, cidade: input.cidade, uf: input.uf, latitude: input.latitude, longitude: input.longitude };
      const deixaDeSerAdmin = alvo.admin && (entrada.ativo === false || input.admin === false);
      if (deixaDeSerAdmin) {
        const admins = await usuarios.contarAdmins();
        if (admins <= 1) throw new ErroDeDominio('ultimo_admin', 'Não é possível desativar o último admin');
      }
      alvo.alterarPerfil(entrada);
      if (ator.admin && input.admin !== undefined) alvo.definirAdmin(input.admin);
      if (ator.admin && input.permissoes) alvo.definirPermissoes(input.permissoes);
      if (souEu && input.layoutInicio !== undefined) alvo.definirLayoutInicio(input.layoutInicio);
      await usuarios.salvar(alvo);
      await auditoria.registrar({
        id: ids.novo(), atorId: ator.id, acao: 'atualizar_usuario', alvo: alvo.id,
        detalhe: `${ator.nome} atualizou perfil ou permissões de ${alvo.nome}`, criadaEm: relogio.agora(),
      });
      return alvo;
    },

    async iniciarTotp(ator: Usuario) {
      const segredo = totp.gerarSegredo();
      ator.iniciarTotp(segredo);
      await usuarios.salvar(ator);
      return { segredo, uri: totp.uri(ator.email, segredo) };
    },

    async confirmarTotpProprio(ator: Usuario, codigo: string) {
      if (!ator.totpSegredo || !totp.confere(ator.totpSegredo, codigo, relogio.agora())) {
        throw new ErroDeDominio('codigo_invalido', 'Código autenticador inválido');
      }
      ator.ativarTotp();
      await usuarios.salvar(ator);
      return ator;
    },

    async listarSolicitacoes(ator: Usuario) {
      ator.exigir('time', 'ler');
      return solicitacoes.listar();
    },

    async decidirSolicitacao(ator: Usuario, id: string, status: 'autorizada' | 'recusada') {
      if (!ator.admin) throw new ErroDeDominio('sem_permissao', 'Só admin decide acesso extra');
      const solicitacao = await solicitacoes.buscarPorId(id);
      if (!solicitacao) throw new ErroDeDominio('nao_encontrada', 'Solicitação não encontrada');
      solicitacao.decidir(status);
      await solicitacoes.salvar(solicitacao);
      if (status === 'autorizada') {
        const alvo = await usuarios.buscarPorId(solicitacao.usuarioId);
        if (!alvo) throw new UsuarioNaoEncontrado();
        alvo.conceder(comoModulo(solicitacao.modulo), comoNivel(solicitacao.nivel));
        await usuarios.salvar(alvo);
      }
      await auditoria.registrar({
        id: ids.novo(), atorId: ator.id, acao: status === 'autorizada' ? 'autorizar_acesso' : 'recusar_acesso',
        alvo: solicitacao.usuarioId, detalhe: `${ator.nome} ${status === 'autorizada' ? 'autorizou' : 'recusou'} ${solicitacao.nivel} em ${solicitacao.modulo}`,
        criadaEm: relogio.agora(),
      });
      return solicitacao;
    },

    async listarAuditoria(ator: Usuario) {
      if (!ator.admin) throw new ErroDeDominio('sem_permissao', 'Só admin lê a auditoria');
      return auditoria.listar();
    },

    async criarUsuario(input: {
      nome: string; email: string; senha: string; vinculo: Vinculo; area: Area; admin?: boolean;
      cidade?: string | null; uf?: string | null; latitude?: number | null; longitude?: number | null; frentes?: string[]; exemplo?: boolean;
      permissoes?: Permissoes; totpSegredo?: string | null; totpAtivo?: boolean;
    }) {
      if (input.senha.length < 8) throw new ErroDeDominio('senha_curta', 'Senha precisa de pelo menos 8 caracteres');
      const existente = await usuarios.buscarPorEmail(input.email);
      if (existente) throw new ErroDeDominio('email_em_uso', 'E-mail já cadastrado');
      const usuario = Usuario.criar({
        id: ids.novo(), nome: input.nome, email: input.email, senhaHash: await senhas.hash(input.senha),
        vinculo: input.vinculo, area: input.area, admin: input.admin, cidade: input.cidade, uf: input.uf,
        latitude: input.latitude, longitude: input.longitude,
        frentes: input.frentes, exemplo: input.exemplo, permissoes: input.permissoes,
        totpSegredo: input.totpSegredo, totpAtivo: input.totpAtivo, criadoEm: relogio.agora(),
      });
      await usuarios.salvar(usuario);
      return usuario;
    },

    async criarPorAdmin(ator: Usuario, input: {
      nome: string; email: string; senha: string; vinculo: Vinculo; area: Area; admin?: boolean;
      cidade?: string | null; uf?: string | null; latitude?: number | null; longitude?: number | null;
    }) {
      if (!ator.admin) throw new ErroDeDominio('sem_permissao', 'Só admin adiciona pessoas');
      const usuario = await this.criarUsuario({ ...input, exemplo: false });
      await auditoria.registrar({
        id: ids.novo(), atorId: ator.id, acao: 'criar_usuario', alvo: usuario.id,
        detalhe: `${ator.nome} adicionou ${usuario.nome}`, criadaEm: relogio.agora(),
      });
      return usuario;
    },

    async excluirUsuario(ator: Usuario, id: string) {
      if (!ator.admin) throw new ErroDeDominio('sem_permissao', 'Só admin exclui pessoas');
      if (ator.id === id) throw new ErroDeDominio('autoexclusao', 'Você não pode excluir a si mesmo');
      const alvo = await usuarios.buscarPorId(id);
      if (!alvo) throw new UsuarioNaoEncontrado();
      if (alvo.admin && alvo.ativo) {
        const admins = await usuarios.contarAdmins();
        if (admins <= 1) throw new ErroDeDominio('ultimo_admin', 'Não é possível excluir o último admin');
      }
      await usuarios.remover(id);
      await auditoria.registrar({
        id: ids.novo(), atorId: ator.id, acao: 'excluir_usuario', alvo: id,
        detalhe: `${ator.nome} excluiu ${alvo.nome}`, criadaEm: relogio.agora(),
      });
    },
  };
}

export type CasosDeUsoAcesso = ReturnType<typeof criarCasosDeUsoAcesso>;
