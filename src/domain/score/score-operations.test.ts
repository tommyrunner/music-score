import { describe, expect, it } from 'vitest'

import { createScoreBook, createScorePage } from './score-document'
import {
  addMeasure,
  addSymbol,
  appendPage,
  removeSymbol,
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

  it('adds a fresh twenty-four-position measure to a score page', () => {
    const page = createScorePage('间奏')

    const next = addMeasure(page)

    expect(next.measures).toHaveLength(9)
    expect(next.measures[8].positions).toHaveLength(24)
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

  it('adds range and connection symbols and removes them', () => {
    const page = createScorePage('技巧练习')
    const measureId = page.measures[0].id
    const startPositionId = page.measures[0].positions[0].id
    const endPositionId = page.measures[0].positions[3].id

    const withArpeggio = addSymbol(page, measureId, {
      type: 'arpeggio',
      points: [{ positionId: startPositionId, string: null }],
      range: 'upper',
    })
    expect(withArpeggio.measures[0].symbols).toHaveLength(1)

    const replaced = addSymbol(withArpeggio, measureId, {
      type: 'arpeggio',
      points: [{ positionId: startPositionId, string: null }],
      range: 'all',
    })
    expect(replaced.measures[0].symbols).toHaveLength(1)
    expect(replaced.measures[0].symbols[0].range).toBe('all')

    const withConnection = addSymbol(replaced, measureId, {
      type: 'hammer-on',
      points: [
        { positionId: startPositionId, string: 2 },
        { positionId: endPositionId, string: 2 },
      ],
      range: null,
    })
    expect(withConnection.measures[0].symbols).toHaveLength(2)

    const symbolId = withConnection.measures[0].symbols[0].id
    const removed = removeSymbol(withConnection, measureId, symbolId)
    expect(removed.measures[0].symbols).toHaveLength(1)
    expect(removed.measures[0].symbols[0].type).toBe('hammer-on')
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
