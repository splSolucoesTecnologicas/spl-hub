import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), {
    name: 'github-pages-estatico',
    apply: 'build',
    transformIndexHtml(html: string) {
      const json = readFileSync('src/blog/geradas.json', 'utf8').replaceAll('<', '\\u003c')
      return html.replace('</head>', `    <script type="application/json" id="spl-noticias">${json}</script>\n  </head>`)
    },
    closeBundle() {
      copyFileSync('dist/index.html', 'dist/404.html')
      const { noticias } = JSON.parse(readFileSync('src/blog/geradas.json', 'utf8')) as { noticias: { slug: string }[] }
      for (const destino of ['blog', ...noticias.map((noticia) => `blog/${noticia.slug}`)]) {
        const pasta = join('dist', destino)
        mkdirSync(pasta, { recursive: true })
        copyFileSync('dist/index.html', join(pasta, 'index.html'))
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
