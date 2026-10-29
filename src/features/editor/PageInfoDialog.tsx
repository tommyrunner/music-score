import { useState, type FormEvent } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import { DialogShell } from '../../components/DialogShell'
import {
  DEFAULT_CHORD_DISPLAY,
  PAGE_FOOTER_LEFT_MAX_LENGTH,
  PAGE_FOOTER_RIGHT_MAX_LENGTH,
  SCORE_SUBTITLE_MAX_LENGTH,
  type ChordDisplayMode,
  type ScoreBookPage,
} from '../../domain/score/score-document'

const CHORD_DISPLAY_OPTIONS: Array<{
  value: ChordDisplayMode
  label: string
  description: string
}> = [
  { value: 'both', label: '字母 + 样图', description: '和弦名与指法图' },
  { value: 'diagram', label: '单独样图', description: '只显示指法图' },
  { value: 'letter', label: '单独字母', description: '只显示和弦名' },
]

interface PageInfoDialogProps {
  page: ScoreBookPage
  onClose: () => void
}

/**
 * 编辑当前页面标题、副标题、页脚与和弦显示方式的弹框。
 *
 * @param props 当前页面与关闭回调。
 */
export function PageInfoDialog({ page, onClose }: PageInfoDialogProps) {
  const updatePageInfo = useScoreStore((state) => state.updatePageInfo)
  const [title, setTitle] = useState(page.title)
  const [subtitle, setSubtitle] = useState(page.type === 'score' ? page.subtitle : '')
  const [footerLeft, setFooterLeft] = useState(page.type === 'score' ? page.footerLeft : '')
  const [footerRight, setFooterRight] = useState(page.type === 'score' ? page.footerRight : '')
  const [chordDisplay, setChordDisplay] = useState<ChordDisplayMode>(
    page.type === 'score' ? page.chordDisplay : DEFAULT_CHORD_DISPLAY,
  )

  const trimmedTitle = title.trim()
  const unchanged = page.type === 'score'
    ? trimmedTitle === page.title
      && subtitle.trim() === page.subtitle
      && footerLeft.trim() === page.footerLeft
      && footerRight.trim() === page.footerRight
      && chordDisplay === page.chordDisplay
    : trimmedTitle === page.title

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!trimmedTitle || unchanged) return

    if (page.type === 'score') {
      updatePageInfo(page.id, {
        title: trimmedTitle,
        subtitle,
        footerLeft,
        footerRight,
        chordDisplay,
      })
    } else {
      updatePageInfo(page.id, { title: trimmedTitle })
    }
    onClose()
  }

  return (
    <DialogShell
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="编辑页面信息"
      description={page.type === 'score'
        ? '修改页面标题、副标题、页脚与和弦显示方式；目录与导出文件会同步使用新名称。'
        : '修改页面标题；目录与导出文件会同步使用新名称。'}
      footer={(
        <button
          className="primary-button page-info-save"
          type="submit"
          form="page-info-form"
          disabled={!trimmedTitle || unchanged}
        >
          保存修改
        </button>
      )}
    >
      <form id="page-info-form" className="dialog-form" onSubmit={submit}>
        <label htmlFor="page-info-title">页面名称</label>
        <input
          id="page-info-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={80}
          autoFocus
        />

        {page.type === 'score' && (
          <>
            <label htmlFor="page-info-subtitle">
              副标题
              <small className="field-counter">
                {subtitle.length}/{SCORE_SUBTITLE_MAX_LENGTH}
              </small>
            </label>
            <textarea
              id="page-info-subtitle"
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              maxLength={SCORE_SUBTITLE_MAX_LENGTH}
              rows={2}
            />

            <label htmlFor="page-info-footer-left">
              左下角
              <small className="field-counter">
                {footerLeft.length}/{PAGE_FOOTER_LEFT_MAX_LENGTH}
              </small>
            </label>
            <input
              id="page-info-footer-left"
              value={footerLeft}
              onChange={(event) => setFooterLeft(event.target.value)}
              maxLength={PAGE_FOOTER_LEFT_MAX_LENGTH}
            />

            <label htmlFor="page-info-footer-right">
              右下角
              <small className="field-counter">
                {footerRight.length}/{PAGE_FOOTER_RIGHT_MAX_LENGTH}
              </small>
            </label>
            <input
              id="page-info-footer-right"
              value={footerRight}
              onChange={(event) => setFooterRight(event.target.value)}
              maxLength={PAGE_FOOTER_RIGHT_MAX_LENGTH}
            />

            <fieldset className="chord-display-picker">
              <legend>和弦显示</legend>
              {CHORD_DISPLAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={chordDisplay === option.value ? 'is-selected' : ''}
                  aria-pressed={chordDisplay === option.value}
                  onClick={() => setChordDisplay(option.value)}
                >
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </button>
              ))}
            </fieldset>
          </>
        )}
      </form>
    </DialogShell>
  )
}