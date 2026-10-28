import {
  CornersIn,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  X,
} from '@phosphor-icons/react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import { FittedSingleLineText } from '../../components/FittedSingleLineText'
import { ScoreSymbolLayer } from '../../components/ScoreSymbolLayer'
import type {
  ScoreBook,
  ImagePage,
  ScoreMeasure,
  ScorePage,
} from '../../domain/score/score-document'

const PAPER_WIDTH = 794
const PAPER_MIN_HEIGHT = 1123
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

function readPixelValue(value: string) {
  return Number.parseFloat(value) || 0
}

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

function PreviewMeasure({ measure }: { measure: ScoreMeasure }) {
  const gridColumns = `repeat(${measure.positions.length}, minmax(0, 1fr))`

  return (
    <div className="preview-measure">
      <div className="preview-chords" aria-hidden="true" style={{ gridTemplateColumns: gridColumns }}>
        {measure.positions.map((position) => <span key={position.id}>{position.chord}</span>)}
      </div>
      <div className="preview-staff">
        {Array.from({ length: 6 }, (_, stringIndex) => (
          <div className="preview-string" key={stringIndex} style={{ gridTemplateColumns: gridColumns }}>
            {measure.positions.map((position) => {
              const note = position.notes.find((candidate) => candidate.string === stringIndex + 1)
              return <span key={position.id}>{note?.fret ?? ''}</span>
            })}
          </div>
        ))}
        <div
          className="preview-function-marks"
          aria-hidden="true"
          style={{ gridTemplateColumns: gridColumns }}
        >
          {measure.positions.map((position) => (
            <span key={position.id}>
              {position.barline === 'single' && <i className="preview-functional-barline" />}
            </span>
          ))}
        </div>
        <ScoreSymbolLayer symbols={measure.symbols} positions={measure.positions} />
      </div>
      {measure.lyrics.length > 0 && (
        <div className="preview-lyrics">
          {measure.lyrics.map((lyric, index) => (
            <FittedSingleLineText
              className="preview-lyric-line"
              fontSize={10}
              key={`${measure.id}-${index}`}
              text={lyric}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ScorePaper({ page, pageNumber }: { page: ScorePage; pageNumber: number }) {
  return (
    <article className="preview-paper" aria-label={`${page.title}六线谱纸张`}>
      <header className="preview-paper-heading">
        <div>
          <span>GUITAR TAB</span>
          <h3>{page.title}</h3>
          {page.subtitle && <p className="preview-paper-subtitle">{page.subtitle}</p>}
        </div>
        <small>{String(pageNumber).padStart(2, '0')}</small>
      </header>
      <div className="preview-measures">
        {page.measures.map((measure) => (
          <PreviewMeasure key={measure.id} measure={measure} />
        ))}
      </div>
      <footer className="preview-score-footer">
        <span>{page.footerLeft}</span>
        <span>{page.footerRight}</span>
      </footer>
    </article>
  )
}

function ImagePaper({ page, pageNumber }: { page: ImagePage; pageNumber: number }) {
  return (
    <article className="preview-paper preview-image-paper">
      <header className="preview-paper-heading">
        <div><span>REFERENCE</span><h3>{page.title}</h3></div>
        <small>{String(pageNumber).padStart(2, '0')}</small>
      </header>
      <div className="preview-image-frame">
        <img src={page.image.url} alt={page.title} />
      </div>
      <footer>弦间 · Image reference</footer>
    </article>
  )
}

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

          <div className="preview-canvas">
            {book.pages.map((page, pageIndex) => (
              <PreviewPageStage key={page.id} zoom={zoom}>
                {page.type === 'score' ? (
                  <ScorePaper page={page} pageNumber={pageIndex + 1} />
                ) : (
                  <ImagePaper page={page} pageNumber={pageIndex + 1} />
                )}
              </PreviewPageStage>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
