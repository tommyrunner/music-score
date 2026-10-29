/** 六线谱默认高度。 */
const DEFAULT_HEIGHT = 168
/** 六线谱默认弦数。 */
const DEFAULT_LINE_COUNT = 6
/** 第一根弦的默认纵坐标。 */
const DEFAULT_TOP = 14
/** 弦间距。 */
const DEFAULT_SPACING = 28

interface StaffLinesProps {
  /** 谱面宽度，由小节列数计算得出。 */
  width: number
  /** SVG 高度。 */
  height?: number
  /** 弦线数量。 */
  lineCount?: number
  /** 第一根弦的纵坐标。 */
  top?: number
  /** 弦间距。 */
  spacing?: number
  /** 是否绘制左右小节边线。 */
  edgeLines?: boolean
}

/**
 * 参数化的六线谱谱线。
 *
 * @param props 谱面宽度以及可选的弦数、间距等参数。
 */
export function StaffLines({
  width,
  height = DEFAULT_HEIGHT,
  lineCount = DEFAULT_LINE_COUNT,
  top = DEFAULT_TOP,
  spacing = DEFAULT_SPACING,
  edgeLines = true,
}: StaffLinesProps) {
  const lastLineY = top + (lineCount - 1) * spacing

  return (
    <svg
      className="staff-lines"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {Array.from({ length: lineCount }, (_, index) => {
        const y = top + index * spacing
        return <line key={y} x1="0" x2={width} y1={y} y2={y} />
      })}
      {edgeLines && (
        <>
          <line className="edge-line" x1="0" x2="0" y1={top} y2={lastLineY} />
          <line className="edge-line" x1={width} x2={width} y1={top} y2={lastLineY} />
        </>
      )}
    </svg>
  )
}
