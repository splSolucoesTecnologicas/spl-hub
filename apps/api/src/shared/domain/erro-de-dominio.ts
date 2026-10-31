/** Erro de regra de negócio. Não carrega detalhe de HTTP: o adapter mapeia `codigo` para o status. */
export class ErroDeDominio extends Error {
  constructor(public readonly codigo: string, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeDominio';
  }
}
