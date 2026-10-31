export function paginar<T extends { id: string }>(itens: T[], limite: number, cursor?: string) {
  const ordenados = [...itens].sort((a, b) => a.id.localeCompare(b.id));
  const inicio = cursor ? ordenados.findIndex((item) => item.id > cursor) : 0;
  const base = inicio < 0 ? [] : ordenados.slice(Math.max(inicio, 0));
  const fatia = base.slice(0, limite + 1);
  const temMais = fatia.length > limite;
  const pagina = fatia.slice(0, limite);
  return { itens: pagina, proximoCursor: temMais ? pagina[pagina.length - 1]!.id : null };
}
