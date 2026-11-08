import type { KeyboardEvent } from 'react'

import type { ScorePosition, ScoreSymbol } from '../../domain/score/score-document'
import { scoreSymbolLabel } from '../score-symbol-meta'

import {
  RANGE_STRINGS,
  arrowPath,
  positionCenterX,
  stringY,
  symbolPositionIndexes,
  wavePath,
} from './score-symbol-geometry'

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
  // 延音线整体抬高 10 个 viewBox 单位，让弧线端点在音符文字上方留出空隙；
  // 击弦/勾弦仍保持原来的高度。
  const isTie = symbol.type === 'tie'
  const baseY = isTie ? 0 : 10
  const controlY = isTie ? -12 : -24
  const path = `M ${left} ${baseY} Q ${middle} ${controlY} ${right} ${baseY}`

  return (
    <>
      <path className="score-symbol-stroke" d={path} />
      <path className="score-symbol-hit" d={path} />
    </>
  )
}

/**
 * 参数化的乐谱符号图形。
 *
 * 根据符号类型、扫弦范围和音符列坐标动态生成路径，
 * 同时渲染透明加粗的命中区，保证可点击和可聚焦。
 *
 * @param props.symbol 当前符号。
 * @param props.positions 当前小节的位置列表。
 * @param props.onSymbolClick 符号点击回调，传入后图形才可交互。
 */
export function ScoreSymbolGlyph({
  symbol,
  positions,
  onSymbolClick,
}: {
  symbol: ScoreSymbol
  positions: ScorePosition[]
  onSymbolClick?: (symbol: ScoreSymbol) => void
}) {
  const indexes = symbolPositionIndexes(symbol, positions)
  if (indexes.length === 0) return null

  const isRangeSymbol = symbol.type === 'arpeggio' || symbol.type === 'sweep'
  if (!isRangeSymbol && indexes.length < 2) return null

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
