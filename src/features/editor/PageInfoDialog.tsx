import { useEffect, useRef, useState, type FormEvent } from 'react'

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

interface PlaybackFields {
  hours: string
  minutes: string
  seconds: string
}

function splitPlaybackSeconds(totalSeconds: number): PlaybackFields {
  const safeSeconds = Math.max(Math.round(totalSeconds), 1)
  return {
    hours: String(Math.floor(safeSeconds / 3600)),
    minutes: String(Math.floor((safeSeconds % 3600) / 60)),
    seconds: String(safeSeconds % 60),
  }
}

function playbackFieldsToSeconds(fields: PlaybackFields) {
  const hours = Math.min(Math.max(Number(fields.hours) || 0, 0), 23)
  const minutes = Math.min(Math.max(Number(fields.minutes) || 0, 0), 59)
  const seconds = Math.min(Math.max(Number(fields.seconds) || 0, 0), 59)
  return Math.max(Math.floor(hours * 3600 + minutes * 60 + seconds), 1)
}

function formatPlaybackDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours} 时 ${minutes} 分 ${seconds} 秒`
  if (minutes > 0) return `${minutes} 分 ${seconds} 秒`
  return `${seconds} 秒`
}

interface PageInfoDialogProps {
  page: ScoreBookPage
  /** 谱本中的全部页面，用于按页配置自动播放时长。 */
  pages: ScoreBookPage[]
  onClose: () => void
}

/**
 * 编辑当前页面信息与每页自动播放默认时长的弹框。
 *
 * @param props 当前页面、谱本页面列表与关闭回调。
 */
export function PageInfoDialog({ page, pages, onClose }: PageInfoDialogProps) {
  const updatePageInfo = useScoreStore((state) => state.updatePageInfo)
  const updatePagePlaybackSeconds = useScoreStore((state) => state.updatePagePlaybackSeconds)
  const [title, setTitle] = useState(page.title)
  const [subtitle, setSubtitle] = useState(page.type === 'score' ? page.subtitle : '')
  const [footerLeft, setFooterLeft] = useState(page.type === 'score' ? page.footerLeft : '')
  const [footerRight, setFooterRight] = useState(page.type === 'score' ? page.footerRight : '')
  const [chordDisplay, setChordDisplay] = useState<ChordDisplayMode>(
    page.type === 'score' ? page.chordDisplay : DEFAULT_CHORD_DISPLAY,
  )
  const [playbackFieldsByPage, setPlaybackFieldsByPage] = useState<Record<string, PlaybackFields>>(
    () => Object.fromEntries(
      pages.map((item) => [item.id, splitPlaybackSeconds(item.playbackSeconds)]),
    ),
  )
  const [playbackPageIndex, setPlaybackPageIndex] = useState(() => {
    const index = pages.findIndex((item) => item.id === page.id)
    return index >= 0 ? index : 0
  })
  const playbackTabsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = playbackTabsRef.current
    const activeTab = container?.querySelector<HTMLButtonElement>('button[aria-selected="true"]')
    activeTab?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [playbackPageIndex])

  const playbackPage = pages[playbackPageIndex] ?? page
  const playbackFields = playbackFieldsByPage[playbackPage.id]
    ?? splitPlaybackSeconds(playbackPage.playbackSeconds)
  const playbackPageSeconds = playbackFieldsToSeconds(playbackFields)

  const trimmedTitle = title.trim()
  const playbackUpdates = pages.flatMap((item) => {
    const fields = playbackFieldsByPage[item.id]
    if (!fields) return []
    const seconds = playbackFieldsToSeconds(fields)
    return seconds === item.playbackSeconds ? [] : [{ pageId: item.id, seconds }]
  })
  const pageUnchanged = page.type === 'score'
    ? trimmedTitle === page.title
      && subtitle.trim() === page.subtitle
      && footerLeft.trim() === page.footerLeft
      && footerRight.trim() === page.footerRight
      && chordDisplay === page.chordDisplay
    : trimmedTitle === page.title
  const unchanged = pageUnchanged && playbackUpdates.length === 0

  const updatePlaybackField = (field: keyof PlaybackFields, value: string) => {
    const limit = field === 'hours' ? 23 : 59
    const digits = value.replace(/\D/g, '')
    setPlaybackFieldsByPage((current) => ({
      ...current,
      [playbackPage.id]: {
        ...(current[playbackPage.id] ?? splitPlaybackSeconds(playbackPage.playbackSeconds)),
        [field]: digits === '' ? '' : String(Math.min(Number(digits), limit)),
      },
    }))
  }

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

    if (playbackUpdates.length > 0) updatePagePlaybackSeconds(playbackUpdates)
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
        ? '修改页面标题、副标题、页脚、和弦显示与自动播放时长；目录与导出文件会同步使用新名称。'
        : '修改页面标题与自动播放时长；目录与导出文件会同步使用新名称。'}
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

        <fieldset className="playback-duration-picker">
          <legend>自动播放默认值</legend>
          <p className="playback-duration-hint">
            按页设置「页播放」的停留时长，播放时会按每页配置自动填入。
          </p>

          <div className="playback-config-card">
            <div className="playback-page-tabs" role="tablist" aria-label="选择页码" ref={playbackTabsRef}>
              {pages.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={index === playbackPageIndex}
                  className={index === playbackPageIndex ? 'is-selected' : ''}
                  title={item.title}
                  onClick={() => setPlaybackPageIndex(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>

            <div className="playback-page-current">
              <strong>第 {playbackPageIndex + 1} 页</strong>
              <span>{playbackPage.title}</span>
            </div>

            <div className="playback-duration-fields">
              <label htmlFor="page-playback-hours">
                时
                <input
                  id="page-playback-hours"
                  type="number"
                  min={0}
                  max={23}
                  inputMode="numeric"
                  value={playbackFields.hours}
                  onChange={(event) => updatePlaybackField('hours', event.target.value)}
                />
              </label>
              <label htmlFor="page-playback-minutes">
                分
                <input
                  id="page-playback-minutes"
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={playbackFields.minutes}
                  onChange={(event) => updatePlaybackField('minutes', event.target.value)}
                />
              </label>
              <label htmlFor="page-playback-seconds">
                秒
                <input
                  id="page-playback-seconds"
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={playbackFields.seconds}
                  onChange={(event) => updatePlaybackField('seconds', event.target.value)}
                />
              </label>
            </div>
          </div>

          <p className="playback-duration-hint">
            该页停留 {formatPlaybackDuration(playbackPageSeconds)}（最少 1 秒）。
          </p>
        </fieldset>
      </form>
    </DialogShell>
  )
}