import { cp, rm } from 'node:fs/promises'

// O Dokploy/Nixpacks da landing publica o diretório `dist` na raiz, como antes do monorepo.
await rm(new URL('../dist', import.meta.url), { recursive: true, force: true })
await cp(new URL('../apps/landing/dist', import.meta.url), new URL('../dist', import.meta.url), { recursive: true })
