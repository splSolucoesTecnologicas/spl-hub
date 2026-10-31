import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';

const DURACAO_MS = 12 * 60 * 60 * 1000;
const DESAFIO_MS = 5 * 60 * 1000;

export interface SessaoProps { id: string; usuarioId: string; tokenHash: string; expiraEm: Date; criadaEm: Date }
export interface DesafioProps { id: string; usuarioId: string; expiraEm: Date }
export interface SolicitacaoProps {
  id: string; usuarioId: string; modulo: string; nivel: string; motivo: string;
  status: 'pendente' | 'autorizada' | 'recusada'; criadaEm: Date; exemplo: boolean;
}
export interface AuditoriaProps { id: string; atorId: string; acao: string; alvo: string; detalhe: string; criadaEm: Date }

export class Sessao {
  private constructor(private props: SessaoProps) {}
  static abrir(id: string, usuarioId: string, tokenHash: string, agora: Date): Sessao {
    return new Sessao({ id, usuarioId, tokenHash, criadaEm: agora, expiraEm: new Date(agora.getTime() + DURACAO_MS) });
  }
  static restaurar(props: SessaoProps): Sessao { return new Sessao({ ...props }); }
  valida(agora: Date): boolean { return this.props.expiraEm > agora; }
  get id() { return this.props.id; }
  get usuarioId() { return this.props.usuarioId; }
  get tokenHash() { return this.props.tokenHash; }
  get expiraEm() { return this.props.expiraEm; }
  get criadaEm() { return this.props.criadaEm; }
  toJSON(): SessaoProps { return { ...this.props }; }
}

export class DesafioTotp {
  private constructor(private props: DesafioProps) {}
  static abrir(id: string, usuarioId: string, agora: Date): DesafioTotp {
    return new DesafioTotp({ id, usuarioId, expiraEm: new Date(agora.getTime() + DESAFIO_MS) });
  }
  static restaurar(props: DesafioProps): DesafioTotp { return new DesafioTotp({ ...props }); }
  garantirValido(agora: Date): void {
    if (this.props.expiraEm <= agora) throw new ErroDeDominio('codigo_invalido', 'Desafio de 2FA expirado');
  }
  get id() { return this.props.id; }
  get usuarioId() { return this.props.usuarioId; }
  get expiraEm() { return this.props.expiraEm; }
  toJSON(): DesafioProps { return { ...this.props }; }
}

export class SolicitacaoAcesso {
  private constructor(private props: SolicitacaoProps) {}
  static abrir(props: Omit<SolicitacaoProps, 'status'>): SolicitacaoAcesso {
    const motivo = props.motivo.trim();
    if (motivo.length < 3) throw new ErroDeDominio('motivo_curto', 'Motivo precisa de pelo menos 3 caracteres');
    return new SolicitacaoAcesso({ ...props, motivo, status: 'pendente' });
  }
  static restaurar(props: SolicitacaoProps): SolicitacaoAcesso { return new SolicitacaoAcesso({ ...props }); }
  decidir(status: 'autorizada' | 'recusada'): void {
    if (this.props.status !== 'pendente') throw new ErroDeDominio('ja_decidida', 'Solicitação já foi decidida');
    this.props.status = status;
  }
  get id() { return this.props.id; }
  get usuarioId() { return this.props.usuarioId; }
  get modulo() { return this.props.modulo; }
  get nivel() { return this.props.nivel; }
  get motivo() { return this.props.motivo; }
  get status() { return this.props.status; }
  get criadaEm() { return this.props.criadaEm; }
  get exemplo() { return this.props.exemplo; }
  toJSON(): SolicitacaoProps { return { ...this.props }; }
}
