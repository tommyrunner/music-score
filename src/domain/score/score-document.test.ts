import { describe, expect, it } from 'vitest'

import {
  createScoreBook,
  createScorePage,
  parseScoreBook,
  setFretAtPosition,
} from './score-document'

describe('score document contract', () => {
  it('creates an empty guitar book as a versioned JSON document', () => {
    const book = createScoreBook('夜路歌集')

    expect(book.schemaVersion).toBe(1)
    expect(book.title).toBe('夜路歌集')
    expect(book.instrument).toEqual({
      type: 'guitar',
      strings: 6,
      tuning: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'],
    })
    expect(book.pages).toEqual([])
  })

  it('creates a complete score sheet with eight measures', () => {
    const page = createScorePage('主歌')

    expect(page.type).toBe('score')
    expect(page.measures).toHaveLength(8)
    expect(page.measures.every((measure) => measure.positions.length === 16)).toBe(true)
    expect(page.measures.every((measure) => measure.lyrics.length === 0)).toBe(true)
    expect(
      page.measures.every((measure) =>
        measure.positions.every((position) => position.barline === null),
      ),
    ).toBe(true)
  })

  it('stores simultaneous notes on different strings at one position', () => {
    const page = createScorePage('主歌')
    const measureId = page.measures[0].id
    const positionId = page.measures[0].positions[0].id

    const withBass = setFretAtPosition(page, measureId, positionId, 6, 3)
    const withChord = setFretAtPosition(withBass, measureId, positionId, 5, 2)

    expect(withChord.measures[0].positions[0].notes).toEqual([
      { string: 5, fret: 2 },
      { string: 6, fret: 3 },
    ])
  })

  it('accepts a complete exported document and rejects invalid fret data', () => {
    const book = createScoreBook('练习册')

    expect(parseScoreBook(JSON.stringify(book))).toEqual(book)

    const invalid = {
      ...book,
      pages: [
        {
          ...createScorePage('错误示例'),
          measures: [
            {
              ...createScorePage('错误示例').measures[0],
              positions: [
                {
                  id: crypto.randomUUID(),
                  chord: null,
                  notes: [{ string: 7, fret: 99 }],
                },
              ],
            },
          ],
        },
      ],
    }

    expect(() => parseScoreBook(JSON.stringify(invalid))).toThrow(
      '无法识别这份乐谱文件',
    )
  })

  it('fills new score-line fields when importing an older document', () => {
    const page = createScorePage('旧版主歌')
    const book = { ...createScoreBook('旧版谱本'), pages: [page] }
    const legacyBook = JSON.parse(JSON.stringify(book))

    for (const measure of legacyBook.pages[0].measures) {
      measure.positions = measure.positions.slice(0, 8)
      delete measure.lyrics
      for (const position of measure.positions) delete position.barline
    }

    const parsed = parseScoreBook(JSON.stringify(legacyBook))
    const parsedPage = parsed.pages[0]

    expect(parsedPage.type).toBe('score')
    if (parsedPage.type !== 'score') return
    expect(parsedPage.measures[0].lyrics).toEqual([])
    expect(parsedPage.measures[0].positions).toHaveLength(16)
    expect(parsedPage.measures[0].positions[0].barline).toBeNull()
  })
})
