import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { BlogIndexPage, BlogPostPage } from './blog/BlogPages'
import './styles/global.css'
import './styles/landing-page.css'

function Rotas() {
  const [caminho, setCaminho] = useState(window.location.pathname)
  useEffect(() => {
    const aoVoltar = () => setCaminho(window.location.pathname)
    window.addEventListener('popstate', aoVoltar)
    return () => window.removeEventListener('popstate', aoVoltar)
  }, [])
  if (caminho === '/blog') return <BlogIndexPage />
  if (caminho.startsWith('/blog/')) return <BlogPostPage slug={decodeURIComponent(caminho.slice('/blog/'.length))} />
  return <App />
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Elemento raiz do React não encontrado.')
}

createRoot(rootElement).render(
  <StrictMode>
    <Rotas />
  </StrictMode>,
)
