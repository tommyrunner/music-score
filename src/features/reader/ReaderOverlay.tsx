import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'

import { PaperPage } from '../../components/PaperPage'
import { CaretLeft, CaretRight, Pause, Play, X } from '../../components/icons'
import {
  PAPER_MIN_HEIGHT,
  PAPER_WIDTH,
  readPixelValue,
} from '../../components/paper-layout'
import type { ScoreBook, ScoreBookPage } from '../../domain/score/score-document'

/** 停止操作后隐藏底部操作栏的时长。 */
const CONTROLS_HIDE_DELAY = 3000
/** 触发翻页的最小横向滑动距离。 */
const SWIPE_THRESHOLD = 48
/** 缩放范围：1 表示适配屏幕。 */
const MIN_ZOOM = 1
const MAX_ZOOM = 3
/** 自动翻页的默认每页时长。 */
const DEFAULT_PLAYBACK_SECONDS = 10

interface Size {
  width: number
  height: number
}

interface DurationFields {
  hours: string
  minutes: string
  seconds: string
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function durationFromFields(fields: DurationFields) {
  const hours = clamp(Number(fields.hours) || 0, 0, 23)
  const minutes = clamp(Number(fields.minutes) || 0, 0, 59)
  const seconds = clamp(Number(fields.seconds) || 0, 0, 59)
  return Math.floor(hours * 3600 + minutes * 60 + seconds)
}

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours} 时 ${minutes} 分 ${seconds} 秒`
  if (minutes > 0) return `${minutes} 分 ${seconds} 秒`
  return `${seconds} 秒`
}

/**
 * 尝试把屏幕方向锁定为竖屏。
 *
 * 必须在全屏状态下调用；不支持方向锁定的浏览器（如 iOS Safari）会直接忽略。
 */
async function lockPortraitOrientation() {
  try {
    await screen.orientation.lock('portrait')
  } catch {
    // 浏览器不支持或拒绝锁定方向时，保持当前方向即可。
  }
}

/**
 * 解除屏幕方向锁定，恢复系统自动旋转。
 */
function unlockOrientation() {
  try {
    screen.orientation.unlock()
  } catch {
    // 不支持方向锁定的环境忽略即可。
  }
}

function ReaderPage({
  page,
  pageNumber,
  zoom,
  pan,
  onMeasure,
}: {
  page: ScoreBookPage
  pageNumber: number
  zoom: number
  pan: { x: number; y: number }
  onMeasure: (size: Size) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const measureHandlerRef = useRef(onMeasure)
  const [layout, setLayout] = useState({ scale: 0, paperHeight: PAPER_MIN_HEIGHT })

  useEffect(() => {
    measureHandlerRef.current = onMeasure
  }, [onMeasure])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const paper = paperRef.current
    if (!stage || !paper) return

    const measure = () => {
      const styles = window.getComputedStyle(stage)
      const availableWidth = stage.clientWidth
        - readPixelValue(styles.paddingLeft)
        - readPixelValue(styles.paddingRight)
      const availableHeight = stage.clientHeight
        - readPixelValue(styles.paddingTop)
        - readPixelValue(styles.paddingBottom)
      const paperHeight = Math.max(PAPER_MIN_HEIGHT, paper.scrollHeight)

      if (availableWidth <= 0 || availableHeight <= 0) return

      const scale = Math.min(
        availableWidth / PAPER_WIDTH,
        availableHeight / paperHeight,
      )
      setLayout((current) => (
        current.scale === scale && current.paperHeight === paperHeight
          ? current
          : { scale, paperHeight }
      ))
      measureHandlerRef.current({
        width: PAPER_WIDTH * scale,
        height: paperHeight * scale,
      })
    }

    const frame = window.requestAnimationFrame(measure)
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(paper)
    window.addEventListener('resize', measure)

    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [page.id])

  return (
    <div className="reader-stage" ref={stageRef}>
      <div
        className="reader-zoom"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
      >
        <div
          className="reader-page"
          style={{
            width: PAPER_WIDTH * layout.scale,
            height: layout.paperHeight * layout.scale,
            opacity: layout.scale > 0 ? 1 : 0,
          }}
        >
          <div
            className="reader-paper-scaler"
            ref={paperRef}
            style={{
              width: PAPER_WIDTH,
              transform: `scale(${layout.scale || 1})`,
            }}
          >
            <PaperPage page={page} pageNumber={pageNumber} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 全屏阅读模式。
 *
 * 进入后请求浏览器全屏，一次展示一页纸张；点击显示底部操作栏，
 * 3 秒无操作后自动收起。支持双指缩放、滑动翻页、自动翻页和键盘操作。
 *
 * @param props.book 当前阅读的谱本。
 * @param props.onClose 退出阅读的回调。
 */
export function ReaderOverlay({
  book,
  onClose,
}: {
  book: ScoreBook
  onClose: () => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<number | null>(null)
  const pointerMapRef = useRef(new Map<number, { x: number; y: number }>())
  const pinchRef = useRef<{ startDistance: number; startZoom: number } | null>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    startPan: { x: number; y: number }
    moved: boolean
  } | null>(null)
  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const pageSizeRef = useRef<Size>({ width: 0, height: 0 })
  const viewportRef = useRef<Size>({ width: 0, height: 0 })
  const closingRef = useRef(false)
  const onCloseRef = useRef(onClose)

  const [pageIndex, setPageIndex] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [playbackPanelOpen, setPlaybackPanelOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSeconds, setPlaybackSeconds] = useState(DEFAULT_PLAYBACK_SECONDS)
  const [durationFields, setDurationFields] = useState<DurationFields>({
    hours: '0',
    minutes: '0',
    seconds: String(DEFAULT_PLAYBACK_SECONDS),
  })

  const pages = book.pages
  const currentPage = pages[pageIndex]
  const isFirst = pageIndex <= 0
  const isLast = pageIndex >= pages.length - 1
  const totalDuration = durationFromFields(durationFields)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current === null) return
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }, [])

  const scheduleHide = useCallback(() => {
    clearHideTimer()
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null
      setControlsVisible(false)
    }, CONTROLS_HIDE_DELAY)
  }, [clearHideTimer])

  const revealControls = useCallback(() => {
    setControlsVisible(true)
    scheduleHide()
  }, [scheduleHide])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    unlockOrientation()
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    onCloseRef.current()
  }, [])

  const navigate = useCallback((nextIndex: number) => {
    const lastIndex = Math.max(pages.length - 1, 0)
    const clamped = Math.min(Math.max(nextIndex, 0), lastIndex)
    if (clamped === pageIndex) return

    setPageIndex(clamped)

    // 自动播放到最后一页时停止，并把操作栏交还给用户。
    if (isPlaying && clamped >= lastIndex) {
      setIsPlaying(false)
      revealControls()
    }
  }, [isPlaying, pageIndex, pages.length, revealControls])

  const applyZoom = useCallback((nextZoom: number) => {
    const zoomValue = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
    const { width, height } = pageSizeRef.current
    const viewport = viewportRef.current
    const maxX = Math.max(0, (width * zoomValue - viewport.width) / 2)
    const maxY = Math.max(0, (height * zoomValue - viewport.height) / 2)
    const nextPan = zoomValue <= MIN_ZOOM
      ? { x: 0, y: 0 }
      : {
          x: clamp(panRef.current.x, -maxX, maxX),
          y: clamp(panRef.current.y, -maxY, maxY),
        }

    if (zoomRef.current !== zoomValue) {
      zoomRef.current = zoomValue
      setZoom(zoomValue)
    }
    if (nextPan.x !== panRef.current.x || nextPan.y !== panRef.current.y) {
      panRef.current = nextPan
      setPan(nextPan)
    }
  }, [])

  const applyPan = useCallback((nextPan: { x: number; y: number }) => {
    const { width, height } = pageSizeRef.current
    const viewport = viewportRef.current
    const zoomValue = zoomRef.current
    const maxX = Math.max(0, (width * zoomValue - viewport.width) / 2)
    const maxY = Math.max(0, (height * zoomValue - viewport.height) / 2)
    const clampedPan = {
      x: clamp(nextPan.x, -maxX, maxX),
      y: clamp(nextPan.y, -maxY, maxY),
    }

    if (clampedPan.x === panRef.current.x && clampedPan.y === panRef.current.y) return
    panRef.current = clampedPan
    setPan(clampedPan)
  }, [])

  const handlePageMeasure = useCallback((size: Size) => {
    pageSizeRef.current = size
    applyZoom(zoomRef.current)
  }, [applyZoom])

  useLayoutEffect(() => {
    const node = gestureRef.current
    if (!node) return

    const measure = () => {
      viewportRef.current = { width: node.clientWidth, height: node.clientHeight }
      applyZoom(zoomRef.current)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [applyZoom])

  useEffect(() => {
    applyZoom(MIN_ZOOM)
  }, [applyZoom, pageIndex])

  useLayoutEffect(() => {
    const node = rootRef.current
    if (!node) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        close()
        return
      }
      if (document.fullscreenElement === node) {
        // 部分浏览器进入全屏时会切换到横屏，这里再锁一次竖屏。
        void lockPortraitOrientation()
      }
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    const enterFullscreen = async () => {
      try {
        if (document.fullscreenEnabled && document.fullscreenElement !== node) {
          await node.requestFullscreen()
        }
        // 全屏成功后再锁定竖屏，避免部分浏览器自动横屏。
        await lockPortraitOrientation()

        // 全屏请求返回前用户已经关闭时，立即退回到窗口状态。
        if (closingRef.current) {
          unlockOrientation()
          if (document.fullscreenElement) await document.exitFullscreen()
        }
      } catch {
        // 浏览器拒绝全屏时，保持窗口内的全屏覆盖层阅读。
      }
    }

    void enterFullscreen()
    scheduleHide()

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.body.style.overflow = previousOverflow
      clearHideTimer()
    }
  }, [clearHideTimer, close, scheduleHide])

  useEffect(() => {
    const node = gestureRef.current
    if (!node) return

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      applyZoom(zoomRef.current * Math.exp(-event.deltaY * 0.002))
      revealControls()
    }

    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [applyZoom, revealControls])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (playbackPanelOpen) {
          setPlaybackPanelOpen(false)
          revealControls()
        } else {
          close()
        }
        return
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      event.preventDefault()
      revealControls()
      navigate(pageIndex + (event.key === 'ArrowRight' ? 1 : -1))
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [close, navigate, pageIndex, playbackPanelOpen, revealControls])

  useEffect(() => {
    if (!isPlaying) return

    const timer = window.setTimeout(() => {
      navigate(pageIndex + 1)
    }, playbackSeconds * 1000)

    return () => window.clearTimeout(timer)
  }, [isPlaying, navigate, pageIndex, playbackSeconds])

  const goPrevious = () => {
    navigate(pageIndex - 1)
    revealControls()
  }

  const goNext = () => {
    navigate(pageIndex + 1)
    revealControls()
  }

  const openPlaybackPanel = () => {
    setPlaybackPanelOpen(true)
    setControlsVisible(true)
    clearHideTimer()
  }

  const closePlaybackPanel = () => {
    setPlaybackPanelOpen(false)
    revealControls()
  }

  const startPlayback = () => {
    if (totalDuration < 1 || pages.length <= 1 || isLast) return
    setPlaybackSeconds(totalDuration)
    setIsPlaying(true)
    setPlaybackPanelOpen(false)
    revealControls()
  }

  const pausePlayback = () => {
    setIsPlaying(false)
    revealControls()
  }

  const updateDurationField = (field: keyof DurationFields, value: string) => {
    const limit = field === 'hours' ? 23 : 59
    const digits = value.replace(/\D/g, '')
    const numeric = Number(digits)
    const nextValue = digits === ''
      ? ''
      : String(Math.min(Number.isFinite(numeric) ? numeric : 0, limit))
    setDurationFields((current) => ({ ...current, [field]: nextValue }))
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    pointerMapRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // 不支持指针捕获的环境忽略即可。
    }

    const pointers = [...pointerMapRef.current.values()]
    if (pointers.length === 2) {
      pinchRef.current = {
        startDistance: Math.hypot(
          pointers[0].x - pointers[1].x,
          pointers[0].y - pointers[1].y,
        ),
        startZoom: zoomRef.current,
      }
      dragRef.current = null
    } else if (pointers.length === 1) {
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        startPan: panRef.current,
        moved: false,
      }
    }
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = pointerMapRef.current
    if (!pointers.has(event.pointerId)) return
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const active = [...pointers.values()]
    const pinch = pinchRef.current
    if (active.length >= 2 && pinch) {
      const distance = Math.hypot(
        active[0].x - active[1].x,
        active[0].y - active[1].y,
      )
      if (pinch.startDistance > 0) {
        applyZoom(pinch.startZoom * (distance / pinch.startDistance))
      }
      return
    }

    const drag = dragRef.current
    if (!drag || active.length !== 1 || zoomRef.current <= MIN_ZOOM) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) drag.moved = true
    applyPan({ x: drag.startPan.x + deltaX, y: drag.startPan.y + deltaY })
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pointers = pointerMapRef.current
    pointers.delete(event.pointerId)
    const remaining = [...pointers.values()]

    if (remaining.length === 1) {
      pinchRef.current = null
      dragRef.current = {
        startX: remaining[0].x,
        startY: remaining[0].y,
        startPan: panRef.current,
        moved: true,
      }
      return
    }

    if (remaining.length > 1) return

    const drag = dragRef.current
    pinchRef.current = null
    dragRef.current = null
    if (!drag) return

    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY

    if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && !drag.moved) {
      if (playbackPanelOpen) {
        setPlaybackPanelOpen(false)
        revealControls()
      } else if (controlsVisible) {
        clearHideTimer()
        setControlsVisible(false)
      } else {
        revealControls()
      }
      return
    }

    if (zoomRef.current > MIN_ZOOM) return

    if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
      navigate(pageIndex + (deltaX < 0 ? 1 : -1))
      revealControls()
    }
  }

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerMapRef.current.delete(event.pointerId)
    if (pointerMapRef.current.size === 0) {
      pinchRef.current = null
      dragRef.current = null
    }
  }

  return (
    <div
      className="reader-overlay"
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${book.title} 阅读模式`}
    >
      <div
        className="reader-gesture-layer"
        ref={gestureRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {currentPage ? (
          <ReaderPage
            key={currentPage.id}
            page={currentPage}
            pageNumber={pageIndex + 1}
            zoom={zoom}
            pan={pan}
            onMeasure={handlePageMeasure}
          />
        ) : (
          <p className="reader-empty">这本谱本还没有页面，先回到编辑模式添加一页吧。</p>
        )}
      </div>

      <div
        className={`reader-controls${controlsVisible ? ' is-visible' : ''}`}
        inert={!controlsVisible}
      >
        <div className="reader-meta">
          <strong>{book.title}</strong>
          <span>{currentPage ? currentPage.title : '暂无页面'}</span>
        </div>

        <div className="reader-actions">
          <button
            type="button"
            className={`reader-play${isPlaying ? ' is-playing' : ''}`}
            onClick={isPlaying
              ? pausePlayback
              : playbackPanelOpen ? closePlaybackPanel : openPlaybackPanel}
            aria-label={isPlaying ? '暂停自动翻页' : '自动翻页设置'}
            aria-expanded={playbackPanelOpen}
            aria-pressed={isPlaying}
            title={isPlaying
              ? `暂停自动翻页（每页 ${formatDuration(playbackSeconds)}）`
              : '自动翻页'}
          >
            {isPlaying
              ? <Pause size={17} weight="fill" />
              : <Play size={17} weight="fill" />}
          </button>

          <div className="reader-pager">
            <button
              type="button"
              onClick={goPrevious}
              disabled={isFirst}
              aria-label="上一页"
              title="上一页"
            >
              <CaretLeft size={18} weight="bold" />
            </button>
            <span className="reader-page-count" aria-live="polite">
              <strong>{pages.length > 0 ? pageIndex + 1 : 0}</strong>
              <span>/</span>
              {pages.length}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={isLast || pages.length === 0}
              aria-label="下一页"
              title="下一页"
            >
              <CaretRight size={18} weight="bold" />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="reader-exit"
          onClick={close}
          aria-label="退出阅读"
          title="退出阅读（Esc）"
        >
          <X size={17} weight="bold" />
          <span>退出阅读</span>
        </button>

        {playbackPanelOpen && (
          <div className="reader-play-panel" role="group" aria-label="自动播放设置">
            <div className="reader-play-heading">
              <strong>自动播放</strong>
              <button
                type="button"
                className="reader-play-close"
                onClick={closePlaybackPanel}
                aria-label="关闭自动播放设置"
              >
                <X size={14} weight="bold" />
              </button>
            </div>

            <div className="reader-play-modes" role="group" aria-label="播放方式">
              <button type="button" className="is-selected" aria-pressed="true">
                页播放
              </button>
              <button type="button" disabled title="行播放暂未开放">
                行播放
                <small>暂未开放</small>
              </button>
            </div>

            <div className="reader-play-duration" role="group" aria-label="每页停留时长">
              <label>
                <span>时</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  inputMode="numeric"
                  value={durationFields.hours}
                  onChange={(event) => updateDurationField('hours', event.target.value)}
                />
              </label>
              <label>
                <span>分</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={durationFields.minutes}
                  onChange={(event) => updateDurationField('minutes', event.target.value)}
                />
              </label>
              <label>
                <span>秒</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  inputMode="numeric"
                  value={durationFields.seconds}
                  onChange={(event) => updateDurationField('seconds', event.target.value)}
                />
              </label>
            </div>

            <p className="reader-play-hint">
              {pages.length <= 1
                ? '当前谱本只有一页，无需自动翻页。'
                : isLast
                  ? '当前已经是最后一页，请先翻到前面的页面再开始播放。'
                  : totalDuration > 0
                    ? `每页停留 ${formatDuration(totalDuration)}，结束后自动翻到下一页。`
                    : '请设置大于 0 的播放时长。'}
            </p>

            <div className="reader-play-footer">
              <button type="button" className="reader-play-cancel" onClick={closePlaybackPanel}>
                取消
              </button>
              <button
                type="button"
                className="reader-play-start"
                disabled={totalDuration < 1 || pages.length <= 1 || isLast}
                onClick={startPlayback}
              >
                <Play size={14} weight="fill" />
                开始播放
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
