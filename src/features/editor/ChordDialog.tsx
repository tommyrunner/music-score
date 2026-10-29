import { useState, type FormEvent } from 'react'

import { DialogShell } from '../../components/DialogShell'
import { ChordDiagram } from '../../components/icons'
import { findChordShape } from '../../domain/score/chord-shapes'

const commonChords = [
  'C', 'D', 'E', 'F', 'G', 'A', 'B',
  'Cm', 'Dm', 'Em', 'Fm', 'Gm', 'Am', 'Bm',
  'C7', 'D7', 'E7', 'G7', 'A7', 'B7',
]

interface ChordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (chord: string) => void
}

/**
 * 和弦选择弹框。
 *
 * 每个常用和弦同时展示名称与指法样图，自定义和弦输入时也会实时预览。
 *
 * @param props 弹框开关、开关状态回调和和弦选择回调。
 */
export function ChordDialog({ open, onOpenChange, onChoose }: ChordDialogProps) {
  const [customChord, setCustomChord] = useState('')

  const trimmedCustomChord = customChord.trim()
  const customShape = findChordShape(trimmedCustomChord)

  const choose = (chord: string) => {
    onChoose(chord)
    setCustomChord('')
    onOpenChange(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (trimmedCustomChord) choose(trimmedCustomChord)
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="添加和弦"
      description="选择常用和弦查看指法样图，也可以直接填写名称。"
    >
      <div className="chord-picker">
        {commonChords.map((chord) => (
          <button
            key={chord}
            type="button"
            onClick={() => choose(chord)}
            aria-label={`${chord} 和弦`}
          >
            <strong>{chord}</strong>
            <ChordDiagram chord={chord} />
          </button>
        ))}
      </div>
      <form className="dialog-form chord-custom" onSubmit={submit}>
        <label htmlFor="custom-chord">自定义和弦</label>
        <div>
          <input
            id="custom-chord"
            value={customChord}
            onChange={(event) => setCustomChord(event.target.value)}
            maxLength={16}
          />
          <button type="submit" className="text-button" disabled={!trimmedCustomChord}>确定</button>
        </div>

        {trimmedCustomChord && (
          <div className="chord-custom-preview" aria-live="polite">
            {customShape ? (
              <>
                <ChordDiagram chord={trimmedCustomChord} />
                <small>「{trimmedCustomChord}」会显示对应的指法样图</small>
              </>
            ) : (
              <small>暂无「{trimmedCustomChord}」的指法样图，谱面将只显示和弦名。</small>
            )}
          </div>
        )}

        <button type="button" className="clear-chord" onClick={() => choose('')}>清除当前和弦</button>
      </form>
    </DialogShell>
  )
}
