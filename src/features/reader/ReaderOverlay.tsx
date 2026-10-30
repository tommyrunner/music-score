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
import {
  DEFAULT_PLAYBACK_SECONDS,
  MAX_PLAYBACK_SECONDS,
  type ScoreBook,
  type ScoreBookPage,
} from '../../domain/score/score-document'

/** 停止操作后隐藏底部操作栏的时长。 */
const CONTROLS_HIDE_DELAY = 3000
/** 触发翻页的最小横向滑动距离。 */
const SWIPE_THRESHOLD = 48
/** 缩放范围：1 表示适配屏幕。 */
const MIN_ZOOM = 1
const MAX_ZOOM = 3
/** 翻页轮播动画时长，与 reader.css 中的动画保持一致。 */
const SLIDE_DURATION = 360
/** 首次进入阅读时纸张放大动画时长。 */
const ENTRANCE_DURATION = 620
/** 进入阅读前预加载图片与字体资源的最长等待时间。 */
const PRELOAD_TIMEOUT = 900

interface Size {
  width: number
  height: number
}

interface PageLayout {
  scale: number
  paperHeight: number
}

interface PageTransition {
  from: number
  to: number
  direction: 'next' | 'prev'
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
 * 把谱本配置的默认播放时长拆成时、分、秒输入框。
 *
 * @param totalSeconds 默认每页停留时长（秒）。
 */
function splitPlaybackSeconds(totalSeconds: number): DurationFields {
  const safeSeconds = clamp(Math.round(totalSeconds), 1, MAX_PLAYBACK_SECONDS)
  return {
    hours: String(Math.floor(safeSeconds / 3600)),
    minutes: String(Math.floor((safeSeconds % 3600) / 60)),
    seconds: String(safeSeconds % 60),
  }
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
  initialLayout,
  onMeasure,
}: {
  page: ScoreBookPage
  pageNumber: number
  zoom: number
  pan: { x: number; y: number }
  initialLayout?: PageLayout
  onMeasure: (pageId: string, layout: PageLayout) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const paperRef = useRef<HTMLDivElement>(null)
  const measureHandlerRef = useRef(onMeasure)
  const [layout, setLayout] = useState<PageLayout>(
    () => initialLayout ?? { scale: 0, paperHeight: PAPER_MIN_HEIGHT },
  )

  useLayoutEffect(() => {
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
      measureHandlerRef.current(page.id, { scale, paperHeight })
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

  const combinedScale = layout.scale * zoom

  return (
    <div className="reader-stage" ref={stageRef}>
      <div className="reader-zoom">
        <div
          className="reader-page"
          style={{
            width: PAPER_WIDTH * combinedScale,
            height: layout.paperHeight * combinedScale,
            opacity: layout.scale > 0 ? 1 : 0,
          }}
        >
          <div
            className="reader-paper-scaler"
            ref={paperRef}
            style={{
              width: PAPER_WIDTH,
              // 缩放和位移合成同一个 transform，避免嵌套变换被拆成多份位图而发虚。
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${combinedScale || 1})`,
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
  const transitionTimerRef = useRef<number | null>(null)
  const playbackPagesRef = useRef<HTMLDivElement>(null)

  const [pageIndex, setPageIndex] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [playbackPanelOpen, setPlaybackPanelOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackFieldsByPage, setPlaybackFieldsByPage] = useState<Record<string, DurationFields>>(
    () => Object.fromEntries(
      book.pages.map((page) => [page.id, splitPlaybackSeconds(page.playbackSeconds)]),
    ),
  )
  const [settingsPageIndex, setSettingsPageIndex] = useState(0)
  const [layoutCache, setLayoutCache] = useState<Record<string, PageLayout>>({})
  const [transition, setTransition] = useState<PageTransition | null>(null)
  const [entranceState, setEntranceState] = useState<'pending' | 'playing' | 'done'>('pending')
  const [resourcesReady, setResourcesReady] = useState(false)

  const pages = book.pages
  const currentPage = pages[pageIndex]
  const currentPageId = currentPage?.id ?? null
  const isFirst = pageIndex <= 0
  const isLast = pageIndex >= pages.length - 1
  const fieldsForPage = (pageId: string) => (
    playbackFieldsByPage[pageId]
    ?? splitPlaybackSeconds(
      pages.find((item) => item.id === pageId)?.playbackSeconds ?? DEFAULT_PLAYBACK_SECONDS,
    )
  )
  const secondsForPage = (pageId: string) => (
    Math.max(durationFromFields(fieldsForPage(pageId)), 1)
  )
  const currentPageDuration = currentPage
    ? secondsForPage(currentPage.id)
    : DEFAULT_PLAYBACK_SECONDS
  const settingsPage = pages[settingsPageIndex] ?? currentPage
  const settingsFields = settingsPage
    ? fieldsForPage(settingsPage.id)
    : splitPlaybackSeconds(DEFAULT_PLAYBACK_SECONDS)
  const settingsDuration = settingsPage
    ? secondsForPage(settingsPage.id)
    : DEFAULT_PLAYBACK_SECONDS

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!playbackPanelOpen) return

    const container = playbackPagesRef.current
    const activeTab = container?.querySelector<HTMLButtonElement>('button[aria-selected="true"]')
    activeTab?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [playbackPanelOpen, settingsPageIndex])

  // 进入阅读前先预载图片和字体，最多等待 PRELOAD_TIMEOUT，避免进入后出现空白跳变。
  useEffect(() => {
    let cancelled = false
    const imageUrls = book.pages.flatMap((page) => (
      page.type === 'image' ? [page.image.url] : []
    ))
    const preloadImage = (url: string) => new Promise<void>((resolve) => {
      const image = new Image()
      image.onload = () => resolve()
      image.onerror = () => resolve()
      image.src = url
    })
    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, PRELOAD_TIMEOUT)
    })
    const fontsReady = document.fonts
      ? document.fonts.ready.then(() => {})
      : Promise.resolve()

    void Promise.race([
      Promise.all([fontsReady, ...imageUrls.map(preloadImage)]).then(() => {}),
      timeout,
    ]).then(() => {
      if (!cancelled) setResourcesReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [book])

  useEffect(() => {
    if (entranceState !== 'playing') return

    const timer = window.setTimeout(() => setEntranceState('done'), ENTRANCE_DURATION)
    return () => window.clearTimeout(timer)
  }, [entranceState])

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current)
    }
  }, [])

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
    // 上一段轮播动画还没结束时忽略新的翻页，避免画面错位。
    if (transitionTimerRef.current !== null) return

    const lastIndex = Math.max(pages.length - 1, 0)
    const clamped = Math.min(Math.max(nextIndex, 0), lastIndex)
    if (clamped === pageIndex) return

    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
    setZoom(1)
    setPan({ x: 0, y: 0 })

    setTransition({
      from: pageIndex,
      to: clamped,
      direction: clamped > pageIndex ? 'next' : 'prev',
    })
    setPageIndex(clamped)

    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null
      setTransition(null)
    }, SLIDE_DURATION)

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

  const handlePageMeasure = useCallback((pageId: string, nextLayout: PageLayout) => {
    setLayoutCache((current) => {
      const existing = current[pageId]
      if (existing
        && existing.scale === nextLayout.scale
        && existing.paperHeight === nextLayout.paperHeight) {
        return current
      }
      return { ...current, [pageId]: nextLayout }
    })

    if (pageId !== currentPageId) return

    pageSizeRef.current = {
      width: PAPER_WIDTH * nextLayout.scale,
      height: nextLayout.paperHeight * nextLayout.scale,
    }
    applyZoom(zoomRef.current)
    setEntranceState((current) => (
      current === 'pending' && transitionTimerRef.current === null ? 'playing' : current
    ))
  }, [applyZoom, currentPageId])

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
  }, [applyZoom, resourcesReady])

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

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.body.style.overflow = previousOverflow
      clearHideTimer()
    }
  }, [clearHideTimer, close])

  useEffect(() => {
    if (!resourcesReady) return
    scheduleHide()
  }, [resourcesReady, scheduleHide])

  useEffect(() => {
    if (!resourcesReady) return

    const node = gestureRef.current
    if (!node) return

    const handleWheel = (event: WheelEvent) => {
      // 阅读模式没有滚动需求，滚轮直接用于缩放；触控板捏合会带上 ctrlKey，同样走这里。
      event.preventDefault()
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1
      applyZoom(zoomRef.current * Math.exp(-event.deltaY * unit * 0.0015))
      revealControls()
    }

    node.addEventListener('wheel', handleWheel, { passive: false })
    return () => node.removeEventListener('wheel', handleWheel)
  }, [applyZoom, resourcesReady, revealControls])

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
    }, currentPageDuration * 1000)

    return () => window.clearTimeout(timer)
  }, [currentPageDuration, isPlaying, navigate, pageIndex])

  const goPrevious = () => {
    navigate(pageIndex - 1)
    revealControls()
  }

  const goNext = () => {
    navigate(pageIndex + 1)
    revealControls()
  }

  const openPlaybackPanel = () => {
    setSettingsPageIndex(pageIndex)
    setPlaybackPanelOpen(true)
    setControlsVisible(true)
    clearHideTimer()
  }

  const closePlaybackPanel = () => {
    setPlaybackPanelOpen(false)
    revealControls()
  }

  const startPlayback = () => {
    if (pages.length <= 1 || isLast) return
    setIsPlaying(true)
    setPlaybackPanelOpen(false)
    revealControls()
  }

  const pausePlayback = () => {
    setIsPlaying(false)
    revealControls()
  }

  const updatePlaybackField = (field: keyof DurationFields, value: string) => {
    if (!settingsPage) return

    const limit = field === 'hours' ? 23 : 59
    const digits = value.replace(/\D/g, '')
    const numeric = Number(digits)
    const nextValue = digits === ''
      ? ''
      : String(Math.min(Number.isFinite(numeric) ? numeric : 0, limit))
    setPlaybackFieldsByPage((current) => ({
      ...current,
      [settingsPage.id]: {
        ...(current[settingsPage.id] ?? fieldsForPage(settingsPage.id)),
        [field]: nextValue,
      },
    }))
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
      {!resourcesReady ? (
        <div className="reader-loading" role="status">正在准备阅读…</div>
      ) : (
        <div
          className="reader-gesture-layer"
          ref={gestureRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {currentPage ? (
            transition ? (
              <>
                <div
                  className={`reader-slide-layer is-out-${transition.direction}`}
                  aria-hidden="true"
                >
                  <ReaderPage
                    key={`out-${pages[transition.from].id}`}
                    page={pages[transition.from]}
                    pageNumber={transition.from + 1}
                    zoom={1}
                    pan={{ x: 0, y: 0 }}
                    initialLayout={layoutCache[pages[transition.from].id]}
                    onMeasure={handlePageMeasure}
                  />
                </div>
                <div className={`reader-slide-layer is-in-${transition.direction}`}>
                  <ReaderPage
                    key={`in-${currentPage.id}`}
                    page={currentPage}
                    pageNumber={pageIndex + 1}
                    zoom={zoom}
                    pan={pan}
                    initialLayout={layoutCache[currentPage.id]}
                    onMeasure={handlePageMeasure}
                  />
                </div>
              </>
            ) : (
              <div className={`reader-slide-layer${entranceState === 'playing' ? ' is-entering' : ''}`}>
                <ReaderPage
                  key={`page-${currentPage.id}`}
                  page={currentPage}
                  pageNumber={pageIndex + 1}
                  zoom={zoom}
                  pan={pan}
                  initialLayout={layoutCache[currentPage.id]}
                  onMeasure={handlePageMeasure}
                />
              </div>
            )
          ) : (
            <p className="reader-empty">这本谱本还没有页面，先回到编辑模式添加一页吧。</p>
          )}
        </div>
      )}

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
              ? `暂停自动翻页（当前页 ${formatDuration(currentPageDuration)}）`
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

            <div className="reader-play-config">
              <div className="reader-play-pages" role="tablist" aria-label="选择页码" ref={playbackPagesRef}>
                {pages.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={index === settingsPageIndex}
                    className={index === settingsPageIndex ? 'is-selected' : ''}
                    title={item.title}
                    onClick={() => setSettingsPageIndex(index)}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div className="reader-play-page-label">
                第 {settingsPageIndex + 1} 页 · {settingsPage?.title ?? '暂无页面'}
              </div>

              <div className="reader-play-duration" role="group" aria-label="每页停留时长">
                <label>
                  <span>时</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    inputMode="numeric"
                    value={settingsFields.hours}
                    onChange={(event) => updatePlaybackField('hours', event.target.value)}
                  />
                </label>
                <label>
                  <span>分</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    value={settingsFields.minutes}
                    onChange={(event) => updatePlaybackField('minutes', event.target.value)}
                  />
                </label>
                <label>
                  <span>秒</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    inputMode="numeric"
                    value={settingsFields.seconds}
                    onChange={(event) => updatePlaybackField('seconds', event.target.value)}
                  />
                </label>
              </div>
            </div>

            <p className="reader-play-hint">
              {pages.length <= 1
                ? '当前谱本只有一页，无需自动翻页。'
                : isLast
                  ? '当前已经是最后一页，请先翻到前面的页面再开始播放。'
                  : `第 ${settingsPageIndex + 1} 页停留 ${formatDuration(settingsDuration)}，每页按各自配置自动翻页；此处修改仅本次播放生效。`}
            </p>

            <div className="reader-play-footer">
              <button type="button" className="reader-play-cancel" onClick={closePlaybackPanel}>
                取消
              </button>
              <button
                type="button"
                className="reader-play-start"
                disabled={pages.length <= 1 || isLast}
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
