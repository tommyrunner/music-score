import type { ScoreSymbolType } from '../../domain/score/score-document'

/**
 * 符号面板中的单个符号小样。
 *
 * @param props.type 乐谱符号类型。
 */
export function SymbolSwatch({ type }: { type: ScoreSymbolType }) {
  const isConnection = type === 'tie' || type === 'hammer-on' || type === 'pull-off'
  const letter = type === 'hammer-on' ? 'H' : type === 'pull-off' ? 'P' : null

  return (
    <svg className="symbol-swatch" viewBox="0 0 20 44" aria-hidden="true">
      {isConnection ? (
        <>
          <path className="symbol-swatch-line" d="M 2 16 Q 10 2 18 16" />
          {letter && (
            <text className="symbol-swatch-label" x="10" y="12" textAnchor="middle">
              {letter}
            </text>
          )}
        </>
      ) : (
        <>
          <path className="symbol-swatch-arrow" d="M 6 7 L 10 2 L 14 7" />
          {type === 'arpeggio' ? (
            <path
              className="symbol-swatch-line"
              d="M 10 10 Q 5 15 10 20 T 10 30 T 10 40"
            />
          ) : (
            <path className="symbol-swatch-line" d="M 10 10 L 10 40" />
          )}
        </>
      )}
    </svg>
  )
}

/**
 * 单节多音的小样图标。
 */
export function MultiNoteSwatch() {
  return (
    <svg className="symbol-swatch" viewBox="0 0 20 44" aria-hidden="true">
      <path className="symbol-swatch-line" d="M 9 4 L 9 40" />
      {[10, 22, 34].map((y) => (
        <circle key={y} cx="14" cy={y} r="2.2" fill="currentColor" />
      ))}
    </svg>
  )
}
