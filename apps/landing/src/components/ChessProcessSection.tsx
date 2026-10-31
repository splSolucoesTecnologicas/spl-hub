import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

const FILES = 'abcdefgh'
const QUEEN_POSITIONS = [[3, 1], [3, 5], [6, 8], [1, 8]] as const
const CAPTURED_PIECES = [
  { file: 3, rank: 5, glyph: '♝' },
  { file: 6, rank: 8, glyph: '♜' },
  { file: 1, rank: 8, glyph: '♚' },
] as const
const PROCESS_STEPS = [
  { number: '01', title: 'Estratégia', description: 'Zero achismo. Jogada certa definida antes do primeiro código.' },
  { number: '02', title: 'Produto', tag: 'Dxd5', description: 'Do papel pro mercado. Rápido. Sem enrolação.' },
  { number: '03', title: 'Desenvolvimento', tag: 'Dxg8', description: 'Código que não trava. Resultado que você vê.' },
  { number: '04', title: 'Evolução', tag: 'Dxb8#', description: 'Lançar é só o começo. Sempre um passo à frente.' },
] as const

interface ChessSquare {
  name: string
  file: number
  rank: number
  color: 'lt' | 'dk'
}

interface PieceStyle extends CSSProperties {
  '--c': number
  '--r': number
}

function createSquares(): ChessSquare[] {
  return Array.from({ length: 64 }, (_, index) => {
    const rank = 8 - Math.floor(index / 8)
    const file = index % 8
    return {
      name: `${FILES[file]}${rank}`,
      file,
      rank,
      color: (file + rank) % 2 === 1 ? 'dk' : 'lt',
    }
  })
}

function getPathSquares(step: number): string[] {
  if (step >= QUEEN_POSITIONS.length - 1) return []

  const [startFile, startRank] = QUEEN_POSITIONS[step]
  const [endFile, endRank] = QUEEN_POSITIONS[step + 1]
  const fileDirection = Math.sign(endFile - startFile)
  const rankDirection = Math.sign(endRank - startRank)
  const path: string[] = []
  let file = startFile + fileDirection
  let rank = startRank + rankDirection

  while (file !== endFile || rank !== endRank) {
    path.push(`${FILES[file]}${rank}`)
    file += fileDirection
    rank += rankDirection
  }

  return path
}

function pieceStyle(file: number, rank: number): PieceStyle {
  return { '--c': file, '--r': rank }
}

export function ChessProcessSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [step, setStep] = useState(0)
  const squares = useMemo(createSquares, [])
  const pathSquares = useMemo(() => getPathSquares(step), [step])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const desktopQuery = window.matchMedia('(min-width:1001px)')
    const updateStep = () => {
      if (!desktopQuery.matches) return
      const total = section.offsetHeight - window.innerHeight
      const progress = total > 0
        ? Math.min(1, Math.max(0, -section.getBoundingClientRect().top / total))
        : 0
      setStep(Math.min(PROCESS_STEPS.length - 1, Math.floor(progress * PROCESS_STEPS.length)))
    }

    window.addEventListener('scroll', updateStep, { passive: true })
    window.addEventListener('resize', updateStep)
    desktopQuery.addEventListener('change', updateStep)
    updateStep()

    return () => {
      window.removeEventListener('scroll', updateStep)
      window.removeEventListener('resize', updateStep)
      desktopQuery.removeEventListener('change', updateStep)
    }
  }, [])

  return (
    <section className="chess-scroll" id="processo" ref={sectionRef}>
      <div className="chess-sticky">
        <div className="wrap chess-inner">
          <div className="chess-head">
            <div className="eyebrow rv" style={{ justifyContent: 'center' }}>Como jogamos</div>
            <h2 className="chess-title rv d1">Cada jogada te aproxima do <span className="g">produto certo.</span></h2>
          </div>
          <div className="chess-board-wrap">
            <div className="board" role="grid" aria-label="Tabuleiro de xadrez">
              {squares.map((square) => {
                const isTarget = step < QUEEN_POSITIONS.length - 1 && QUEEN_POSITIONS[step + 1][0] === square.file && QUEEN_POSITIONS[step + 1][1] === square.rank
                const hitPiece = step > 0 && CAPTURED_PIECES[step - 1].file === square.file && CAPTURED_PIECES[step - 1].rank === square.rank
                const className = [
                  'sq', square.color,
                  pathSquares.includes(square.name) ? 'path' : '',
                  isTarget ? 'target' : '',
                  hitPiece ? 'hit' : '',
                ].filter(Boolean).join(' ')

                return (
                  <div className={className} role="gridcell" key={square.name} aria-label={square.name} />
                )
              })}
              {[[0, 2], [1, 2], [2, 2], [5, 2], [6, 2], [7, 2]].map(([file, rank]) => <span className="pc own" style={pieceStyle(file, rank)} key={`own-${file}-${rank}`} aria-hidden="true">♟</span>)}
              <span className="pc own king" style={pieceStyle(4, 1)} title="Nosso rei, protegido" aria-hidden="true">♔</span>
              {[[0, 7], [4, 7], [7, 7]].map(([file, rank]) => <span className="pc foe" style={pieceStyle(file, rank)} key={`foe-${file}-${rank}`} aria-hidden="true">♟</span>)}
              {CAPTURED_PIECES.map((piece, index) => <span className={`pc enemy${index < step ? ' captured' : ''}`} style={pieceStyle(piece.file, piece.rank)} key={`enemy-${piece.file}-${piece.rank}`} aria-hidden="true">{piece.glyph}</span>)}
              <span className="pc queen landing" key={step} style={pieceStyle(QUEEN_POSITIONS[step][0], QUEEN_POSITIONS[step][1])} aria-hidden="true">♛</span>
            </div>
          </div>
          <div className="chess-caption" aria-live="polite">
            {PROCESS_STEPS.map((processStep, index) => (
              <article className={`chess-line${index === step ? ' is-active' : ''}`} key={processStep.number}>
                <div className="chess-line-head">
                  <span className="n">{processStep.number}</span>
                  <h3>{processStep.title}</h3>
                  {'tag' in processStep && <span className="chess-tag">{processStep.tag}</span>}
                </div>
                <p>{processStep.description}</p>
              </article>
            ))}
            <span className="chess-rule draw" key={step} aria-hidden="true" />
          </div>
          <div className="chess-track" aria-hidden="true"><span className="fill" style={{ width: `${((step + 1) / PROCESS_STEPS.length) * 100}%` }} /></div>
        </div>
      </div>
    </section>
  )
}
