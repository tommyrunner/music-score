import {
  createMeasure,
  type BarlineStyle,
  type ScoreBook,
  type ScoreBookPage,
  type ScorePage,
} from './score-document'

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
