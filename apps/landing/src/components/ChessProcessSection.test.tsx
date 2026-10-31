import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChessProcessSection } from './ChessProcessSection'

describe('ChessProcessSection', () => {
  it('renders an accessible chessboard and all four process steps', () => {
    render(<ChessProcessSection />)

    expect(screen.getAllByRole('gridcell')).toHaveLength(64)
    expect(screen.getByRole('heading', { name: 'Estratégia' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Produto' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Desenvolvimento' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evolução' })).toBeInTheDocument()
  })
})
