import { describe, expect, it } from 'vitest'

import { createScoreBook, createScorePage } from './score-document'
import {
  addMeasure,
  appendPage,
  setBarline,
  setChord,
  setLyricLine,
  updateScorePage,
} from './score-operations'

describe('score editing operations', () => {
  it('appends a new page without changing the original document', () => {
    const book = createScoreBook('公路歌集')
    const page = createScorePage('前奏')

    const next = appendPage(book, page, '2026-09-10T10:00:00.000Z')

    expect(book.pages).toEqual([])
    expect(next.pages).toEqual([page])
    expect(next.updatedAt).toBe('2026-09-10T10:00:00.000Z')
  })

  it('adds a fresh sixteen-position measure to a score page', () => {
    const page = createScorePage('间奏')

    const next = addMeasure(page)

    expect(next.measures).toHaveLength(9)
    expect(next.measures[8].positions).toHaveLength(16)
    expect(next.measures[8].id).not.toBe(page.measures[0].id)
  })

  it('sets and clears a chord above one position', () => {
    const page = createScorePage('副歌')
    const measureId = page.measures[0].id
    const positionId = page.measures[0].positions[0].id

    const withChord = setChord(page, measureId, positionId, 'Am')
    const cleared = setChord(withChord, measureId, positionId, '')

    expect(withChord.measures[0].positions[0].chord).toBe('Am')
    expect(cleared.measures[0].positions[0].chord).toBeNull()
  })

  it('sets and clears a functional barline at one position', () => {
    const page = createScorePage('间奏')
    const measureId = page.measures[0].id
    const positionId = page.measures[0].positions[3].id

    const withBarline = setBarline(page, measureId, positionId, 'single')
    const cleared = setBarline(withBarline, measureId, positionId, null)

    expect(withBarline.measures[0].positions[3].barline).toBe('single')
    expect(cleared.measures[0].positions[3].barline).toBeNull()
  })

  it('adds, edits and removes multiple lyric lines below one score line', () => {
    const page = createScorePage('主歌')
    const measureId = page.measures[0].id

    const first = setLyricLine(page, measureId, 0, '第一行歌词')
    const second = setLyricLine(first, measureId, 1, '第二行歌词')
    const edited = setLyricLine(second, measureId, 0, '修改后的歌词')
    const removed = setLyricLine(edited, measureId, 0, null)

    expect(second.measures[0].lyrics).toEqual(['第一行歌词', '第二行歌词'])
    expect(edited.measures[0].lyrics).toEqual(['修改后的歌词', '第二行歌词'])
    expect(removed.measures[0].lyrics).toEqual(['第二行歌词'])
  })

  it('replaces only the selected score page in a book', () => {
    const first = createScorePage('主歌')
    const second = createScorePage('副歌')
    const book = {
      ...createScoreBook('练习册'),
      pages: [first, second],
    }
    const changed = addMeasure(first)

    const next = updateScorePage(book, changed, '2026-09-10T10:00:00.000Z')

    expect(next.pages[0]).toEqual(changed)
    expect(next.pages[1]).toBe(second)
  })
})
