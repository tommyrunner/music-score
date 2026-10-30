import * as Dialog from '@radix-ui/react-dialog'
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { PaperPage } from '../../components/PaperPage'
import {
  CornersIn,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  X,
} from '../../components/icons'
import {
  PAPER_MIN_HEIGHT,
  PAPER_WIDTH,
  readPixelValue,
} from '../../components/paper-layout'
import type { ScoreBook } from '../../domain/score/score-document'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

function PreviewPageStage({
  children,
  zoom,
}: {
  children: ReactNode
  zoom: number
}) {
  const paperRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState({ fitScale: 1, paperHeight: PAPER_MIN_HEIGHT })

  useLayoutEffect(() => {
    const paper = paperRef.current
    const canvas = paper?.closest<HTMLDivElement>('.preview-canvas')
    if (!canvas || !paper) return

    const measure = () => {
      const styles = window.getComputedStyle(canvas)
      const availableWidth = canvas.clientWidth
        - readPixelValue(styles.paddingLeft)
        - readPixelValue(styles.paddingRight)
      const availableHeight = canvas.clientHeight
        - readPixelValue(styles.paddingTop)
        - readPixelValue(styles.paddingBottom)
      const paperHeight = Math.max(PAPER_MIN_HEIGHT, paper.scrollHeight)

      if (availableWidth <= 0 || availableHeight <= 0) return

      // 初始缩放不超过 1，保证纸张在小屏幕上完整可见。
      const fitScale = Math.min(
        1,
        availableWidth / PAPER_WIDTH,
        availableHeight / paperHeight,
      )

      setLayout((current) => (
        current.fitScale === fitScale && current.paperHeight === paperHeight
          ? current
          : { fitScale, paperHeight }
      ))
    }

    const animationFrame = window.requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(canvas)
    observer.observe(paper)
    window.addEventListener('resize', measure)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const scale = layout.fitScale * zoom

  return (
    <div
      className="preview-page-stage"
      style={{
        width: PAPER_WIDTH * scale,
        height: layout.paperHeight * scale,
      }}
    >
      <div
        className="preview-page-scaler"
        ref={paperRef}
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * 整本谱本的只读纸张预览。
 *
 * @param props 预览开关、谱本内容与开关状态回调。
 */
export function ScorePreview({
  open,
  book,
  onOpenChange,
}: {
  open: boolean
  book: ScoreBook
  onOpenChange: (open: boolean) => void
}) {
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (event: WheelEvent) => {
      // 预览画布需要滚轮翻页，只有按住 Ctrl/⌘ 时才用滚轮缩放。
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1
      setZoom((current) => Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, current * Math.exp(-event.deltaY * unit * 0.0015)),
      ))
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [])

  const zoomOut = () => setZoom((current) => Math.max(MIN_ZOOM, current - ZOOM_STEP))
  const zoomIn = () => setZoom((current) => Math.min(MAX_ZOOM, current + ZOOM_STEP))

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="preview-overlay" />
        <Dialog.Content className="preview-dialog">
          <header className="preview-toolbar">
            <div className="preview-heading">
              <span>纸张预览 · {book.pages.length} 页</span>
              <Dialog.Title>{book.title}纸张预览</Dialog.Title>
              <Dialog.Description className="visually-hidden">
                以纸张版式查看整本吉他谱
              </Dialog.Description>
            </div>
            <div className="preview-zoom-controls" aria-label="预览缩放">
              <button
                aria-label="缩小预览"
                disabled={zoom <= MIN_ZOOM}
                onClick={zoomOut}
                title="缩小预览"
                type="button"
              >
                <MagnifyingGlassMinus size={18} weight="bold" />
              </button>
              <span className="preview-zoom-value" aria-live="polite">
                {Math.round(zoom * 100)}%
              </span>
              <button
                aria-label="适配屏幕"
                aria-pressed={zoom === 1}
                onClick={() => setZoom(1)}
                title="适配屏幕"
                type="button"
              >
                <CornersIn size={18} weight="bold" />
              </button>
              <button
                aria-label="放大预览"
                disabled={zoom >= MAX_ZOOM}
                onClick={zoomIn}
                title="放大预览"
                type="button"
              >
                <MagnifyingGlassPlus size={18} weight="bold" />
              </button>
            </div>
            <Dialog.Close asChild>
              <button className="preview-close" aria-label="关闭预览">
                <X size={20} weight="bold" />
                <span>返回编辑</span>
              </button>
            </Dialog.Close>
          </header>

          <div className="preview-canvas" ref={canvasRef}>
            {book.pages.map((page, pageIndex) => (
              <PreviewPageStage key={page.id} zoom={zoom}>
                <PaperPage page={page} pageNumber={pageIndex + 1} />
              </PreviewPageStage>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
