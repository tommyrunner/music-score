import type {
  ScorePosition,
  ScoreSymbol,
} from '../domain/score/score-document'

import { ScoreSymbolGlyph } from './icons/ScoreSymbolGlyph'
import {
  STAFF_HEIGHT,
  positionCenterX,
  symbolPositionIndexes,
} from './icons/score-symbol-geometry'

interface ScoreSymbolLayerProps {
  symbols: ScoreSymbol[]
  positions: ScorePosition[]
  onSymbolClick?: (symbol: ScoreSymbol) => void
}

/**
 * 在谱面上渲染各类乐谱符号。
 *
 * @param props 当前小节的符号、音符位置以及符号点击回调。
 */
export function ScoreSymbolLayer({
  symbols,
  positions,
  onSymbolClick,
}: ScoreSymbolLayerProps) {
  if (symbols.length === 0) return null

  const staffWidth = positions.length * 100
  const labelSymbols = symbols.flatMap((symbol) => {
    if (symbol.type !== 'hammer-on' && symbol.type !== 'pull-off') return []

    const indexes = symbolPositionIndexes(symbol, positions)
    if (indexes.length < 2) return []

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