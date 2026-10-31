import { geocodificar } from '@spl/contracts';
import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';
import type { GeradorId, Relogio } from '../../../shared/application/tempo.js';
import type { Usuario } from '../../acesso/domain/usuario.js';
import { Cliente } from '../domain/cliente.js';
import { Projeto, type MarcoProjeto, type ResponsavelProjeto, type StatusProjeto, type TipoProjeto } from '../domain/projeto.js';
import { Decisao, Objetivo } from '../domain/socios.js';
import type { ClienteRepository, DecisaoRepository, ObjetivoRepository, ProjetoRepository } from './ports.js';

export class RegistroNaoEncontrado extends ErroDeDominio {
  constructor(mensagem: string) { super('nao_encontrada', mensagem); }
}

function coordsDe(input: { cidade: string; uf: string; latitude?: number; longitude?: number }): { latitude: number; longitude: number } {
  if (input.latitude != null && input.longitude != null) return { latitude: input.latitude, longitude: input.longitude };
  const geo = geocodificar(input.cidade, input.uf);
  if (!geo) throw new ErroDeDominio('cidade_sem_coordenada', 'Cidade não reconhecida. Informe latitude e longitude ou escolha o ponto no mapa');
  return { latitude: geo.lat, longitude: geo.lon };
}

function vazio(valor: string | null | undefined): string | null {
  const texto = valor?.trim() ?? '';
  return texto.length ? texto : null;
}

export function criarCasosDeUsoOperacao(deps: {
  clientes: ClienteRepository;
  projetos: ProjetoRepository;
  decisoes: DecisaoRepository;
  objetivos: ObjetivoRepository;
  relogio: Relogio;
  ids: GeradorId;
}) {
  const { clientes, projetos, decisoes, objetivos, relogio, ids } = deps;

  function verProjeto(ator: Usuario, projeto: Projeto): boolean {
    if (ator.admin || ator.pode('projetos', 'ler')) return true;
    return ator.pode('projetos', 'so_frentes') && projeto.responsaveis.some((item) => item.usuarioId === ator.id);
  }

  return {
    async listarClientes(ator: Usuario, params: { limite?: number; cursor?: string }) {
      if (!ator.admin && !ator.pode('clientes', 'ler') && !ator.pode('clientes', 'so_frentes')) {
        throw new ErroDeDominio('sem_permissao', 'Sem permissão para ver clientes');
      }
      const pagina = await clientes.listar({ limite: Math.min(params.limite ?? 100, 100), cursor: params.cursor });
      if (ator.admin || ator.pode('clientes', 'ler')) return pagina;
      const meus = await projetos.listarTodos();
      const idsLigados = new Set(meus.filter((item) => item.responsaveis.some((resp) => resp.usuarioId === ator.id)).flatMap((item) => item.clienteIds));
      const itens = pagina.itens.filter((item) => idsLigados.has(item.id));
      return { itens, proximoCursor: null as string | null };
    },

    async criarCliente(ator: Usuario, input: {
      nome: string; cidade: string; uf: string; latitude?: number; longitude?: number; status: string;
      responsavelId?: string | null; ultimoContato?: Date | null; observacoes?: string;
    }) {
      ator.exigir('clientes', 'editar');
      const ponto = coordsDe(input);
      const cliente = Cliente.criar({ id: ids.novo(), agora: relogio.agora(), ...input, ...ponto });
      await clientes.salvar(cliente);
      return cliente;
    },

    async atualizarCliente(ator: Usuario, id: string, input: {
      nome?: string; cidade?: string; uf?: string; latitude?: number; longitude?: number; status?: string;
      responsavelId?: string | null; ultimoContato?: Date | null; observacoes?: string;
    }) {
      ator.exigir('clientes', 'editar');
      const cliente = await clientes.buscarPorId(id);
      if (!cliente) throw new RegistroNaoEncontrado('Cliente não encontrado');
      const cidade = input.cidade ?? cliente.cidade;
      const uf = input.uf ?? cliente.uf;
      const ponto = coordsDe({
        cidade, uf,
        latitude: input.latitude ?? (input.cidade || input.uf ? undefined : cliente.latitude),
        longitude: input.longitude ?? (input.cidade || input.uf ? undefined : cliente.longitude),
      });
      cliente.atualizar({ ...input, ...ponto }, relogio.agora());
      await clientes.salvar(cliente);
      return cliente;
    },

    async removerCliente(ator: Usuario, id: string) {
      ator.exigir('clientes', 'editar');
      const cliente = await clientes.buscarPorId(id);
      if (!cliente) throw new RegistroNaoEncontrado('Cliente não encontrado');
      await clientes.remover(id);
      for (const projeto of await projetos.listarTodos()) {
        if (!projeto.clienteIds.includes(id)) continue;
        projeto.atualizar({ clienteIds: projeto.clienteIds.filter((item) => item !== id) }, relogio.agora());
        await projetos.salvar(projeto);
      }
    },

    async listarProjetos(ator: Usuario, params: { limite?: number; cursor?: string }) {
      if (!ator.admin && !ator.pode('projetos', 'ler') && !ator.pode('projetos', 'so_frentes')) {
        throw new ErroDeDominio('sem_permissao', 'Sem permissão para ver projetos');
      }
      const pagina = await projetos.listar({ limite: Math.min(params.limite ?? 100, 100), cursor: params.cursor });
      return { itens: pagina.itens.filter((item) => verProjeto(ator, item)), proximoCursor: pagina.proximoCursor };
    },

    async obterProjeto(ator: Usuario, id: string) {
      const projeto = await projetos.buscarPorId(id);
      if (!projeto) throw new RegistroNaoEncontrado('Projeto não encontrado');
      if (!verProjeto(ator, projeto)) throw new ErroDeDominio('sem_permissao', 'Sem permissão para este projeto');
      return projeto;
    },

    async criarProjeto(ator: Usuario, input: {
      nome: string; tipo: TipoProjeto; status: StatusProjeto; descricao?: string; cor: string;
      repositorio?: string | null; quadroUrl?: string | null; adminUrl?: string | null;
      progresso?: number; progressoRotulo?: string; responsaveis?: ResponsavelProjeto[]; clienteIds?: string[];
      marcos?: Array<Omit<MarcoProjeto, 'id' | 'ordem' | 'detalhe'> & { id?: string; ordem?: number; detalhe?: string }>;
    }) {
      ator.exigir('projetos', 'editar');
      const projeto = Projeto.criar({
        id: ids.novo(), agora: relogio.agora(), ...input,
        repositorio: vazio(input.repositorio), quadroUrl: vazio(input.quadroUrl), adminUrl: vazio(input.adminUrl),
        marcos: (input.marcos ?? []).map((item, ordem) => ({ id: item.id ?? ids.novo(), titulo: item.titulo, status: item.status, detalhe: item.detalhe ?? '', ordem: item.ordem ?? ordem })),
      });
      await projetos.salvar(projeto);
      return projeto;
    },

    async atualizarProjeto(ator: Usuario, id: string, input: {
      nome?: string; tipo?: TipoProjeto; status?: StatusProjeto; descricao?: string; cor?: string;
      repositorio?: string | null; quadroUrl?: string | null; adminUrl?: string | null;
      progresso?: number; progressoRotulo?: string; responsaveis?: ResponsavelProjeto[]; clienteIds?: string[];
      marcos?: Array<Omit<MarcoProjeto, 'id' | 'ordem' | 'detalhe'> & { id?: string; ordem?: number; detalhe?: string }>;
    }) {
      ator.exigir('projetos', 'editar');
      const projeto = await projetos.buscarPorId(id);
      if (!projeto) throw new RegistroNaoEncontrado('Projeto não encontrado');
      const { marcos: marcosEntrada, repositorio, quadroUrl, adminUrl, ...resto } = input;
      const marcos = marcosEntrada?.map((item, ordem) => ({ id: item.id ?? ids.novo(), titulo: item.titulo, status: item.status, detalhe: item.detalhe ?? '', ordem: item.ordem ?? ordem }));
      projeto.atualizar({
        ...resto,
        ...(repositorio !== undefined ? { repositorio: vazio(repositorio) } : {}),
        ...(quadroUrl !== undefined ? { quadroUrl: vazio(quadroUrl) } : {}),
        ...(adminUrl !== undefined ? { adminUrl: vazio(adminUrl) } : {}),
        ...(marcos ? { marcos } : {}),
      }, relogio.agora());
      await projetos.salvar(projeto);
      return projeto;
    },

    async removerProjeto(ator: Usuario, id: string) {
      ator.exigir('projetos', 'editar');
      const projeto = await projetos.buscarPorId(id);
      if (!projeto) throw new RegistroNaoEncontrado('Projeto não encontrado');
      await projetos.remover(id);
    },

    async listarDecisoes(ator: Usuario) {
      ator.exigir('socios', 'ler');
      const itens = await decisoes.listar();
      return itens.sort((a, b) => b.quando.getTime() - a.quando.getTime());
    },

    async criarDecisao(ator: Usuario, input: { titulo: string; detalhe?: string; quando?: Date }) {
      ator.exigir('socios', 'editar');
      const decisao = Decisao.criar({ id: ids.novo(), titulo: input.titulo, detalhe: input.detalhe, quando: input.quando ?? relogio.agora(), autorId: ator.id, agora: relogio.agora() });
      await decisoes.salvar(decisao);
      return decisao;
    },

    async atualizarDecisao(ator: Usuario, id: string, input: { titulo?: string; detalhe?: string; quando?: Date }) {
      ator.exigir('socios', 'editar');
      const decisao = await decisoes.buscarPorId(id);
      if (!decisao) throw new RegistroNaoEncontrado('Decisão não encontrada');
      decisao.atualizar(input);
      await decisoes.salvar(decisao);
      return decisao;
    },

    async removerDecisao(ator: Usuario, id: string) {
      ator.exigir('socios', 'editar');
      if (!await decisoes.buscarPorId(id)) throw new RegistroNaoEncontrado('Decisão não encontrada');
      await decisoes.remover(id);
    },

    async listarObjetivos(ator: Usuario) {
      ator.exigir('socios', 'ler');
      return objetivos.listar();
    },

    async criarObjetivo(ator: Usuario, input: { titulo: string; progresso: number; periodo: string }) {
      ator.exigir('socios', 'editar');
      const objetivo = Objetivo.criar({ id: ids.novo(), agora: relogio.agora(), ...input });
      await objetivos.salvar(objetivo);
      return objetivo;
    },

    async atualizarObjetivo(ator: Usuario, id: string, input: { titulo?: string; progresso?: number; periodo?: string }) {
      ator.exigir('socios', 'editar');
      const objetivo = await objetivos.buscarPorId(id);
      if (!objetivo) throw new RegistroNaoEncontrado('Objetivo não encontrado');
      objetivo.atualizar(input, relogio.agora());
      await objetivos.salvar(objetivo);
      return objetivo;
    },

    async removerObjetivo(ator: Usuario, id: string) {
      ator.exigir('socios', 'editar');
      if (!await objetivos.buscarPorId(id)) throw new RegistroNaoEncontrado('Objetivo não encontrado');
      await objetivos.remover(id);
    },
  };
}

export type CasosDeUsoOperacao = ReturnType<typeof criarCasosDeUsoOperacao>;
