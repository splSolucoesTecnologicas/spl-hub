import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const destino = resolve(import.meta.dirname, '../src/blog/geradas.json')
const base = (process.env.VITE_API_URL || process.env.BLOG_API_URL || '').replace(/\/$/, '')
let noticias = []

if (!base) {
  console.log('Blog: sem VITE_API_URL. A landing sai com a seção vazia.')
} else {
  try {
    const resposta = await fetch(`${base}/blog?limite=50`, { signal: AbortSignal.timeout(8000) })
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`)
    const corpo = await resposta.json()
    noticias = Array.isArray(corpo.data) ? corpo.data : []
    console.log(`Blog: ${noticias.length} notícia(s) embutida(s) no build.`)
  } catch (erro) {
    console.warn(`Blog: API indisponível (${erro instanceof Error ? erro.message : erro}). Publicando sem notícias.`)
  }
}

await writeFile(destino, `${JSON.stringify({ noticias }, null, 2)}\n`)
