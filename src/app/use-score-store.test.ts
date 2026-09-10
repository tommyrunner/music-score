import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

import { scoreDb } from '../data/score-db'
import { createScoreBook, createScorePage, type ScoreBook } from '../domain/score/score-document'
import { useScoreStore } from './use-score-store'

describe('score store persistence', () => {
  beforeEach(async () => {
    await scoreDb.books.clear()
    useScoreStore.setState({
      books: [],
      activeBookId: null,
      activePageId: null,
      isDirty: false,
      dirtyBookIds: [],
      isHydrated: false,
    })
  })

  it('saves the active book and clears its dirty state', async () => {
    useScoreStore.getState().createBook('本地谱本')
    const bookId = useScoreStore.getState().activeBookId

    await useScoreStore.getState().saveActiveBook()

    expect(await scoreDb.books.get(bookId!)).toEqual(
      useScoreStore.getState().books[0],
    )
    expect(useScoreStore.getState().isDirty).toBe(false)
  })

  it('hydrates saved books and imports multiple documents', async () => {
    const saved = createScoreBook('已经保存')
    const imported = createScoreBook('新导入')
    const importedReplacement = { ...imported, title: '覆盖后的标题' }
    await scoreDb.books.put(saved)

    await useScoreStore.getState().hydrate()
    await useScoreStore.getState().importBooks([imported, importedReplacement])

    expect(useScoreStore.getState().books.map((book) => book.title)).toEqual([
      '已经保存',
      '覆盖后的标题',
    ])
    expect(await scoreDb.books.get(imported.id)).toEqual(importedReplacement)
  })

  it('fills score-line defaults when hydrating data saved by an older version', async () => {
    const page = createScorePage('旧版页面')
    const legacyBook = JSON.parse(JSON.stringify({
      ...createScoreBook('旧版谱本'),
      pages: [page],
    })) as ScoreBook

    for (const measure of legacyBook.pages[0].type === 'score'
      ? legacyBook.pages[0].measures
      : []) {
      measure.positions = measure.positions.slice(0, 8)
      delete (measure as Partial<typeof measure>).lyrics
      for (const position of measure.positions) {
        delete (position as Partial<typeof position>).barline
      }
    }
    await scoreDb.books.put(legacyBook)

    await useScoreStore.getState().hydrate()

    const hydratedPage = useScoreStore.getState().books[0].pages[0]
    expect(hydratedPage.type).toBe('score')
    if (hydratedPage.type !== 'score') return
    expect(hydratedPage.measures[0].lyrics).toEqual([])
    expect(hydratedPage.measures[0].positions).toHaveLength(16)
    expect(hydratedPage.measures[0].positions[0].barline).toBeNull()
  })

  it('returns to the library without discarding unsaved work', () => {
    useScoreStore.getState().createBook('正在写的谱')

    useScoreStore.getState().goHome()

    expect(useScoreStore.getState().activeBookId).toBeNull()
    expect(useScoreStore.getState().activePageId).toBeNull()
    expect(useScoreStore.getState().books[0].title).toBe('正在写的谱')
  })

  it('keeps unsaved state attached to the book that was edited', async () => {
    useScoreStore.getState().createBook('第一本')
    const firstId = useScoreStore.getState().activeBookId!
    await useScoreStore.getState().saveActiveBook()
    useScoreStore.getState().addScorePage('未保存的一页')
    useScoreStore.getState().createBook('第二本')
    const secondId = useScoreStore.getState().activeBookId!

    expect(useScoreStore.getState().isDirty).toBe(true)
    await useScoreStore.getState().saveActiveBook()
    useScoreStore.getState().selectBook(firstId)

    expect(useScoreStore.getState().isDirty).toBe(true)
    expect(useScoreStore.getState().dirtyBookIds).toEqual([firstId])
    expect(await scoreDb.books.get(secondId)).toBeDefined()
  })
})
