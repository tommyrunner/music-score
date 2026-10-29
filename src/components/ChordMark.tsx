import { findChordShape } from '../domain/score/chord-shapes'
import type { ChordDisplayMode } from '../domain/score/score-document'

import { ChordDiagram } from './icons'

interface ChordMarkProps {
  chord: string
  mode: ChordDisplayMode
}

/**
 * 按页面配置渲染和弦名称与指法样图。
 *
 * 未收录指法的自定义和弦在“仅样图”模式下自动回退为和弦名称，
 * 避免谱面上出现空白。
 *
 * @param props.chord 和弦名称。
 * @param props.mode 和弦显示方式。
 */
export function ChordMark({ chord, mode }: ChordMarkProps) {
  const hasShape = findChordShape(chord) !== null
  const showName = mode !== 'diagram' || !hasShape
  const showDiagram = mode !== 'letter' && hasShape

  return (
    <span className={`chord-mark is-${mode}`}>
      {showName && <span className="chord-mark-name">{chord.trim()}</span>}
      {showDiagram && <ChordDiagram chord={chord} className="chord-mark-diagram" />}
    </span>
  )
}
