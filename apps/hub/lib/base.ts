/** Igual a `basePath` em next.config.mjs. O hub público fica em splsolucoes.com/hub. */
export const BASE_PATH = '/hub'

export function asset(caminho: string) {
  return `${BASE_PATH}${caminho.startsWith('/') ? caminho : `/${caminho}`}`
}
