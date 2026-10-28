import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ProgressOverlayProps {
  label: string
  value: number
  detail?: string
}

/**
 * 不可关闭的操作进度浮层。
 *
 * 用于导入、导出等无法中途取消的操作，展示当前步骤和百分比。
 *
 * @param props 操作名称、进度值和补充说明。
 */
export function ProgressOverlay({ label, value, detail }: ProgressOverlayProps) {
  const percent = Math.max(0, Math.min(100, Math.round(value)))

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return createPortal(
    <div
      className="progress-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={label}
    >
      <div className="progress-card">
        <span className="progress-kicker">弦间 · 请稍候</span>
        <strong>{label}</strong>
        <div
          className="progress-track"
          role="progressbar"
          aria-label={`${label}进度`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="progress-meta">
          <span>{percent}%</span>
          <small>{detail ?? '完成前请不要关闭窗口'}</small>
        </div>
      </div>
    </div>,
    document.body,
  )
}