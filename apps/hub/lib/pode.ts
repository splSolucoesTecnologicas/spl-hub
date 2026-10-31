import type { UsuarioDTO } from '@spl/contracts';

const ORDEM = ['off', 'so_frentes', 'ler', 'editar'];

export function pode(usuario: UsuarioDTO, modulo: keyof UsuarioDTO['permissoes'], minimo: 'so_frentes' | 'ler' | 'editar'): boolean {
  if (!usuario.ativo) return false;
  if (usuario.admin) return true;
  const atual = usuario.permissoes[modulo]?.nivel ?? 'off';
  return ORDEM.indexOf(atual) >= ORDEM.indexOf(minimo);
}
