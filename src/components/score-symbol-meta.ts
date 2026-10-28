import type {
  ScorePosition,
  ScoreSymbol,
  ScoreSymbolType,
  StringRange,
} from '../domain/score/score-document'

export const STRING_RANGE_LABELS: Record<StringRange, string> = {
  upper: '上弦',
  lower: '下弦',
  all: '全弦',
}

export const SCORE_SYMBOL_LABELS: Record<ScoreSymbolType, string> = {
  arpeggio: '琶音',
  sweep: '扫弦',
  tie: '延音线',
  'hammer-on': '击弦 H',
  'pull-off': '勾弦 P',
}

export function scoreSymbolLabel(
  symbol: ScoreSymbol,
  positions: ScorePosition[],
): string {
  const typeLabel = SCORE_SYMBOL_LABELS[symbol.type]
  if (symbol.range) return `${typeLabel} ${STRING_RANGE_LABELS[symbol.range]}`

  const indexes = symbol.points
    .map((point) => positions.findIndex((position) => position.id === point.positionId))
    .filter((index) => index >= 0)
  if (indexes.length < 2) return typeLabel

  const first = Math.min(...indexes) + 1
  const last = Math.max(...indexes) + 1
  return `${typeLabel}，第 ${first} 列至第 ${last} 列`
}