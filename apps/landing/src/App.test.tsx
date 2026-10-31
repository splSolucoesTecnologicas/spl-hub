import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the landing page sections and their navigation targets', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Do desafioao produto.')
    expect(document.getElementById('solucoes')).toBeInTheDocument()
    expect(document.getElementById('thumdra')).toBeInTheDocument()
    expect(document.getElementById('processo')).toBeInTheDocument()
    expect(document.getElementById('contato')).toBeInTheDocument()
  })
})
