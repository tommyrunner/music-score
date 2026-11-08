import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useScoreStore } from '../../app/use-score-store'
import { ChordMark } from '../../components/ChordMark'
import { DialogShell } from '../../components/DialogShell'
import { FittedSingleLineText } from '../../components/FittedSingleLineText'
import {
  ClipboardText,
  Lightning,
  MultiNoteSwatch,
  StaffLines,
  SymbolSwatch,
} from '../../components/icons'
import {
  SCORE_SYMBOL_LABELS,
  STRING_RANGE_LABELS,
  scoreSymbolLabel,
} from '../../components/score-symbol-meta'
import { ScoreSymbolLayer } from '../../components/ScoreSymbolLayer'
import {
  DEFAULT_CHORD_DISPLAY,
  MAX_FRET,
  type FretValue,
  type ScorePage,
  type ScoreSymbol,
  type ScoreSymbolType,
  type StringRange,
} from '../../domain/score/score-document'
import { ChordDialog } from './ChordDialog'

interface SelectedCell {
  measureId: string
  positionId: string
  stringNumber: number | null
}

type CellDialogTab = 'note' | 'function'
type OnePointSymbolType = Extract<ScoreSymbolType, 'arpeggio' | 'sweep'>
type TwoPointSymbolType = Extract<ScoreSymbolType, 'tie' | 'hammer-on' | 'pull-off'>

/** 快捷填写开关在同一个会话内跨页面保留。 */
let quickFillPreferred = false

/**
 * 找到开启快捷填写时的起始节点。
 *
 * 优先从最后一个已填写节点之后继续找第一个空白节点（顺序填写的自然续写位置）；
 * 如果后面都填满了，再回到开头找空位；完全没有音符时从第一个节点开始。
 *
 * @param page 当前六线谱页面。
 */
function findQuickStartCell(page: ScorePage): SelectedCell | null {
  const nodes: Array<{
    measureId: string
    positionId: string
    stringNumber: number
    filled: boolean
  }> = []

  for (const measure of page.measures) {
    for (let stringNumber = 1; stringNumber <= 6; stringNumber += 1) {
      for (const position of measure.positions) {
        nodes.push({
          measureId: measure.id,
          positionId: position.id,
          stringNumber,
          filled: position.notes.some((note) => note.string === stringNumber),
        })
      }
    }
  }

  if (nodes.length === 0) return null

  let lastFilledIndex = -1
  nodes.forEach((node, index) => {
    if (node.filled) lastFilledIndex = index
  })

  const startIndex = lastFilledIndex >= 0 ? lastFilledIndex + 1 : 0
  const ordered = [...nodes.slice(startIndex), ...nodes.slice(0, startIndex)]
  const next = ordered.find((node) => !node.filled) ?? nodes[0]

  return {
    measureId: next.measureId,
    positionId: next.positionId,
    stringNumber: next.stringNumber,
  }
}

interface PendingSymbol {
  type: TwoPointSymbolType
  measureId: string
  start: { positionId: string; string: number }
  startLabel: string
}

interface SelectedSymbol {
  measureId: string
  symbolId: string
  label: string
}

interface SelectedChord {
  measureId: string
  positionId: string
}

interface MarqueeDrag {
  container: HTMLElement
  pointerId: number
  startClientX: number
  startClientY: number
  moved: boolean
}

interface SelectedLyric {
  measureId: string
  index: number
  text: string
}

const fretChoices: FretValue[] = [
  'X',
  ...Array.from({ length: MAX_FRET + 1 }, (_, fret) => fret),
]

const STRING_RANGES: StringRange[] = ['upper', 'lower', 'all']

const ONE_POINT_SYMBOLS: Array<{
  type: OnePointSymbolType
  label: string
  description: string
}> = [
  { type: 'arpeggio', label: '琶音', description: '波浪线' },
  { type: 'sweep', label: '扫弦', description: '直线' },
]

const TWO_POINT_SYMBOLS: Array<{ type: TwoPointSymbolType; label: string }> = [
  { type: 'tie', label: SCORE_SYMBOL_LABELS.tie },
  { type: 'hammer-on', label: SCORE_SYMBOL_LABELS['hammer-on'] },
  { type: 'pull-off', label: SCORE_SYMBOL_LABELS['pull-off'] },
]

/**
 * 六线谱页面编辑器。
 *
 * 负责音符、和弦、符号、歌词、多选和框选等页面内编辑操作。
 *
 * @param props 当前六线谱页面。
 */
export function ScoreEditor({ page, bookTitle }: { page: ScorePage; bookTitle: string }) {
  const updateFret = useScoreStore((state) => state.updateFret)
  const updateChord = useScoreStore((state) => state.updateChord)
  const updateBarline = useScoreStore((state) => state.updateBarline)
  const updateLyricLine = useScoreStore((state) => state.updateLyricLine)
  const addSymbol = useScoreStore((state) => state.addSymbol)
  const removeSymbol = useScoreStore((state) => state.removeSymbol)
  const updatePositionNotes = useScoreStore((state) => state.updatePositionNotes)
  const isSelectMode = useScoreStore((state) => state.isSelectMode)
  const selectedNodes = useScoreStore((state) => state.selectedNodes)
  const toggleSelectMode = useScoreStore((state) => state.toggleSelectMode)
  const toggleNodeSelection = useScoreStore((state) => state.toggleNodeSelection)
  const setSelectedNodes = useScoreStore((state) => state.setSelectedNodes)
  const copySelection = useScoreStore((state) => state.copySelection)
  const clipboard = useScoreStore((state) => state.clipboard)
  const pasteAt = useScoreStore((state) => state.pasteAt)
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null)
  const [cellDialogTab, setCellDialogTab] = useState<CellDialogTab>('note')
  const [selectedChord, setSelectedChord] = useState<SelectedChord | null>(null)
  const [selectedLyric, setSelectedLyric] = useState<SelectedLyric | null>(null)
  const [lyricDraft, setLyricDraft] = useState('')
  const [pendingSymbol, setPendingSymbol] = useState<PendingSymbol | null>(null)
  const [selectedSymbol, setSelectedSymbol] = useState<SelectedSymbol | null>(null)
  const [multiNoteMode, setMultiNoteMode] = useState(false)
  const [symbolNotice, setSymbolNotice] = useState('')
  const [marquee, setMarquee] = useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)
  const lastAnchorRef = useRef<{ measureId: string; positionId: string } | null>(null)
  const suppressClickRef = useRef(false)
  const marqueeDragRef = useRef<MarqueeDrag | null>(null)

  const [quickFillEnabled, setQuickFillEnabled] = useState(quickFillPreferred)
  const [quickTarget, setQuickTarget] = useState<SelectedCell | null>(
    () => (quickFillPreferred ? findQuickStartCell(page) : null),
  )

  // 按视觉顺序展开所有音符节点（先弦后列），快捷填写用它定位和自动跳转。
  const quickNodes = useMemo(() => page.measures.flatMap((measure) => (
    Array.from({ length: 6 }, (_, stringIndex) => (
      measure.positions.map((position) => ({
        measureId: measure.id,
        positionId: position.id,
        stringNumber: stringIndex + 1,
        filled: position.notes.some((note) => note.string === stringIndex + 1),
      }))
    )).flat()
  )), [page.measures])

  // 每列第一个空白弦，供单竖线后跳到下一列时使用。
  const quickPositions = useMemo(() => page.measures.flatMap((measure) => (
    measure.positions.map((position) => ({
      measureId: measure.id,
      positionId: position.id,
      firstEmptyString: [1, 2, 3, 4, 5, 6].find((stringNumber) => (
        !position.notes.some((note) => note.string === stringNumber)
      )) ?? null,
    }))
  )), [page.measures])

  /** 填写完成后跳到下一个空白节点；扫描到末尾会绕回开头。 */
  const advanceQuickTarget = useCallback((from: SelectedCell) => {
    const fromIndex = quickNodes.findIndex((node) => (
      node.measureId === from.measureId
      && node.positionId === from.positionId
      && node.stringNumber === from.stringNumber
    ))
    const ordered = fromIndex >= 0
      ? [...quickNodes.slice(fromIndex + 1), ...quickNodes.slice(0, fromIndex + 1)]
      : quickNodes
    const next = ordered.find((node) => (
      !node.filled
      && !(node.measureId === from.measureId
        && node.positionId === from.positionId
        && node.stringNumber === from.stringNumber)
    ))
    if (!next) return

    setQuickTarget({
      measureId: next.measureId,
      positionId: next.positionId,
      stringNumber: next.stringNumber,
    })
  }, [quickNodes])

  /** 单竖线写入后跳到下一列的第一个空白节点。 */
  const advanceQuickTargetToNextPosition = useCallback((from: SelectedCell) => {
    const fromIndex = quickPositions.findIndex((item) => (
      item.measureId === from.measureId && item.positionId === from.positionId
    ))
    const ordered = fromIndex >= 0
      ? [...quickPositions.slice(fromIndex + 1), ...quickPositions.slice(0, fromIndex + 1)]
      : quickPositions
    const next = ordered.find((item) => (
      item.firstEmptyString !== null
      && !(item.measureId === from.measureId && item.positionId === from.positionId)
    ))
    if (!next || next.firstEmptyString === null) return

    setQuickTarget({
      measureId: next.measureId,
      positionId: next.positionId,
      stringNumber: next.firstEmptyString,
    })
  }, [quickPositions])

  /**
   * 开启时优先从最后一个已填节点之后继续找空位，关闭时清空光标。
   */
  const toggleQuickFill = () => {
    if (quickFillEnabled) {
      quickFillPreferred = false
      setQuickFillEnabled(false)
      setQuickTarget(null)
      return
    }

    if (isSelectMode) toggleSelectMode()

    quickFillPreferred = true
    const startCell = findQuickStartCell(page)
    setQuickTarget(startCell)
    setQuickFillEnabled(true)
  }

  // 快捷键只在快捷填写开启、没有弹框且焦点不在输入框时生效。
  useEffect(() => {
    if (!quickFillEnabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.repeat) return

      const eventTarget = event.target
      if (eventTarget instanceof HTMLElement
        && eventTarget.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('.dialog-panel')) return
      if (isSelectMode) return

      const key = event.key.toLowerCase()
      if (key === 'escape') {
        setQuickFillEnabled(false)
        setQuickTarget(null)
        return
      }
      if (!quickTarget) return

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        setQuickTarget((current) => {
          if (!current || current.stringNumber === null) return current
          const nextString = current.stringNumber + (event.key === 'ArrowUp' ? -1 : 1)
          const clamped = Math.min(Math.max(nextString, 1), 6)
          return clamped === current.stringNumber
            ? current
            : { ...current, stringNumber: clamped }
        })
        return
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        const targetIndex = quickNodes.findIndex((node) => (
          node.measureId === quickTarget.measureId
          && node.positionId === quickTarget.positionId
          && node.stringNumber === quickTarget.stringNumber
        ))
        const previous = targetIndex > 0 ? quickNodes[targetIndex - 1] : null
        if (!previous) return

        if (previous.filled) {
          updateFret(previous.measureId, previous.positionId, previous.stringNumber, null)
        }
        setQuickTarget({
          measureId: previous.measureId,
          positionId: previous.positionId,
          stringNumber: previous.stringNumber,
        })
        return
      }

      if (key === 'd') {
        event.preventDefault()
        setCellDialogTab('note')
        setSelectedSymbol(null)
        setSelectedCell({
          measureId: quickTarget.measureId,
          positionId: quickTarget.positionId,
          stringNumber: null,
        })
        setMultiNoteMode(true)
        return
      }

      if (key === 'l') {
        const measure = page.measures.find((candidate) => candidate.id === quickTarget.measureId)
        const position = measure?.positions.find(
          (candidate) => candidate.id === quickTarget.positionId,
        )
        event.preventDefault()
        updateBarline(
          quickTarget.measureId,
          quickTarget.positionId,
          position?.barline === 'single' ? null : 'single',
        )
        advanceQuickTargetToNextPosition(quickTarget)
        return
      }

      if (key === 'x' && quickTarget.stringNumber !== null) {
        event.preventDefault()
        updateFret(
          quickTarget.measureId,
          quickTarget.positionId,
          quickTarget.stringNumber,
          'X',
        )
        advanceQuickTarget(quickTarget)
        return
      }

      if (!/^[0-6]$/.test(key) || quickTarget.stringNumber === null) return

      event.preventDefault()
      updateFret(
        quickTarget.measureId,
        quickTarget.positionId,
        quickTarget.stringNumber,
        Number(key) as FretValue,
      )
      advanceQuickTarget(quickTarget)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    advanceQuickTarget,
    advanceQuickTargetToNextPosition,
    isSelectMode,
    page.measures,
    quickFillEnabled,
    quickNodes,
    quickTarget,
    updateBarline,
    updateFret,
  ])

  useEffect(() => {
    if (!quickFillEnabled || !quickTarget) return

    const node = document.querySelector<HTMLElement>('.note-grid button.is-quick-target')
    node?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [quickFillEnabled, quickTarget])

  const selectedMeasure = selectedCell
    ? page.measures.find((measure) => measure.id === selectedCell.measureId) ?? null
    : null
  const selectedPosition = selectedCell
    ? selectedMeasure?.positions.find((position) => position.id === selectedCell.positionId) ?? null
    : null
  const selectedPositionIndex = selectedPosition
    ? selectedMeasure?.positions.findIndex((position) => position.id === selectedPosition.id) ?? -1
    : -1
  const selectedNote = selectedCell && selectedCell.stringNumber !== null
    ? selectedPosition?.notes.find((note) => note.string === selectedCell.stringNumber) ?? null
    : null
  const canClear = Boolean(
    selectedSymbol
    || (multiNoteMode && selectedPosition && selectedPosition.notes.length > 0)
    || (!multiNoteMode && selectedNote)
    || (selectedCell?.stringNumber === null && selectedPosition?.barline === 'single'),
  )
  const chordDisplay = page.chordDisplay ?? DEFAULT_CHORD_DISPLAY

  const closeCellDialog = () => {
    setSelectedCell(null)
    setSelectedSymbol(null)
    setMultiNoteMode(false)
  }

  const openCellDialog = (
    cell: SelectedCell,
    tab: CellDialogTab = 'note',
    symbol: SelectedSymbol | null = null,
  ) => {
    setCellDialogTab(tab)
    setSelectedCell(cell)
    setSelectedSymbol(symbol)
    setMultiNoteMode(false)
  }

  const openBarlineDialog = (measureId: string, positionId: string) => {
    openCellDialog({ measureId, positionId, stringNumber: null }, 'function')
  }

  const openSymbolDialog = (measureId: string, symbol: ScoreSymbol) => {
    const measure = page.measures.find((candidate) => candidate.id === measureId)
    const point = symbol.points[0]
    if (!measure || !point) return

    openCellDialog(
      { measureId, positionId: point.positionId, stringNumber: point.string },
      'note',
      {
        measureId,
        symbolId: symbol.id,
        label: scoreSymbolLabel(symbol, measure.positions),
      },
    )
    setSymbolNotice('')
  }

  const clearCurrentTarget = () => {
    if (!selectedCell) return

    if (multiNoteMode && selectedPosition) {
      updatePositionNotes(selectedCell.measureId, selectedCell.positionId, [])
      closeCellDialog()
      return
    }

    if (selectedSymbol) {
      removeSymbol(selectedSymbol.measureId, selectedSymbol.symbolId)
      closeCellDialog()
      return
    }

    if (selectedCell.stringNumber !== null) {
      updateFret(
        selectedCell.measureId,
        selectedCell.positionId,
        selectedCell.stringNumber,
        null,
      )
    } else if (selectedPosition?.barline === 'single') {
      updateBarline(selectedCell.measureId, selectedCell.positionId, null)
    }

    closeCellDialog()
  }

  const startMultiNote = () => {
    if (!selectedCell) return
    setCellDialogTab('note')
    setSelectedSymbol(null)
    setMultiNoteMode(true)
  }

  /** 点选音级；再次点击同一个音级会取消该弦的音符。 */
  const toggleMultiNote = (stringNumber: number, fret: FretValue) => {
    if (!selectedCell || !selectedPosition) return
    const currentNote = selectedPosition.notes.find((note) => note.string === stringNumber)

    if (currentNote?.fret === fret) {
      updateFret(
        selectedCell.measureId,
        selectedCell.positionId,
        stringNumber,
        null,
      )
      return
    }

    updateFret(
      selectedCell.measureId,
      selectedCell.positionId,
      stringNumber,
      fret,
    )
  }

  /** 一键把六根弦都设为闷音 X。 */
  const selectAllMultiNoteMuted = () => {
    if (!selectedCell) return
    updatePositionNotes(
      selectedCell.measureId,
      selectedCell.positionId,
      Array.from({ length: 6 }, (_, index) => ({
        string: index + 1,
        fret: 'X' as const,
      })),
    )
  }

  /** 只保存真正选中的音，不再自动补 X；快捷模式下继续跳到下一列。 */
  const finishMultiNote = () => {
    if (selectedCell && selectedPosition) {
      updatePositionNotes(
        selectedCell.measureId,
        selectedCell.positionId,
        selectedPosition.notes,
      )
      if (quickFillEnabled) advanceQuickTargetToNextPosition(selectedCell)
    }
    closeCellDialog()
  }

  const chooseFret = (fret: FretValue | null) => {
    if (!selectedCell || selectedCell.stringNumber === null) return
    updateFret(
      selectedCell.measureId,
      selectedCell.positionId,
      selectedCell.stringNumber,
      fret,
    )
    closeCellDialog()
  }

  const chooseBarline = (barline: 'single' | null) => {
    if (!selectedCell) return
    updateBarline(selectedCell.measureId, selectedCell.positionId, barline)
    closeCellDialog()
  }

  const chooseRangeSymbol = (type: OnePointSymbolType, range: StringRange) => {
    if (!selectedCell) return
    addSymbol(selectedCell.measureId, {
      type,
      points: [{
        positionId: selectedCell.positionId,
        string: null,
      }],
      range,
    })
    closeCellDialog()
    setSymbolNotice('')
  }

  const startTwoPointSymbol = (type: TwoPointSymbolType) => {
    if (!selectedCell || selectedCell.stringNumber === null) {
      setSymbolNotice('请先点击一个具体的音符位置，再选择两点符号。')
      return
    }

    const measureIndex = page.measures.findIndex((measure) => measure.id === selectedCell.measureId)
    const measure = page.measures[measureIndex]
    const positionIndex = measure?.positions.findIndex(
      (position) => position.id === selectedCell.positionId,
    ) ?? -1

    setPendingSymbol({
      type,
      measureId: selectedCell.measureId,
      start: {
        positionId: selectedCell.positionId,
        string: selectedCell.stringNumber,
      },
      startLabel: `第 ${measureIndex + 1} 行第 ${positionIndex + 1} 列，第 ${selectedCell.stringNumber} 弦`,
    })
    closeCellDialog()
    setSymbolNotice('')
  }

  const cancelPendingSymbol = () => {
    setPendingSymbol(null)
    setSymbolNotice('')
  }

  const handleNoteClick = (cell: SelectedCell) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    lastAnchorRef.current = {
      measureId: cell.measureId,
      positionId: cell.positionId,
    }

    if (isSelectMode) {
      if (cell.stringNumber === null) return

      const measure = page.measures.find((candidate) => candidate.id === cell.measureId)
      const position = measure?.positions.find(
        (candidate) => candidate.id === cell.positionId,
      )
      const hasNote = position?.notes.some(
        (note) => note.string === cell.stringNumber,
      )
      if (hasNote) {
        toggleNodeSelection(cell.measureId, cell.positionId, cell.stringNumber)
      }
      return
    }

    if (!pendingSymbol) {
      openCellDialog(cell)
      return
    }

    if (cell.stringNumber === null) return
    if (cell.measureId !== pendingSymbol.measureId) {
      setSymbolNotice('请在同一个谱行内选择第二个位置。')
      return
    }
    if (cell.positionId === pendingSymbol.start.positionId) {
      setSymbolNotice('请选择另一个音符位置。')
      return
    }
    if (cell.stringNumber !== pendingSymbol.start.string) {
      setSymbolNotice('击弦、勾弦和延音线需要连接同一根弦上的两个位置。')
      return
    }

    addSymbol(pendingSymbol.measureId, {
      type: pendingSymbol.type,
      points: [
        pendingSymbol.start,
        { positionId: cell.positionId, string: cell.stringNumber },
      ],
      range: null,
    })
    setPendingSymbol(null)
    setSymbolNotice('')
  }

  const pasteCopiedNotes = () => {
    if (!selectedCell || clipboard.length === 0) return
    pasteAt(selectedCell.measureId, selectedCell.positionId)
    closeCellDialog()
  }

  const openLyricDialog = (lyric: SelectedLyric) => {
    setLyricDraft(lyric.text)
    setSelectedLyric(lyric)
  }

  const saveLyric = () => {
    if (!selectedLyric || !lyricDraft.trim()) return
    updateLyricLine(selectedLyric.measureId, selectedLyric.index, lyricDraft)
    setSelectedLyric(null)
  }

  const clearLyric = () => {
    if (!selectedLyric || !selectedLyric.text) return
    updateLyricLine(selectedLyric.measureId, selectedLyric.index, null)
    setSelectedLyric(null)
  }

  useEffect(() => {
    const closeOpenEditor = () => {
      setSelectedCell(null)
      setSelectedSymbol(null)
      setPendingSymbol(null)
      setMultiNoteMode(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof Element
        && event.target.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }

      const state = useScoreStore.getState()
      const modifier = event.metaKey || event.ctrlKey

      if (!modifier) {
        if (event.key === 'Escape' && state.isSelectMode) {
          event.preventDefault()
          state.toggleSelectMode()
          setMarquee(null)
        }
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'z') {
        const canRun = event.shiftKey ? state.canRedo : state.canUndo
        if (!canRun) return
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        closeOpenEditor()
        return
      }

      if (key === 'y') {
        if (!state.canRedo) return
        event.preventDefault()
        state.redo()
        closeOpenEditor()
        return
      }

      if (key === 'c') {
        if (!state.isSelectMode || state.selectedNodes.length === 0) return
        event.preventDefault()
        state.copySelection()
        return
      }

      if (key === 'v') {
        const anchor = lastAnchorRef.current
        if (!anchor || state.clipboard.length === 0) return
        event.preventDefault()
        state.pasteAt(anchor.measureId, anchor.positionId)
        closeOpenEditor()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (!isSelectMode) {
      marqueeDragRef.current = null
      return
    }

    const collectNodes = (
      container: HTMLElement,
      rect: { left: number; top: number; right: number; bottom: number },
    ) => {
      const nodes = container.querySelectorAll<HTMLElement>(
        '.note-grid button.has-note',
      )
      return Array.from(nodes).flatMap((node) => {
        const nodeRect = node.getBoundingClientRect()
        // 用节点中心点判断框选，避免边缘擦过时误选。
        const centerX = nodeRect.left + nodeRect.width / 2
        const centerY = nodeRect.top + nodeRect.height / 2
        const inside = centerX >= rect.left
          && centerX <= rect.right
          && centerY >= rect.top
          && centerY <= rect.bottom
        if (!inside) return []

        const measureId = node.dataset.measureId
        const positionId = node.dataset.positionId
        const stringNumber = Number(node.dataset.stringNumber)
        if (!measureId || !positionId || !Number.isFinite(stringNumber)) return []

        return [{ measureId, positionId, stringNumber }]
      })
    }

    const updateMarquee = (
      drag: MarqueeDrag,
      clientX: number,
      clientY: number,
    ) => {
      const containerRect = drag.container.getBoundingClientRect()
      const x = Math.min(Math.max(clientX, containerRect.left), containerRect.right)
      const y = Math.min(Math.max(clientY, containerRect.top), containerRect.bottom)
      const left = Math.min(drag.startClientX, x)
      const top = Math.min(drag.startClientY, y)
      const right = Math.max(drag.startClientX, x)
      const bottom = Math.max(drag.startClientY, y)

      setMarquee({
        left: left - containerRect.left,
        top: top - containerRect.top,
        width: right - left,
        height: bottom - top,
      })
      setSelectedNodes(collectNodes(drag.container, { left, top, right, bottom }))
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return
      const container = event.target.closest<HTMLElement>('.score-systems')
      if (!container) return

      marqueeDragRef.current = {
        container,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false,
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const drag = marqueeDragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      if (!drag.moved) {
        const distance = Math.hypot(
          event.clientX - drag.startClientX,
          event.clientY - drag.startClientY,
        )
        if (distance < 4) return
        drag.moved = true
        suppressClickRef.current = true
      }

      event.preventDefault()
      updateMarquee(drag, event.clientX, event.clientY)
    }

    const finishDrag = (event: PointerEvent) => {
      const drag = marqueeDragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return

      if (drag.moved) {
        updateMarquee(drag, event.clientX, event.clientY)
        window.setTimeout(() => {
          suppressClickRef.current = false
        }, 0)
      } else {
        suppressClickRef.current = false
      }

      marqueeDragRef.current = null
      setMarquee(null)
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove, { passive: false })
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [isSelectMode, setSelectedNodes])

  return (
    <section className="score-editor" aria-label={`${page.title}六线谱编辑器`}>
      {/* 页头：主标题显示谱本名，页名作为副标签，页面副标题保持左对齐。 */}
      <header className="score-intro">
        <p>GUITAR TAB</p>
        <h1>{bookTitle}</h1>
        <div className="score-intro-meta">
          <span className="score-intro-page">{page.title}</span>
        </div>
        {page.subtitle && <p className="score-page-subtitle">{page.subtitle}</p>}
      </header>

      {isSelectMode && (
        <div className="select-mode-banner" role="status" aria-live="polite">
          <div>
            <strong>选择模式</strong>
            <span>点击节点或按住拖动框选 · 已选 {selectedNodes.length} 个</span>
          </div>
          <div className="select-mode-actions">
            <button
              type="button"
              onClick={copySelection}
              disabled={selectedNodes.length === 0}
            >
              复制
            </button>
            <button type="button" onClick={toggleSelectMode}>取消</button>
          </div>
        </div>
      )}

      {pendingSymbol ? (
        <div className="symbol-pending-banner" role="status" aria-live="polite">
          <div>
            <strong>{SCORE_SYMBOL_LABELS[pendingSymbol.type]}</strong>
            <span>已选择 {pendingSymbol.startLabel}，请点击同一根弦上的第二个音符位置。</span>
            {symbolNotice && <em>{symbolNotice}</em>}
          </div>
          <button type="button" onClick={cancelPendingSymbol}>取消</button>
        </div>
      ) : symbolNotice ? (
        <div className="symbol-pending-banner is-notice" role="status" aria-live="polite">
          <span>{symbolNotice}</span>
          <button type="button" onClick={() => setSymbolNotice('')}>知道了</button>
        </div>
      ) : null}

      <div className={`score-systems ${isSelectMode ? 'is-select-mode' : ''}`.trim()}>
        {marquee && (
          <div
            className="selection-marquee"
            style={{
              left: marquee.left,
              top: marquee.top,
              width: marquee.width,
              height: marquee.height,
            }}
            aria-hidden="true"
          />
        )}
        {page.measures.map((measure, measureIndex) => {
          const staffWidth = measure.positions.length * 100
          const gridColumns = `repeat(${measure.positions.length}, minmax(0, 1fr))`

          return (
            <article
              className="score-system"
              key={measure.id}
              aria-label={`第 ${measureIndex + 1} 行六线谱`}
            >
              <div
                className={`chord-row is-${chordDisplay}`}
                aria-label={`第 ${measureIndex + 1} 行和弦`}
                style={{ gridTemplateColumns: gridColumns }}
              >
                {measure.positions.map((position, positionIndex) => (
                  <button
                    className={position.chord ? 'has-chord' : ''}
                    key={position.id}
                    aria-label={position.chord
                      ? `第 ${measureIndex + 1} 小节，第 ${positionIndex + 1} 列，和弦 ${position.chord}`
                      : '添加和弦'}
                    onClick={() => setSelectedChord({ measureId: measure.id, positionId: position.id })}
                  >
                    {position.chord
                      ? <ChordMark chord={position.chord} mode={chordDisplay} />
                      : <span className="chord-hint" aria-hidden="true">新增和弦</span>}
                  </button>
                ))}
              </div>
              <div className="staff-wrap">
                <StaffLines width={staffWidth} />
                <div
                  className="function-mark-grid"
                  style={{ gridTemplateColumns: gridColumns }}
                >
                  {measure.positions.map((position, positionIndex) => (
                    <span key={position.id}>
                      {position.barline === 'single' && (
                        <button
                          type="button"
                          className="single-barline-button"
                          aria-label={`第 ${measureIndex + 1} 行第 ${positionIndex + 1} 列单竖线`}
                          title="点击编辑或清除单竖线"
                          onClick={() => openBarlineDialog(measure.id, position.id)}
                        >
                          <i
                            className="single-barline"
                            role="img"
                            aria-label={`第 ${measureIndex + 1} 行第 ${positionIndex + 1} 列单竖线`}
                          />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                <div
                  className="note-grid"
                  style={{ gridTemplateColumns: gridColumns }}
                >
                  {Array.from({ length: 6 }, (_, stringIndex) => {
                    const stringNumber = stringIndex + 1
                    return measure.positions.map((position, positionIndex) => {
                      const note = position.notes.find((candidate) => candidate.string === stringNumber)
                      const label = note
                        ? note.fret === 'X' ? '闷音 X' : `${note.fret} 品`
                        : '空白'
                      const isSymbolStart = pendingSymbol?.measureId === measure.id
                        && pendingSymbol.start.positionId === position.id
                        && pendingSymbol.start.string === stringNumber
                      const isSelectedNode = isSelectMode && selectedNodes.some(
                        (node) =>
                          node.measureId === measure.id
                          && node.positionId === position.id
                          && node.stringNumber === stringNumber,
                      )
                      const isQuickTarget = quickFillEnabled
                        && quickTarget?.measureId === measure.id
                        && quickTarget?.positionId === position.id
                        && quickTarget?.stringNumber === stringNumber
                      return (
                        <button
                          key={`${position.id}-${stringNumber}`}
                          className={[
                            note ? 'has-note' : '',
                            isSymbolStart ? 'is-symbol-start' : '',
                            isSelectedNode ? 'is-selected-node' : '',
                            isQuickTarget ? 'is-quick-target' : '',
                          ].filter(Boolean).join(' ')}
                          aria-pressed={isSelectMode ? isSelectedNode : undefined}
                          data-measure-id={measure.id}
                          data-position-id={position.id}
                          data-string-number={stringNumber}
                          aria-label={`第 ${measureIndex + 1} 小节，第 ${positionIndex + 1} 列，${stringNumber} 弦，${label}`}
                          onClick={() => {
                            if (quickFillEnabled && !isSelectMode) {
                              setQuickTarget({
                                measureId: measure.id,
                                positionId: position.id,
                                stringNumber,
                              })
                              return
                            }
                            handleNoteClick({
                              measureId: measure.id,
                              positionId: position.id,
                              stringNumber,
                            })
                          }}
                        >
                          {note && <span className="note-value">{note.fret}</span>}
                        </button>
                      )
                    })
                  })}
                </div>
                <ScoreSymbolLayer
                  symbols={measure.symbols}
                  positions={measure.positions}
                  onSymbolClick={(symbol) => openSymbolDialog(measure.id, symbol)}
                />
              </div>

              <div className="lyrics-area" aria-label={`第 ${measureIndex + 1} 行歌词`}>
                {measure.lyrics.map((lyric, lyricIndex) => (
                  <button
                    className="lyric-line"
                    key={`${measure.id}-${lyricIndex}`}
                    aria-label={`编辑歌词 ${lyric}`}
                    onClick={() => openLyricDialog({
                      measureId: measure.id,
                      index: lyricIndex,
                      text: lyric,
                    })}
                  >
                    <FittedSingleLineText
                      text={lyric}
                      fontSize={16}
                    />
                  </button>
                ))}
                {measure.lyrics.length < 12 && (
                  <button
                    className="add-lyric-line"
                    aria-label={measure.lyrics.length ? '新增一行歌词' : '输入歌词'}
                    onClick={() => openLyricDialog({
                      measureId: measure.id,
                      index: measure.lyrics.length,
                      text: '',
                    })}
                  >
                    {measure.lyrics.length ? '新增一行歌词' : '输入歌词'}
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      <footer className="score-page-footer">
        <span className="score-page-footer-side">{page.footerLeft}</span>
        <span className="score-page-footer-side is-right">{page.footerRight}</span>
      </footer>

      <button
        type="button"
        className={`quick-fill-toggle${quickFillEnabled ? ' is-active' : ''}`}
        onClick={toggleQuickFill}
        aria-pressed={quickFillEnabled}
        aria-label={quickFillEnabled
          ? '关闭快捷填写。数字 0 到 6 填写音级，X 填写闷音，L 填写或取消单竖线，D 打开单节多音，上下方向键切换弦，删除键删除上一个节点。'
          : '开启快捷填写。数字 0 到 6 填写音级，X 填写闷音，L 填写或取消单竖线，D 打开单节多音，上下方向键切换弦，删除键删除上一个节点。'}
        title={quickFillEnabled
          ? '快捷填写已开启：0–6 音级 · X 闷音 · L 单竖线 · D 单节多音 · ↑↓ 换弦 · Delete 删上一格（点击关闭）'
          : '快捷填写：0–6 音级 · X 闷音 · L 单竖线 · D 单节多音 · ↑↓ 换弦 · Delete 删上一格'}
      >
        <Lightning size={22} weight={quickFillEnabled ? 'fill' : 'regular'} />
      </button>

      <DialogShell
        open={selectedCell !== null}
        onOpenChange={(open) => !open && closeCellDialog()}
        title={multiNoteMode
          ? '单节多音'
          : selectedSymbol
            ? selectedSymbol.label
            : selectedCell
              ? cellDialogTab === 'function'
                ? '功能记号'
                : selectedCell.stringNumber === null
                  ? '编辑位置'
                  : `第 ${selectedCell.stringNumber} 弦`
              : '编辑音符'}
        description={multiNoteMode
          ? '点击音级选择，再次点击可取消；X 按钮可一键全选闷音。'
          : selectedSymbol
            ? '当前选中这个符号，可在底部清除，也可以继续编辑当前位置。'
            : cellDialogTab === 'function'
              ? '在当前位置添加单竖线。'
              : '选择音级，或为当前位置添加演奏符号。'}
        footer={(
          <div className="cell-dialog-footer">
            <span className="cell-dialog-selection">
              {multiNoteMode
                ? `单节多音：第 ${selectedPositionIndex + 1} 列`
                : selectedSymbol
                  ? `当前符号：${selectedSymbol.label}`
                  : selectedNote
                    ? `当前音符：${selectedNote.fret === 'X' ? 'X 闷音' : `${selectedNote.fret} 品`}`
                    : selectedCell?.stringNumber === null && selectedPosition?.barline === 'single'
                      ? '当前：单竖线'
                      : ''}
            </span>
            {multiNoteMode ? (
              <button
                type="button"
                className="primary-button multi-note-finish"
                onClick={finishMultiNote}
              >
                完成
              </button>
            ) : (
              <button
                type="button"
                className="clear-cell-button"
                onClick={clearCurrentTarget}
                disabled={!canClear}
              >
                清除
              </button>
            )}
          </div>
        )}
      >
        <div className="cell-editor-tabs" role="tablist" aria-label="音符位置编辑类型">
          <button
            id="cell-note-tab"
            role="tab"
            aria-selected={cellDialogTab === 'note'}
            aria-controls="cell-note-panel"
            onClick={() => {
              setMultiNoteMode(false)
              setCellDialogTab('note')
            }}
          >
            音符
          </button>
          <button
            id="cell-function-tab"
            role="tab"
            aria-selected={cellDialogTab === 'function'}
            aria-controls="cell-function-panel"
            onClick={() => {
              setMultiNoteMode(false)
              setCellDialogTab('function')
            }}
          >
            功能
          </button>
        </div>

        {cellDialogTab === 'note' ? (
          <div id="cell-note-panel" role="tabpanel" aria-labelledby="cell-note-tab">
            {multiNoteMode ? (
              <div className="multi-note-panel">
                <div className="multi-note-heading">
                  <div>
                    <strong>第 {selectedPositionIndex + 1} 列</strong>
                    <span>点击选择，再次点击取消 · X 一键全选</span>
                  </div>
                  <div className="multi-note-actions">
                    <button
                      type="button"
                      onClick={clearCurrentTarget}
                      disabled={!canClear}
                    >
                      清除
                    </button>
                    <button
                      type="button"
                      onClick={selectAllMultiNoteMuted}
                      aria-label="全部选择 X 闷音"
                      title="全部选择 X 闷音"
                    >
                      X
                    </button>
                  </div>
                </div>
                <div className="multi-note-grid">
                  {Array.from({ length: 6 }, (_, stringIndex) => {
                    const stringNumber = stringIndex + 1
                    const note = selectedPosition?.notes.find(
                      (candidate) => candidate.string === stringNumber,
                    )
                    const selectedFret = note?.fret ?? null
                    return (
                      <div className="multi-note-row" key={stringNumber}>
                        <span className="multi-note-string">{stringNumber} 弦</span>
                        {fretChoices.map((fret) => (
                          <button
                            key={fret}
                            type="button"
                            className={selectedFret === fret ? 'is-selected' : ''}
                            aria-pressed={selectedFret === fret}
                            onClick={() => toggleMultiNote(stringNumber, fret)}
                            aria-label={`${stringNumber} 弦 ${fret === 'X' ? '闷音 X' : `${fret} 品`}`}
                          >
                            {fret}
                          </button>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="cell-option-list">
                <div className="cell-option-row cell-option-row--level">
                  <div className="cell-option-name">
                    <strong>音级</strong>
                    <small>X 闷音 · 0 空弦</small>
                  </div>
                  <div className="fret-picker" role="group" aria-label="音级">
                    {fretChoices.map((fret) => (
                      <button
                        key={fret}
                        type="button"
                        onClick={() => chooseFret(fret)}
                        aria-label={fret === 'X' ? '闷音 X' : `${fret} 品`}
                        disabled={selectedCell?.stringNumber === null}
                      >
                        {fret}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cell-option-row">
                  <span className="cell-option-name">
                    <MultiNoteSwatch />
                    <span>
                      <strong>单节多音</strong>
                      <small>同一点竖向设置多个音级</small>
                    </span>
                  </span>
                  <span className="cell-option-actions">
                    <button
                      type="button"
                      onClick={startMultiNote}
                      aria-label="编辑单节多音"
                    >
                      编辑
                    </button>
                  </span>
                </div>

                {ONE_POINT_SYMBOLS.map(({ type, label, description }) => (
                  <div className="cell-option-row" key={type}>
                    <span className="cell-option-name">
                      <SymbolSwatch type={type} />
                      <span>
                        <strong>{label}</strong>
                        <small>{description}</small>
                      </span>
                    </span>
                    <span className="cell-option-actions">
                      {STRING_RANGES.map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => chooseRangeSymbol(type, range)}
                          aria-label={`添加${label} ${STRING_RANGE_LABELS[range]}`}
                        >
                          {STRING_RANGE_LABELS[range]}
                        </button>
                      ))}
                    </span>
                  </div>
                ))}

                {TWO_POINT_SYMBOLS.map(({ type, label }) => (
                  <div className="cell-option-row" key={type}>
                    <span className="cell-option-name">
                      <SymbolSwatch type={type} />
                      <span>
                        <strong>{label}</strong>
                        <small>两点连线</small>
                      </span>
                    </span>
                    <span className="cell-option-actions">
                      <button
                        type="button"
                        onClick={() => startTwoPointSymbol(type)}
                        aria-label={`添加${label}`}
                        disabled={selectedCell?.stringNumber === null}
                      >
                        选择
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="function-panel"
            id="cell-function-panel"
            role="tabpanel"
            aria-labelledby="cell-function-tab"
          >
            <div className="cell-option-list">
              <div className="cell-option-row">
                <span className="cell-option-name">
                  <span className="barline-preview" aria-hidden="true" />
                  <span>
                    <strong>单竖线</strong>
                    <small>当前音符位置</small>
                  </span>
                </span>
                <span className="cell-option-actions">
                  <button
                    type="button"
                    onClick={() => chooseBarline('single')}
                    aria-label="添加单竖线"
                  >
                    添加
                  </button>
                </span>
              </div>

              {clipboard.length > 0 && (
                <div className="cell-option-row">
                  <span className="cell-option-name">
                    <ClipboardText size={18} className="cell-option-icon" aria-hidden="true" />
                    <span>
                      <strong>粘贴</strong>
                      <small>从当前位置向后粘贴 {clipboard.length} 个音符</small>
                    </span>
                  </span>
                  <span className="cell-option-actions">
                    <button
                      type="button"
                      onClick={pasteCopiedNotes}
                      aria-label="粘贴音符"
                    >
                      粘贴
                    </button>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogShell>

      <DialogShell
        open={selectedLyric !== null}
        onOpenChange={(open) => !open && setSelectedLyric(null)}
        title={selectedLyric?.text ? '编辑歌词' : '输入歌词'}
        description="歌词会完整显示在当前谱表下方。"
      >
        <form
          className="lyric-form"
          onSubmit={(event) => {
            event.preventDefault()
            saveLyric()
          }}
        >
          <label htmlFor="lyric-content">歌词内容</label>
          <textarea
            id="lyric-content"
            maxLength={300}
            rows={4}
            value={lyricDraft}
            onChange={(event) => setLyricDraft(event.target.value)}
            autoFocus
          />
          <div className="lyric-form-meta">{lyricDraft.length} / 300</div>
          <div className="lyric-form-actions">
            {selectedLyric?.text && (
              <button type="button" className="clear-lyric" onClick={clearLyric}>清除这行歌词</button>
            )}
            <button type="submit" className="primary-button" disabled={!lyricDraft.trim()}>保存歌词</button>
          </div>
        </form>
      </DialogShell>

      <ChordDialog
        open={selectedChord !== null}
        onOpenChange={(open) => !open && setSelectedChord(null)}
        onChoose={(chord) => {
          if (!selectedChord) return
          updateChord(selectedChord.measureId, selectedChord.positionId, chord)
        }}
      />
    </section>
  )
}
