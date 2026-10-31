import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { caminhosDoBlog } from './src/blog/caminhos.ts'

export default defineConfig({
  plugins: [react(), {
    name: 'github-pages-estatico',
    apply: 'build',
    transformIndexHtml(html: string) {
      const { noticias } = JSON.parse(readFileSync('src/blog/geradas.json', 'utf8')) as { noticias: unknown[] }
      if (noticias.length === 0) return html
      const json = readFileSync('src/blog/geradas.json', 'utf8').replaceAll('<', '\\u003c')
      return html.replace('</head>', `    <script type="application/json" id="spl-noticias">${json}</script>\n  </head>`)
    },
    closeBundle() {
      copyFileSync('dist/index.html', 'dist/404.html')
      const { noticias } = JSON.parse(readFileSync('src/blog/geradas.json', 'utf8')) as { noticias: { slug: string }[] }
      for (const destino of caminhosDoBlog(noticias)) {
        const pasta = join('dist', destino)
        mkdirSync(pasta, { recursive: true })
        copyFileSync('dist/index.html', join(pasta, 'index.html'))
      }
      if (noticias.length > 0) {
        const sitemap = readFileSync('dist/sitemap.xml', 'utf8')
        const extras = ['https://splsolucoes.com/blog', ...noticias.map((noticia) => `https://splsolucoes.com/blog/${noticia.slug}`)]
          .map((loc) => `  <url><loc>${loc}</loc></url>`)
          .join('\n')
        writeFileSync('dist/sitemap.xml', sitemap.replace('</urlset>', `${extras}\n</urlset>`))
      }
      const cname = readFileSync('dist/CNAME', 'utf8').trim()
      if (cname !== 'splsolucoes.com') throw new Error(`CNAME inesperado: ${cname}`)
    },
  }],
  base: '/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testSetup.ts'],
  },
})
