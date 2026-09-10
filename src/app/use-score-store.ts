import { create } from 'zustand'

import {
  createScoreBook,
  createScorePage,
  scoreBookSchema,
  setFretAtPosition,
  type BarlineStyle,
  type FretValue,
  type ImagePage,
  type ScoreBook,
  type ScorePage,
} from '../domain/score/score-document'
import { scoreDb } from '../data/score-db'
import {
  addMeasure,
  appendPage,
  setBarline,
  setChord,
  setLyricLine,
  updateScorePage,
} from '../domain/score/score-operations'

interface ScoreStore {
  books: ScoreBook[]
  activeBookId: string | null
  activePageId: string | null
  isDirty: boolean
  dirtyBookIds: string[]
  isHydrated: boolean
  hydrate: () => Promise<void>
  saveActiveBook: () => Promise<void>
  importBooks: (books: ScoreBook[]) => Promise<void>
  createBook: (title: string) => void
  goHome: () => void
  selectBook: (bookId: string) => void
  selectPage: (pageId: string) => void
  addScorePage: (title: string) => void
  addImagePage: (page: ImagePage) => void
  addMeasure: () => void
  updateFret: (
    measureId: string,
    positionId: string,
    stringNumber: number,
    fret: FretValue | null,
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
}

function updateActivePage(
  state: ScoreStore,
  transform: (page: ScorePage) => ScorePage,
): Partial<ScoreStore> {
  const book = state.books.find((candidate) => candidate.id === state.activeBookId)
  const page = book?.pages.find((candidate) => candidate.id === state.activePageId)
  if (!book || !page || page.type !== 'score') return {}

  const updatedBook = updateScorePage(book, transform(page))
  return {
    books: state.books.map((candidate) =>
      candidate.id === updatedBook.id ? updatedBook : candidate,
    ),
    isDirty: true,
    dirtyBookIds: state.dirtyBookIds.includes(book.id)
      ? state.dirtyBookIds
      : [...state.dirtyBookIds, book.id],
  }
}

export const useScoreStore = create<ScoreStore>((set, get) => ({
  books: [],
  activeBookId: null,
  activePageId: null,
  isDirty: false,
  dirtyBookIds: [],
  isHydrated: false,

  hydrate: async () => {
    try {
      const storedBooks = await scoreDb.books.orderBy('updatedAt').reverse().toArray()
      const books = storedBooks.map((book) => scoreBookSchema.parse(book))
      set({
        books,
        activeBookId: books[0]?.id ?? null,
        activePageId: books[0]?.pages[0]?.id ?? null,
        isDirty: false,
        dirtyBookIds: [],
        isHydrated: true,
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
      const dirtyBookIds = state.dirtyBookIds.filter((bookId) => !importedIds.has(bookId))
      return {
        books,
        activeBookId: activeBook.id,
        activePageId: activeBook.pages[0]?.id ?? null,
        isDirty: false,
        dirtyBookIds,
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
    }))
  },

  goHome: () => set({ activeBookId: null, activePageId: null, isDirty: false }),

  selectBook: (bookId) =>
    set((state) => {
      const book = state.books.find((candidate) => candidate.id === bookId)
      return {
        activeBookId: bookId,
        activePageId: book?.pages[0]?.id ?? null,
        isDirty: state.dirtyBookIds.includes(bookId),
      }
    }),

  selectPage: (pageId) => set({ activePageId: pageId }),

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
        isDirty: true,
        dirtyBookIds: state.dirtyBookIds.includes(book.id)
          ? state.dirtyBookIds
          : [...state.dirtyBookIds, book.id],
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
        isDirty: true,
        dirtyBookIds: state.dirtyBookIds.includes(book.id)
          ? state.dirtyBookIds
          : [...state.dirtyBookIds, book.id],
      }
    }),

  addMeasure: () => set((state) => updateActivePage(state, addMeasure)),

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
}))
