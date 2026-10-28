import { useState, type FormEvent } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import { DialogShell } from '../../components/DialogShell'
import {
  PAGE_FOOTER_LEFT_MAX_LENGTH,
  PAGE_FOOTER_RIGHT_MAX_LENGTH,
  SCORE_SUBTITLE_MAX_LENGTH,
  type ScoreBookPage,
} from '../../domain/score/score-document'

interface PageInfoDialogProps {
  page: ScoreBookPage
  onClose: () => void
}

/**
 * 编辑当前页面标题、副标题和页脚的弹框。
 *
 * @param props 当前页面与关闭回调。
 */
export function PageInfoDialog({ page, onClose }: PageInfoDialogProps) {
  const updatePageInfo = useScoreStore((state) => state.updatePageInfo)
  const [title, setTitle] = useState(page.title)
  const [subtitle, setSubtitle] = useState(page.type === 'score' ? page.subtitle : '')
  const [footerLeft, setFooterLeft] = useState(page.type === 'score' ? page.footerLeft : '')
  const [footerRight, setFooterRight] = useState(page.type === 'score' ? page.footerRight : '')

  const trimmedTitle = title.trim()
  const unchanged = page.type === 'score'
    ? trimmedTitle === page.title
      && subtitle.trim() === page.subtitle
      && footerLeft.trim() === page.footerLeft
      && footerRight.trim() === page.footerRight
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
        ? '修改页面标题、副标题和页脚；目录与导出文件会同步使用新名称。'
        : '修改页面标题；目录与导出文件会同步使用新名称。'}
    >
      <form className="dialog-form" onSubmit={submit}>
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
          </>
        )}

        <button
          className="primary-button"
          type="submit"
          disabled={!trimmedTitle || unchanged}
        >
          保存修改
        </button>
      </form>
    </DialogShell>
  )
}