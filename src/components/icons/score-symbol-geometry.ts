import type {
  ScorePosition,
  ScoreSymbol,
  StringRange,
} from '../../domain/score/score-document'

/** 六线谱 SVG 的固定高度。 */
export const STAFF_HEIGHT = 168

/** 六根弦在 SVG 中的纵坐标。 */
export const STRING_Y = [14, 42, 70, 98, 126, 154] as const

/** 扫弦/琶音范围对应的起止弦。 */
export const RANGE_STRINGS: Record<StringRange, readonly [number, number]> = {
  upper: [1, 3],
  lower: [4, 6],
  all: [1, 6],
}

/**
 * 把弦号换算为 SVG 纵坐标。
 *
 * @param stringNumber 1 到 6 的弦号。
 */
export function stringY(stringNumber: number) {
  return STRING_Y[Math.min(6, Math.max(1, stringNumber)) - 1]
}

/**
 * 计算音符列的横向中心坐标。
 *
 * @param positionIndex 音符列索引。
 */
export function positionCenterX(positionIndex: number) {
  return (positionIndex + 0.5) * 100
}

/**
 * 生成琶音用的波浪线路径。
 *
 * @param x 波浪线横向中心。
 * @param top 起始纵坐标。
 * @param bottom 结束纵坐标。
 */
export function wavePath(x: number, top: number, bottom: number) {
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

/**
 * 生成扫弦/琶音顶部的箭头路径。
 *
 * @param x 箭头横向中心。
 * @param top 起始纵坐标。
 */
export function arrowPath(x: number, top: number) {
  return `M ${x - 5} ${top - 3} L ${x} ${top - 9} L ${x + 5} ${top - 3}`
}

/**
 * 把符号的列 ID 换算为当前小节内的列索引。
 *
 * 任意一个列不在当前小节时返回空数组。
 *
 * @param symbol 乐谱符号。
 * @param positions 当前小节的位置列表。
 */
export function symbolPositionIndexes(
  symbol: ScoreSymbol,
  positions: ScorePosition[],
) {
  const indexes = symbol.points.map((point) =>
    positions.findIndex((position) => position.id === point.positionId),
  )
  return indexes.some((index) => index < 0) ? [] : indexes
}
