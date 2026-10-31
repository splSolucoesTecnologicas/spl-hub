const NOME = 'spl_sessao'
const MAX_AGE = 60 * 60 * 12

/** Cookie só no caminho /hub, para não vazar na landing (mesmo domínio). A API recebe o token no header Authorization, não neste cookie. */
export function gravarSessao(token: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${NOME}=${encodeURIComponent(token)}; Path=/hub; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`
}

export function lerSessao(): string | null {
  const item = document.cookie.split('; ').find((parte) => parte.startsWith(`${NOME}=`))
  if (!item) return null
  const valor = decodeURIComponent(item.slice(NOME.length + 1))
  return valor || null
}

export function apagarSessao() {
  document.cookie = `${NOME}=; Path=/hub; SameSite=Lax; Max-Age=0`
}
