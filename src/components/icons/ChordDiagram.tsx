import type { ChordShape } from '../../domain/score/chord-shapes'
import { chordBaseFret, findChordShape } from '../../domain/score/chord-shapes'

const STRING_COUNT = 6
const FRET_COUNT = 5
const STRING_LEFT = 13
const STRING_GAP = 8.6
const FRET_TOP = 18
const FRET_GAP = 10.4
const DOT_RADIUS = 3.2
const MARKER_Y = 8

const stringX = (index: number) => STRING_LEFT + index * STRING_GAP
const fretY = (relativeFret: number) => FRET_TOP + (relativeFret - 0.5) * FRET_GAP

function barreRange(shape: ChordShape, barreIndex: number) {
  const barre = shape.barres?.[barreIndex]
  if (!barre) return null

  return {
    fret: barre.fret,
    from: Math.min(barre.from, barre.to),
    to: Math.max(barre.from, barre.to),
  }
}

/**
 * 参数化的吉他六弦指法图。
 *
 * 只绘制弦线、品线、按弦点、横按和空弦/闷音标记，保持简洁清晰。
 * 需要横按的和弦会自动换算起始品位并标出品位数。
 *
 * @param props.chord 和弦名称。
 * @param props.className 额外的样式类名。
 */
export function ChordDiagram({ chord, className }: { chord: string; className?: string }) {
  const shape = findChordShape(chord)
  if (!shape) return null

  const baseFret = chordBaseFret(shape)
  const nut = baseFret === 1
  const classes = ['chord-diagram', className].filter(Boolean).join(' ')

  return (
    <svg
      className={classes}
      viewBox="0 0 64 80"
      role="img"
      aria-label={`${chord.trim()} 和弦指法图${nut ? '' : `，从第 ${baseFret} 品开始`}`}
      focusable="false"
    >
      <g className="chord-diagram-grid">
        {Array.from({ length: STRING_COUNT }, (_, index) => (
          <line
            key={`string-${index}`}
            x1={stringX(index)}
            x2={stringX(index)}
            y1={FRET_TOP}
            y2={FRET_TOP + FRET_COUNT * FRET_GAP}
          />
        ))}
        {Array.from({ length: FRET_COUNT + 1 }, (_, index) => (
          <line
            className={index === 0 && nut ? 'chord-diagram-nut' : undefined}
            key={`fret-${index}`}
            x1={stringX(0)}
            x2={stringX(STRING_COUNT - 1)}
            y1={FRET_TOP + index * FRET_GAP}
            y2={FRET_TOP + index * FRET_GAP}
          />
        ))}
      </g>

      {baseFret > 1 && (
        <text
          className="chord-diagram-fret"
          x={5.5}
          y={FRET_TOP + FRET_GAP * 0.62}
          textAnchor="middle"
        >
          {baseFret}
        </text>
      )}

      {shape.frets.map((fret, index) => {
        if (fret === 0) {
          return (
            <circle
              className="chord-diagram-open"
              key={`open-${index}`}
              cx={stringX(index)}
              cy={MARKER_Y}
              r={2.3}
            />
          )
        }

        if (fret < 0) {
          const x = stringX(index)
          return (
            <path
              className="chord-diagram-muted"
              key={`muted-${index}`}
              d={`M ${x - 2.4} ${MARKER_Y - 2.4} L ${x + 2.4} ${MARKER_Y + 2.4} M ${x + 2.4} ${MARKER_Y - 2.4} L ${x - 2.4} ${MARKER_Y + 2.4}`}
            />
          )
        }

        return null
      })}

      {Array.from({ length: shape.barres?.length ?? 0 }, (_, index) => {
        const barre = barreRange(shape, index)
        if (!barre) return null

        const relativeFret = barre.fret - baseFret + 1
        const left = stringX(barre.from) - DOT_RADIUS
        const right = stringX(barre.to) + DOT_RADIUS
        const y = fretY(relativeFret) - DOT_RADIUS

        return (
          <rect
            className="chord-diagram-dot"
            height={DOT_RADIUS * 2}
            key={`barre-${index}`}
            rx={DOT_RADIUS}
            width={right - left}
            x={left}
            y={y}
          />
        )
      })}

      {shape.frets.map((fret, index) => {
        if (fret <= 0) return null

        const coveredByBarre = shape.barres?.some((barre) => {
          const from = Math.min(barre.from, barre.to)
          const to = Math.max(barre.from, barre.to)
          return barre.fret === fret && index >= from && index <= to
        })
        if (coveredByBarre) return null

        const relativeFret = fret - baseFret + 1
        return (
          <circle
            className="chord-diagram-dot"
            cx={stringX(index)}
            cy={fretY(relativeFret)}
            key={`dot-${index}`}
            r={DOT_RADIUS}
          />
        )
      })}
    </svg>
  )
}
