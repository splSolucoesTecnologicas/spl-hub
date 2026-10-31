import type { Prisma, PrismaClient } from '@prisma/client';
import { paginar } from '../../../../shared/application/paginar.js';
import { DesafioTotp, Sessao, SolicitacaoAcesso, type AuditoriaProps } from '../../domain/sessao.js';
import { Usuario, type Permissoes, type UsuarioProps } from '../../domain/usuario.js';
import type { AuditoriaRepository, DesafioRepository, SessaoRepository, SolicitacaoRepository, UsuarioRepository } from '../../application/ports.js';

function usuarioDe(row: {
  id: string; nome: string; email: string; senhaHash: string; totpSegredo: string | null; totpAtivo: boolean;
  vinculo: string; area: string; cidade: string | null; uf: string | null; ativo: boolean; admin: boolean;
  permissoes: unknown; frentes: string[]; exemplo: boolean; tentativas: number; bloqueadoAte: Date | null;
  ultimoAcesso: Date | null; criadoEm: Date;
}): Usuario {
  return Usuario.restaurar({ ...row, vinculo: row.vinculo as UsuarioProps['vinculo'], area: row.area as UsuarioProps['area'], permissoes: row.permissoes as Permissoes });
}

export class PrismaUsuarioRepository implements UsuarioRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(usuario: Usuario) {
    const { id, permissoes, ...resto } = usuario.toJSON();
    const json = permissoes as unknown as Prisma.InputJsonValue;
    await this.db.usuario.upsert({
      where: { id },
      create: { id, ...resto, permissoes: json },
      update: { ...resto, permissoes: json },
    });
  }
  async buscarPorId(id: string) { const row = await this.db.usuario.findUnique({ where: { id } }); return row ? usuarioDe(row) : null; }
  async buscarPorEmail(email: string) { const row = await this.db.usuario.findUnique({ where: { email: email.trim().toLowerCase() } }); return row ? usuarioDe(row) : null; }
  async listar({ limite, cursor }: { limite: number; cursor?: string }) {
    const rows = await this.db.usuario.findMany({ take: limite + 1, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    const pagina = paginar(rows, limite);
    return { itens: pagina.itens.map(usuarioDe), proximoCursor: pagina.proximoCursor };
  }
  async contarAdmins() { return this.db.usuario.count({ where: { admin: true, ativo: true } }); }
}

export class PrismaSessaoRepository implements SessaoRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(sessao: Sessao) { const dados = sessao.toJSON(); await this.db.sessao.upsert({ where: { id: dados.id }, create: dados, update: dados }); }
  async buscarPorHash(tokenHash: string) { const row = await this.db.sessao.findUnique({ where: { tokenHash } }); return row ? Sessao.restaurar(row) : null; }
  async revogar(tokenHash: string) { await this.db.sessao.deleteMany({ where: { tokenHash } }); }
}

export class PrismaDesafioRepository implements DesafioRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(desafio: DesafioTotp) { const dados = desafio.toJSON(); await this.db.desafioTotp.upsert({ where: { id: dados.id }, create: dados, update: dados }); }
  async buscar(id: string) { const row = await this.db.desafioTotp.findUnique({ where: { id } }); return row ? DesafioTotp.restaurar(row) : null; }
  async consumir(id: string) { await this.db.desafioTotp.deleteMany({ where: { id } }); }
}

export class PrismaSolicitacaoRepository implements SolicitacaoRepository {
  constructor(private readonly db: PrismaClient) {}
  async salvar(solicitacao: SolicitacaoAcesso) {
    const dados = solicitacao.toJSON();
    await this.db.solicitacaoAcesso.upsert({ where: { id: dados.id }, create: dados, update: dados });
  }
  async buscarPorId(id: string) {
    const row = await this.db.solicitacaoAcesso.findUnique({ where: { id } });
    return row ? SolicitacaoAcesso.restaurar(row as ReturnType<SolicitacaoAcesso['toJSON']>) : null;
  }
  async listar() {
    const rows = await this.db.solicitacaoAcesso.findMany({ orderBy: { criadaEm: 'desc' } });
    return rows.map((row) => SolicitacaoAcesso.restaurar(row as ReturnType<SolicitacaoAcesso['toJSON']>));
  }
}

export class PrismaAuditoriaRepository implements AuditoriaRepository {
  constructor(private readonly db: PrismaClient) {}
  async registrar(evento: AuditoriaProps) { await this.db.auditoria.create({ data: evento }); }
  async listar() { return this.db.auditoria.findMany({ orderBy: { criadaEm: 'desc' } }); }
}
