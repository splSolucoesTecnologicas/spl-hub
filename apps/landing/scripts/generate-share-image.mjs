import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'

const publicDirectory = resolve(process.cwd(), 'public')
const logo = await readFile(resolve(publicDirectory, 'SPL-Icone-App-Verde.svg'))
const logoPng = await sharp(logo)
  .resize(430, 420, { fit: 'contain' })
  .png()
  .toBuffer()

const background = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <radialGradient id="glow">
        <stop offset="0" stop-color="#00ff66" stop-opacity=".16" />
        <stop offset="1" stop-color="#00ff66" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="line" x1="0" x2="1">
        <stop stop-color="#00ff66" />
        <stop offset="1" stop-color="#00ff66" stop-opacity="0" />
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="#050605" />
    <circle cx="1080" cy="330" r="520" fill="url(#glow)" />
    <rect x="80" y="100" width="434" height="430" rx="42" fill="#00ff66" fill-opacity=".08" />
    <text x="590" y="220" fill="#f7f7f5" font-family="Arial, sans-serif" font-size="78" font-weight="700" letter-spacing="2">SPL</text>
    <text x="596" y="270" fill="#8a908c" font-family="Arial, sans-serif" font-size="20" font-weight="600" letter-spacing="5">SOLUÇÕES TECNOLÓGICAS</text>
    <rect x="596" y="310" width="140" height="3" rx="2" fill="url(#line)" />
    <text x="590" y="390" fill="#f7f7f5" font-family="Arial, sans-serif" font-size="43" font-weight="700">Do desafio ao</text>
    <text x="590" y="450" fill="#00ff66" font-family="Arial, sans-serif" font-size="53" font-weight="700">produto.</text>
    <text x="596" y="510" fill="#8a908c" font-family="Arial, sans-serif" font-size="18" letter-spacing="2">ESTRATÉGIA · TECNOLOGIA · RESULTADOS</text>
  </svg>
`)

await sharp(background)
  .composite([{ input: logoPng, left: 82, top: 105 }])
  .png()
  .toFile(resolve(publicDirectory, 'social-preview.png'))
