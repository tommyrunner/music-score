/**
 * 应用级谱本状态、编辑历史与 IndexedDB 持久化。
 */

import { create } from 'zustand'

import {
  createScoreBook,
  createScorePage,
  PAGE_FOOTER_LEFT_MAX_LENGTH,
  PAGE_FOOTER_RIGHT_MAX_LENGTH,
  SCORE_SUBTITLE_MAX_LENGTH,
  scoreBookSchema,
  setFretAtPosition,
  type BarlineStyle,
  type FretValue,
  type ImagePage,
  type ScoreBook,
  type ScorePage,
  type ScoreSymbol,
} from '../domain/score/score-document'
import { scoreDb } from '../data/score-db'
import {
  addMeasure,
  addSymbol as addSymbolToPage,
  appendPage,
  pasteNotesFrom,
  removeSymbol as removeSymbolFromPage,
  setBarline,
  setChord,
  setLyricLine,
  setPositionNotes as setPositionNotesOnPage,
  updateScorePage,
  type ScoreClipboardNote,
} from '../domain/score/score-operations'

interface SelectedNode {
  measureId: string
  positionId: string
  stringNumber: number
}

interface PageInfoPatch {
  title: string
  subtitle?: string
  footerLeft?: string
  footerRight?: string
}

interface PageHistory {
  past: ScorePage[]
  future: ScorePage[]
}

const HISTORY_LIMIT = 60

interface ScoreStore {
  books: ScoreBook[]
  activeBookId: string | null
  activePageId: string | null
  isDirty: boolean
  dirtyBookIds: string[]
  isHydrated: boolean
  history: Record<string, PageHistory>
  canUndo: boolean
  canRedo: boolean
  isSelectMode: boolean
  selectedNodes: SelectedNode[]
  clipboard: ScoreClipboardNote[]
  hydrate: () => Promise<void>
  saveActiveBook: () => Promise<void>
  importBooks: (books: ScoreBook[]) => Promise<void>
  createBook: (title: string) => void
  deleteBook: (bookId: string) => Promise<void>
  goHome: () => void
  selectBook: (bookId: string) => void
  selectPage: (pageId: string) => void
  addScorePage: (title: string) => void
  addImagePage: (page: ImagePage) => void
  updatePageInfo: (pageId: string, info: PageInfoPatch) => void
  addMeasure: () => void
  undo: () => void
  redo: () => void
  toggleSelectMode: () => void
  toggleNodeSelection: (
    measureId: string,
    positionId: string,
    stringNumber: number,
  ) => void
  setSelectedNodes: (nodes: SelectedNode[]) => void
  copySelection: () => void
  pasteAt: (measureId: string, positionId: string) => void
  updateFret: (
    measureId: string,
    positionId: string,
    stringNumber: number,
    fret: FretValue | null,
  ) => void
  updatePositionNotes: (
    measureId: string,
    positionId: string,
    notes: ScoreClipboardNote[],
  ) => void
  updateChord: (measureId: string, positionId: string, chord: string) => void
  updateBarline: (
    measureId: string,
    positionId: string,
    barline: BarlineStyle | null,
  ) => void
  updateLyricLine: (
    measureId: string,
    lyricIndex: number,
    text: string | null,
  ) => void
  addSymbol: (measureId: string, symbol: Omit<ScoreSymbol, 'id'>) => void
  removeSymbol: (measureId: string, symbolId: string) => void
}

function findActivePage(state: ScoreStore) {
  const book = state.books.find((candidate) => candidate.id === state.activeBookId)
  const page = book?.pages.find((candidate) => candidate.id === state.activePageId)
  return book && page && page.type === 'score' ? { book, page } : null
}

function markBookDirty(state: ScoreStore, bookId: string): Partial<ScoreStore> {
  return {
    isDirty: true,
    dirtyBookIds: state.dirtyBookIds.includes(bookId)
      ? state.dirtyBookIds
      : [...state.dirtyBookIds, bookId],
  }
}

function historyFlags(state: ScoreStore, pageId: string | null) {
  const history = pageId ? state.history[pageId] : null
  return {
    canUndo: Boolean(history?.past.length),
    canRedo: Boolean(history?.future.length),
  }
}

function updateActivePage(
  state: ScoreStore,
  transform: (page: ScorePage) => ScorePage,
): Partial<ScoreStore> {
  const active = findActivePage(state)
  if (!active) return {}

  const { book, page } = active
  const nextPage = transform(page)
  const updatedBook = updateScorePage(book, nextPage)
  const history = state.history[page.id] ?? { past: [], future: [] }
  // 每页只保留最近 60 步，避免长时间编辑占用过多内存。
  const past = [...history.past, page].slice(-HISTORY_LIMIT)

  return {
    books: state.books.map((candidate) =>
      candidate.id === updatedBook.id ? updatedBook : candidate,
    ),
    ...markBookDirty(state, book.id),
    history: {
      ...state.history,
      [page.id]: { past, future: [] },
    },
    canUndo: past.length > 0,
    canRedo: false,
  }
}

/**
 * 全局谱本 store。
 *
 * 集中管理谱本数据、当前页面、编辑历史、选择状态和持久化动作。
 */
export const useScoreStore = create<ScoreStore>((set, get) => ({
  books: [],
  activeBookId: null,
  activePageId: null,
  isDirty: false,
  dirtyBookIds: [],
  isHydrated: false,
  history: {},
  canUndo: false,
  canRedo: false,
  isSelectMode: false,
  selectedNodes: [],
  clipboard: [],

  hydrate: async () => {
    try {
      const storedBooks = await scoreDb.books.orderBy('updatedAt').reverse().toArray()
      const books = storedBooks.map((book) => scoreBookSchema.parse(book))
      set({
        books,
        activeBookId: null,
        activePageId: null,
        isDirty: false,
        dirtyBookIds: [],
        isHydrated: true,
        history: {},
        canUndo: false,
        canRedo: false,
        isSelectMode: false,
        selectedNodes: [],
        clipboard: [],
      })
    } catch {
      set({ isHydrated: true })
    }
  },

  saveActiveBook: async () => {
    const state = get()
    const book = state.books.find((candidate) => candidate.id === state.activeBookId)
    if (!book) return
    await scoreDb.books.put(book)
    set((latestState) => {
      const latestBook = latestState.books.find((candidate) => candidate.id === book.id)
      if (latestBook !== book) return {}
      const dirtyBookIds = latestState.dirtyBookIds.filter((bookId) => bookId !== book.id)
      return {
        dirtyBookIds,
        isDirty: latestState.activeBookId !== null
          && dirtyBookIds.includes(latestState.activeBookId),
      }
    })
  },

  importBooks: async (importedBooks) => {
    if (importedBooks.length === 0) return
    const uniqueBooks = [...new Map(importedBooks.map((book) => [book.id, book])).values()]
    await scoreDb.books.bulkPut(uniqueBooks)
    set((state) => {
      const importedIds = new Set(uniqueBooks.map((book) => book.id))
      const books = [
        ...state.books.filter((book) => !importedIds.has(book.id)),
        ...uniqueBooks,
      ]
      const activeBook = uniqueBooks[0]
      // 从首页批量导入时保持首页；从编辑页导入时才切换到导入的谱本。
      const stayHome = state.activeBookId === null
      const dirtyBookIds = state.dirtyBookIds.filter((bookId) => !importedIds.has(bookId))
      return {
        books,
        activeBookId: stayHome ? null : activeBook.id,
        activePageId: stayHome ? null : activeBook.pages[0]?.id ?? null,
        isDirty: false,
        dirtyBookIds,
        history: {},
        canUndo: false,
        canRedo: false,
        isSelectMode: false,
        selectedNodes: [],
        clipboard: [],
      }
    })
  },

  createBook: (title) => {
    const book = createScoreBook(title)
    set((state) => ({
      books: [...state.books, book],
      activeBookId: book.id,
      activePageId: null,
      isDirty: true,
      dirtyBookIds: state.dirtyBookIds.includes(book.id)
        ? state.dirtyBookIds
        : [...state.dirtyBookIds, book.id],
      canUndo: false,
      canRedo: false,
      isSelectMode: false,
      selectedNodes: [],
    }))
  },

  deleteBook: async (bookId) => {
    const removedBook = get().books.find((book) => book.id === bookId)
    if (!removedBook) return

    await scoreDb.books.delete(bookId)
    set((state) => {
      const pageIds = new Set(removedBook.pages.map((page) => page.id))
      const history = Object.fromEntries(
        Object.entries(state.history).filter(([pageId]) => !pageIds.has(pageId)),
      )
      const removedActive = state.activeBookId === bookId

      return {
        books: state.books.filter((book) => book.id !== bookId),
        activeBookId: removedActive ? null : state.activeBookId,
        activePageId: removedActive ? null : state.activePageId,
        isDirty: removedActive ? false : state.isDirty,
        dirtyBookIds: state.dirtyBookIds.filter((id) => id !== bookId),
        history,
        canUndo: removedActive ? false : state.canUndo,
        canRedo: removedActive ? false : state.canRedo,
        isSelectMode: removedActive ? false : state.isSelectMode,
        selectedNodes: removedActive ? [] : state.selectedNodes,
        clipboard: removedActive ? [] : state.clipboard,
      }
    })
  },

  goHome: () => set({
    activeBookId: null,
    activePageId: null,
    isDirty: false,
    canUndo: false,
    canRedo: false,
    isSelectMode: false,
    selectedNodes: [],
  }),

  selectBook: (bookId) =>
    set((state) => {
      const book = state.books.find((candidate) => candidate.id === bookId)
      const pageId = book?.pages[0]?.id ?? null
      return {
        activeBookId: bookId,
        activePageId: pageId,
        isDirty: state.dirtyBookIds.includes(bookId),
        ...historyFlags(state, pageId),
        isSelectMode: false,
        selectedNodes: [],
      }
    }),

  selectPage: (pageId) =>
    set((state) => ({
      activePageId: pageId,
      ...historyFlags(state, pageId),
      isSelectMode: false,
      selectedNodes: [],
    })),

  addScorePage: (title) =>
    set((state) => {
      const book = state.books.find((candidate) => candidate.id === state.activeBookId)
      if (!book) return {}
      const page = createScorePage(title)
      const updatedBook = appendPage(book, page)
      return {
        books: state.books.map((candidate) =>
          candidate.id === updatedBook.id ? updatedBook : candidate,
        ),
        activePageId: page.id,
        ...markBookDirty(state, book.id),
        canUndo: false,
        canRedo: false,
        isSelectMode: false,
        selectedNodes: [],
      }
    }),

  addImagePage: (page) =>
    set((state) => {
      const book = state.books.find((candidate) => candidate.id === state.activeBookId)
      if (!book) return {}
      const updatedBook = appendPage(book, page)
      return {
        books: state.books.map((candidate) =>
          candidate.id === updatedBook.id ? updatedBook : candidate,
        ),
        activePageId: page.id,
        ...markBookDirty(state, book.id),
        canUndo: false,
        canRedo: false,
        isSelectMode: false,
        selectedNodes: [],
      }
    }),

  updatePageInfo: (pageId, info) =>
    set((state) => {
      const trimmedTitle = info.title.trim().slice(0, 80)
      if (!trimmedTitle) return {}

      const book = state.books.find((candidate) =>
        candidate.pages.some((page) => page.id === pageId),
      )
      const page = book?.pages.find((candidate) => candidate.id === pageId)
      if (!book || !page) return {}

      if (page.type === 'score') {
        const nextPage: ScorePage = {
          ...page,
          title: trimmedTitle,
          subtitle: (info.subtitle ?? page.subtitle)
            .trim()
            .slice(0, SCORE_SUBTITLE_MAX_LENGTH),
          footerLeft: (info.footerLeft ?? page.footerLeft)
            .trim()
            .slice(0, PAGE_FOOTER_LEFT_MAX_LENGTH),
          footerRight: (info.footerRight ?? page.footerRight)
            .trim()
            .slice(0, PAGE_FOOTER_RIGHT_MAX_LENGTH),
        }
        const changed = nextPage.title !== page.title
          || nextPage.subtitle !== page.subtitle
          || nextPage.footerLeft !== page.footerLeft
          || nextPage.footerRight !== page.footerRight
        if (!changed) return {}

        const active = findActivePage(state)
        if (active?.page.id === pageId) {
          return updateActivePage(state, () => nextPage)
        }

        const updatedBook: ScoreBook = {
          ...book,
          pages: book.pages.map((candidate) =>
            candidate.id === pageId ? nextPage : candidate,
          ),
          updatedAt: new Date().toISOString(),
        }

        return {
          books: state.books.map((candidate) =>
            candidate.id === updatedBook.id ? updatedBook : candidate,
          ),
          ...markBookDirty(state, book.id),
        }
      }

      if (page.title === trimmedTitle) return {}

      const updatedBook: ScoreBook = {
        ...book,
        pages: book.pages.map((candidate) =>
          candidate.id === pageId ? { ...candidate, title: trimmedTitle } : candidate,
        ),
        updatedAt: new Date().toISOString(),
      }

      return {
        books: state.books.map((candidate) =>
          candidate.id === updatedBook.id ? updatedBook : candidate,
        ),
        ...markBookDirty(state, book.id),
      }
    }),

  addMeasure: () => set((state) => updateActivePage(state, addMeasure)),

  undo: () =>
    set((state) => {
      const active = findActivePage(state)
      if (!active) return {}

      const { book, page } = active
      const history = state.history[page.id]
      if (!history || history.past.length === 0) return {}

      const previous = history.past[history.past.length - 1]
      const past = history.past.slice(0, -1)
      const future = [page, ...history.future]
      const updatedBook = updateScorePage(book, previous)

      return {
        books: state.books.map((candidate) =>
          candidate.id === updatedBook.id ? updatedBook : candidate,
        ),
        ...markBookDirty(state, book.id),
        history: {
          ...state.history,
          [page.id]: { past, future },
        },
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        isSelectMode: false,
        selectedNodes: [],
      }
    }),

  redo: () =>
    set((state) => {
      const active = findActivePage(state)
      if (!active) return {}

      const { book, page } = active
      const history = state.history[page.id]
      if (!history || history.future.length === 0) return {}

      const next = history.future[0]
      const past = [...history.past, page].slice(-HISTORY_LIMIT)
      const future = history.future.slice(1)
      const updatedBook = updateScorePage(book, next)

      return {
        books: state.books.map((candidate) =>
          candidate.id === updatedBook.id ? updatedBook : candidate,
        ),
        ...markBookDirty(state, book.id),
        history: {
          ...state.history,
          [page.id]: { past, future },
        },
        canUndo: past.length > 0,
        canRedo: future.length > 0,
        isSelectMode: false,
        selectedNodes: [],
      }
    }),

  toggleSelectMode: () =>
    set((state) => state.isSelectMode
      ? { isSelectMode: false, selectedNodes: [] }
      : { isSelectMode: true, selectedNodes: [] }),

  toggleNodeSelection: (measureId, positionId, stringNumber) =>
    set((state) => {
      if (!state.isSelectMode) return {}

      const selected = state.selectedNodes.find(
        (node) =>
          node.measureId === measureId
          && node.positionId === positionId
          && node.stringNumber === stringNumber,
      )
      const selectedNodes = selected
        ? state.selectedNodes.filter((node) => node !== selected)
        : [...state.selectedNodes, { measureId, positionId, stringNumber }]

      return { selectedNodes }
    }),

  setSelectedNodes: (nodes) =>
    set((state) => state.isSelectMode ? { selectedNodes: nodes } : {}),

  copySelection: () =>
    set((state) => {
      const active = findActivePage(state)
      if (!active || state.selectedNodes.length === 0) return {}

      const measureIndexes = new Map(
        active.page.measures.map((measure, index) => [measure.id, index]),
      )
      const notes = state.selectedNodes.flatMap((node) => {
        const measureIndex = measureIndexes.get(node.measureId)
        if (measureIndex === undefined) return []

        const measure = active.page.measures[measureIndex]
        const positionIndex = measure.positions.findIndex(
          (position) => position.id === node.positionId,
        )
        if (positionIndex < 0) return []

        const position = measure.positions[positionIndex]
        const note = position.notes.find(
          (candidate) => candidate.string === node.stringNumber,
        )
        if (!note) return []

        return [{ note: { string: note.string, fret: note.fret }, measureIndex, positionIndex }]
      })

      if (notes.length === 0) return {}

      notes.sort(
        (left, right) =>
          left.measureIndex - right.measureIndex
          || left.positionIndex - right.positionIndex
          || left.note.string - right.note.string,
      )

      return {
        clipboard: notes.map(({ note }) => note),
        isSelectMode: false,
        selectedNodes: [],
      }
    }),

  pasteAt: (measureId, positionId) =>
    set((state) => {
      if (state.clipboard.length === 0) return {}

      return updateActivePage(state, (page) =>
        pasteNotesFrom(page, measureId, positionId, state.clipboard),
      )
    }),

  updatePositionNotes: (measureId, positionId, notes) =>
    set((state) =>
      updateActivePage(state, (page) =>
        setPositionNotesOnPage(page, measureId, positionId, notes),
      ),
    ),

  updateFret: (measureId, positionId, stringNumber, fret) =>
    set((state) =>
      updateActivePage(state, (page) =>
        setFretAtPosition(page, measureId, positionId, stringNumber, fret),
      ),
    ),

  updateChord: (measureId, positionId, chord) =>
    set((state) =>
      updateActivePage(state, (page) => setChord(page, measureId, positionId, chord)),
    ),

  updateBarline: (measureId, positionId, barline) =>
    set((state) =>
      updateActivePage(state, (page) =>
        setBarline(page, measureId, positionId, barline),
      ),
    ),

  updateLyricLine: (measureId, lyricIndex, text) =>
    set((state) =>
      updateActivePage(state, (page) =>
        setLyricLine(page, measureId, lyricIndex, text),
      ),
    ),

  addSymbol: (measureId, symbol) =>
    set((state) =>
      updateActivePage(state, (page) =>
        addSymbolToPage(page, measureId, symbol),
      ),
    ),

  removeSymbol: (measureId, symbolId) =>
    set((state) =>
      updateActivePage(state, (page) =>
        removeSymbolFromPage(page, measureId, symbolId),
      ),
    ),
}))
