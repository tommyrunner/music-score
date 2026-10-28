import type { KeyboardEvent } from 'react'

import type {
  ScorePosition,
  ScoreSymbol,
  StringRange,
} from '../domain/score/score-document'
import { scoreSymbolLabel } from './score-symbol-meta'

const STAFF_HEIGHT = 168
const STRING_Y = [14, 42, 70, 98, 126, 154] as const
const RANGE_STRINGS: Record<StringRange, readonly [number, number]> = {
  upper: [1, 3],
  lower: [4, 6],
  all: [1, 6],
}

function stringY(stringNumber: number) {
  return STRING_Y[Math.min(6, Math.max(1, stringNumber)) - 1]
}

function positionCenterX(positionIndex: number) {
  return (positionIndex + 0.5) * 100
}

function wavePath(x: number, top: number, bottom: number) {
  const amplitude = 5
  const step = 8
  let cursor = top
  let direction = -1
  let path = `M ${x} ${top}`

  while (cursor < bottom) {
    const next = Math.min(cursor + step, bottom)
    path += ` Q ${x + direction * amplitude} ${(cursor + next) / 2} ${x} ${next}`
    cursor = next
    direction *= -1
  }

  return path
}

function arrowPath(x: number, top: number) {
  return `M ${x - 5} ${top - 3} L ${x} ${top - 9} L ${x + 5} ${top - 3}`
}

function RangeGlyph({ symbol, x }: { symbol: ScoreSymbol; x: number }) {
  const [firstString, lastString] = RANGE_STRINGS[symbol.range ?? 'all']
  const top = stringY(firstString)
  const bottom = stringY(lastString)
  const strokePath = symbol.type === 'arpeggio'
    ? wavePath(x, top, bottom)
    : `M ${x} ${top} L ${x} ${bottom}`
  const arrow = arrowPath(x, top)

  return (
    <>
      <path className="score-symbol-stroke" d={strokePath} />
      <path className="score-symbol-stroke" d={arrow} />
      <path className="score-symbol-hit" d={strokePath} />
      <path className="score-symbol-hit" d={arrow} />
    </>
  )
}

function ConnectionGlyph({
  symbol,
  startX,
  endX,
}: {
  symbol: ScoreSymbol
  startX: number
  endX: number
}) {
  const left = Math.min(startX, endX)
  const right = Math.max(startX, endX)
  const middle = (left + right) / 2
  const controlY = symbol.type === 'tie' ? -6 : -24
  const path = `M ${left} 10 Q ${middle} ${controlY} ${right} 10`

  return (
    <>
      <path className="score-symbol-stroke" d={path} />
      <path className="score-symbol-hit" d={path} />
    </>
  )
}

function ScoreSymbolGlyph({
  symbol,
  positions,
  onSymbolClick,
}: {
  symbol: ScoreSymbol
  positions: ScorePosition[]
  onSymbolClick?: (symbol: ScoreSymbol) => void
}) {
  const indexes = symbol.points.map((point) =>
    positions.findIndex((position) => position.id === point.positionId),
  )
  if (indexes.some((index) => index < 0)) return null

  const isRangeSymbol = symbol.type === 'arpeggio' || symbol.type === 'sweep'
  const interactive = typeof onSymbolClick === 'function'
  const label = scoreSymbolLabel(symbol, positions)
  const handleKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSymbolClick?.(symbol)
  }

  return (
    <g
      className="score-symbol-group"
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? label : undefined}
      onClick={interactive ? () => onSymbolClick(symbol) : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      {isRangeSymbol ? (
        <RangeGlyph symbol={symbol} x={positionCenterX(indexes[0])} />
      ) : (
        <ConnectionGlyph
          symbol={symbol}
          startX={positionCenterX(indexes[0])}
          endX={positionCenterX(indexes[1])}
        />
      )}
    </g>
  )
}

interface ScoreSymbolLayerProps {
  symbols: ScoreSymbol[]
  positions: ScorePosition[]
  onSymbolClick?: (symbol: ScoreSymbol) => void
}

export function ScoreSymbolLayer({
  symbols,
  positions,
  onSymbolClick,
}: ScoreSymbolLayerProps) {
  if (symbols.length === 0) return null

  const staffWidth = positions.length * 100
  const labelSymbols = symbols.flatMap((symbol) => {
    if (symbol.type !== 'hammer-on' && symbol.type !== 'pull-off') return []

    const indexes = symbol.points.map((point) =>
      positions.findIndex((position) => position.id === point.positionId),
    )
    if (indexes.some((index) => index < 0)) return []

    const middle = (positionCenterX(indexes[0]) + positionCenterX(indexes[1])) / 2
    return [{
      id: symbol.id,
      text: symbol.type === 'hammer-on' ? 'H' : 'P',
      left: `${(middle / staffWidth) * 100}%`,
    }]
  })

  return (
    <div
      className="score-symbol-layer"
      aria-hidden={onSymbolClick ? undefined : true}
    >
      <svg
        viewBox={`0 0 ${staffWidth} ${STAFF_HEIGHT}`}
        preserveAspectRatio="none"
        focusable="false"
      >
        {symbols.map((symbol) => (
          <ScoreSymbolGlyph
            key={symbol.id}
            symbol={symbol}
            positions={positions}
            onSymbolClick={onSymbolClick}
          />
        ))}
      </svg>
      {labelSymbols.map((symbol) => (
        <span
          key={symbol.id}
          className="score-symbol-label"
          style={{ left: symbol.left }}
          aria-hidden="true"
        >
          {symbol.text}
        </span>
      ))}
    </div>
  )
}