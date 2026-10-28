import { useState, type FormEvent } from 'react'

import { DialogShell } from '../../components/DialogShell'

const commonChords = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Am', 'Bm', 'Dm', 'Em', 'G7']

interface ChordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (chord: string) => void
}

/**
 * 和弦选择弹框。
 *
 * @param props 弹框开关、开关状态回调和和弦选择回调。
 */
export function ChordDialog({ open, onOpenChange, onChoose }: ChordDialogProps) {
  const [customChord, setCustomChord] = useState('')

  const choose = (chord: string) => {
    onChoose(chord)
    setCustomChord('')
    onOpenChange(false)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (customChord.trim()) choose(customChord.trim())
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="添加和弦"
      description="选择一个常用和弦，也可以直接填写名称。"
    >
      <div className="chord-picker">
        {commonChords.map((chord) => (
          <button key={chord} onClick={() => choose(chord)} aria-label={`${chord} 和弦`}>
            {chord}
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
          <button type="submit" className="text-button" disabled={!customChord.trim()}>确定</button>
        </div>
        <button type="button" className="clear-chord" onClick={() => choose('')}>清除当前和弦</button>
      </form>
    </DialogShell>
  )
}
