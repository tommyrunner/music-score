import {
  createMeasure,
  type BarlineStyle,
  type FretValue,
  type ScoreBook,
  type ScoreBookPage,
  type ScorePage,
  type ScoreSymbol,
} from './score-document'
import { createId } from './id'

export interface ScoreClipboardNote {
  string: number
  fret: FretValue
}

export function appendPage(
  book: ScoreBook,
  page: ScoreBookPage,
  updatedAt = new Date().toISOString(),
): ScoreBook {
  return {
    ...book,
    pages: [...book.pages, page],
    updatedAt,
  }
}

export function addMeasure(page: ScorePage): ScorePage {
  return {
    ...page,
    measures: [...page.measures, createMeasure()],
  }
}

export function setChord(
  page: ScorePage,
  measureId: string,
  positionId: string,
  chord: string,
): ScorePage {
  return {
    ...page,
    measures: page.measures.map((measure) =>
      measure.id === measureId
        ? {
            ...measure,
            positions: measure.positions.map((position) =>
              position.id === positionId
                ? { ...position, chord: chord.trim() || null }
                : position,
            ),
          }
        : measure,
    ),
  }
}

export function setBarline(
  page: ScorePage,
  measureId: string,
  positionId: string,
  barline: BarlineStyle | null,
): ScorePage {
  return {
    ...page,
    measures: page.measures.map((measure) =>
      measure.id === measureId
        ? {
            ...measure,
            positions: measure.positions.map((position) =>
              position.id === positionId
                ? { ...position, barline }
                : position,
            ),
          }
        : measure,
    ),
  }
}

export function addSymbol(
  page: ScorePage,
  measureId: string,
  symbol: Omit<ScoreSymbol, 'id'>,
): ScorePage {
  return {
    ...page,
    measures: page.measures.map((measure) => {
      if (measure.id !== measureId) return measure

      const nextSymbol: ScoreSymbol = { ...symbol, id: createId() }
      const symbols = [
        ...measure.symbols.filter(
          (candidate) =>
            candidate.type !== symbol.type
            || candidate.points[0]?.positionId !== symbol.points[0]?.positionId,
        ),
        nextSymbol,
      ]

      return { ...measure, symbols }
    }),
  }
}

export function removeSymbol(
  page: ScorePage,
  measureId: string,
  symbolId: string,
): ScorePage {
  return {
    ...page,
    measures: page.measures.map((measure) =>
      measure.id === measureId
        ? {
            ...measure,
            symbols: measure.symbols.filter((symbol) => symbol.id !== symbolId),
          }
        : measure,
    ),
  }
}

export function setPositionNotes(
  page: ScorePage,
  measureId: string,
  positionId: string,
  notes: ScoreClipboardNote[],
): ScorePage {
  const noteMap = new Map(notes.map((note) => [note.string, note.fret]))
  const nextNotes = [...noteMap.entries()]
    .sort(([left], [right]) => left - right)
    .map(([string, fret]) => ({ string, fret }))

  return {
    ...page,
    measures: page.measures.map((measure) =>
      measure.id === measureId
        ? {
            ...measure,
            positions: measure.positions.map((position) =>
              position.id === positionId
                ? { ...position, notes: nextNotes }
                : position,
            ),
          }
        : measure,
    ),
  }
}

export function pasteNotesFrom(
  page: ScorePage,
  measureId: string,
  positionId: string,
  notes: ScoreClipboardNote[],
): ScorePage {
  if (notes.length === 0) return page

  const flatPositions = page.measures.flatMap((measure) =>
    measure.positions.map((position) => ({
      measureId: measure.id,
      positionId: position.id,
    })),
  )
  const startIndex = flatPositions.findIndex(
    (position) => position.measureId === measureId && position.positionId === positionId,
  )
  if (startIndex < 0) return page

  const updates = new Map<string, Map<string, ScoreClipboardNote>>()
  notes.forEach((note, offset) => {
    const target = flatPositions[startIndex + offset]
    if (!target) return

    const measureUpdates = updates.get(target.measureId) ?? new Map()
    measureUpdates.set(target.positionId, note)
    updates.set(target.measureId, measureUpdates)
  })

  return {
    ...page,
    measures: page.measures.map((measure) => {
      const measureUpdates = updates.get(measure.id)
      if (!measureUpdates) return measure

      return {
        ...measure,
        positions: measure.positions.map((position) => {
          const pastedNote = measureUpdates.get(position.id)
          if (!pastedNote) return position

          const notes = position.notes.filter(
            (note) => note.string !== pastedNote.string,
          )
          notes.push(pastedNote)
          return {
            ...position,
            notes: notes.sort((a, b) => a.string - b.string),
          }
        }),
      }
    }),
  }
}

export function setLyricLine(
  page: ScorePage,
  measureId: string,
  lyricIndex: number,
  text: string | null,
): ScorePage {
  return {
    ...page,
    measures: page.measures.map((measure) => {
      if (measure.id !== measureId || lyricIndex < 0 || lyricIndex > measure.lyrics.length) {
        return measure
      }

      const lyrics = [...measure.lyrics]
      const normalizedText = text?.trim() ?? ''

      if (lyricIndex === lyrics.length) {
        if (normalizedText && lyrics.length < 12) lyrics.push(normalizedText)
      } else if (normalizedText) {
        lyrics[lyricIndex] = normalizedText
      } else {
        lyrics.splice(lyricIndex, 1)
      }

      return { ...measure, lyrics }
    }),
  }
}

export function updateScorePage(
  book: ScoreBook,
  page: ScorePage,
  updatedAt = new Date().toISOString(),
): ScoreBook {
  return {
    ...book,
    pages: book.pages.map((candidate) =>
      candidate.id === page.id ? page : candidate,
    ),
    updatedAt,
  }
}
