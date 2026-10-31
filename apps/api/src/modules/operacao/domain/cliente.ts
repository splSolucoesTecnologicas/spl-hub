import { ErroDeDominio } from '../../../shared/domain/erro-de-dominio.js';

const UF = /^[A-Z]{2}$/;

export interface ClienteProps {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  latitude: number;
  longitude: number;
  status: string;
  responsavelId: string | null;
  ultimoContato: Date | null;
  observacoes: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export class Cliente {
  private constructor(private props: ClienteProps) {}

  static criar(input: Omit<ClienteProps, 'criadoEm' | 'atualizadoEm' | 'observacoes' | 'responsavelId' | 'ultimoContato'> & {
    agora: Date; observacoes?: string; responsavelId?: string | null; ultimoContato?: Date | null;
  }): Cliente {
    const cliente = new Cliente({
      id: input.id, nome: '', cidade: '', uf: '', latitude: 0, longitude: 0, status: '',
      responsavelId: null, ultimoContato: null, observacoes: '', criadoEm: input.agora, atualizadoEm: input.agora,
    });
    cliente.aplicar(input);
    return cliente;
  }

  static restaurar(props: ClienteProps): Cliente { return new Cliente({ ...props }); }

  atualizar(input: Partial<Omit<ClienteProps, 'id' | 'criadoEm' | 'atualizadoEm'>>, agora: Date): void {
    this.aplicar({ ...this.props, ...input });
    this.props.atualizadoEm = agora;
  }

  private aplicar(input: {
    nome: string; cidade: string; uf: string; latitude: number; longitude: number; status: string;
    responsavelId?: string | null; ultimoContato?: Date | null; observacoes?: string;
  }): void {
    const nome = input.nome.trim();
    const cidade = input.cidade.trim();
    const uf = input.uf.trim().toUpperCase();
    const status = input.status.trim();
    if (nome.length < 2) throw new ErroDeDominio('nome_curto', 'Nome precisa de pelo menos 2 caracteres');
    if (cidade.length < 2) throw new ErroDeDominio('cidade_curta', 'Informe a cidade');
    if (!UF.test(uf)) throw new ErroDeDominio('uf_invalida', 'UF inválida');
    if (status.length < 2 || status.length > 40) throw new ErroDeDominio('status_invalido', 'Status precisa de 2 a 40 caracteres');
    if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
      throw new ErroDeDominio('coordenada_invalida', 'Latitude ou longitude fora do intervalo');
    }
    this.props.nome = nome;
    this.props.cidade = cidade;
    this.props.uf = uf;
    this.props.latitude = input.latitude;
    this.props.longitude = input.longitude;
    this.props.status = status;
    this.props.responsavelId = input.responsavelId ?? null;
    this.props.ultimoContato = input.ultimoContato ?? null;
    this.props.observacoes = (input.observacoes ?? '').trim();
  }

  get id() { return this.props.id; }
  get nome() { return this.props.nome; }
  get cidade() { return this.props.cidade; }
  get uf() { return this.props.uf; }
  get latitude() { return this.props.latitude; }
  get longitude() { return this.props.longitude; }
  get status() { return this.props.status; }
  get responsavelId() { return this.props.responsavelId; }
  get ultimoContato() { return this.props.ultimoContato; }
  get observacoes() { return this.props.observacoes; }
  get criadoEm() { return this.props.criadoEm; }
  get atualizadoEm() { return this.props.atualizadoEm; }
  toJSON(): ClienteProps { return { ...this.props }; }
}
