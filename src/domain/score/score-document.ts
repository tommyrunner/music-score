import { z } from 'zod'

import { createId } from './id'

const MAX_TITLE_LENGTH = 80
const DEFAULT_POSITION_COUNT = 24
const DEFAULT_MEASURE_COUNT = 8

export const MAX_FRET = 6

const idSchema = z.string().min(1).max(100)
const titleSchema = z.string().trim().min(1).max(MAX_TITLE_LENGTH)
const fretSchema = z.union([z.number().int().min(0).max(MAX_FRET), z.literal('X')])
const barlineSchema = z.enum(['single'])

const noteSchema = z
  .object({
    string: z.number().int().min(1).max(6),
    fret: fretSchema,
  })
  .strict()

const stringRangeSchema = z.enum(['upper', 'lower', 'all'])
const scoreSymbolTypeSchema = z.enum([
  'arpeggio',
  'sweep',
  'tie',
  'hammer-on',
  'pull-off',
])

const symbolPointSchema = z
  .object({
    positionId: idSchema,
    string: z.number().int().min(1).max(6).nullable().default(null),
  })
  .strict()

const scoreSymbolSchema = z
  .object({
    id: idSchema,
    type: scoreSymbolTypeSchema,
    points: z.array(symbolPointSchema).min(1).max(4),
    range: stringRangeSchema.nullable().default(null),
  })
  .strict()
  .superRefine((symbol, context) => {
    const isRangeSymbol = symbol.type === 'arpeggio' || symbol.type === 'sweep'

    if (isRangeSymbol && (symbol.points.length !== 1 || symbol.range === null)) {
      context.addIssue({
        code: 'custom',
        message: '琶音和扫弦需要选择一个琴弦范围',
      })
    }

    if (!isRangeSymbol && (symbol.points.length !== 2 || symbol.range !== null)) {
      context.addIssue({
        code: 'custom',
        message: '连线符号需要选择两个音符位置',
      })
    }
  })

const positionSchema = z
  .object({
    id: idSchema,
    chord: z.string().trim().max(16).nullable(),
    barline: barlineSchema.nullable().default(null),
    notes: z.array(noteSchema).max(6),
  })
  .strict()
  .refine(
    (position) => new Set(position.notes.map((note) => note.string)).size === position.notes.length,
    { message: '同一音符列中的琴弦不能重复' },
  )

const measureSchema = z
  .object({
    id: idSchema,
    positions: z.array(positionSchema).min(1).max(32).transform((positions) =>
      positions.length >= DEFAULT_POSITION_COUNT
        ? positions
        : [
            ...positions,
            ...Array.from(
              { length: DEFAULT_POSITION_COUNT - positions.length },
              () => ({
                id: createId(),
                chord: null,
                barline: null,
                notes: [],
              }),
            ),
          ],
    ),
    lyrics: z.array(z.string().trim().min(1).max(300)).max(12).default([]),
    symbols: z.array(scoreSymbolSchema).max(200).default([]),
  })
  .strict()

const scorePageSchema = z
  .object({
    id: idSchema,
    type: z.literal('score'),
    title: titleSchema,
    measures: z.array(measureSchema).min(1).max(500),
  })
  .strict()

const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => {
      try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: '图片地址必须是 http(s) URL' },
  )

const imagePageSchema = z
  .object({
    id: idSchema,
    type: z.literal('image'),
    title: titleSchema,
    image: z
      .object({
        url: imageUrlSchema,
      })
      .strict(),
  })
  .strict()

export const scoreBookSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: idSchema,
    title: titleSchema,
    instrument: z
      .object({
        type: z.literal('guitar'),
        strings: z.literal(6),
        tuning: z.tuple([
          z.literal('E4'),
          z.literal('B3'),
          z.literal('G3'),
          z.literal('D3'),
          z.literal('A2'),
          z.literal('E2'),
        ]),
      })
      .strict(),
    pages: z.array(z.discriminatedUnion('type', [scorePageSchema, imagePageSchema])).max(200),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict()

export type FretValue = z.infer<typeof fretSchema>
export type BarlineStyle = z.infer<typeof barlineSchema>
export type StringRange = z.infer<typeof stringRangeSchema>
export type ScoreSymbolType = z.infer<typeof scoreSymbolTypeSchema>
export type ScoreSymbolPoint = z.infer<typeof symbolPointSchema>
export type ScoreSymbol = z.infer<typeof scoreSymbolSchema>
export type ScorePosition = z.infer<typeof positionSchema>
export type ScoreMeasure = z.infer<typeof measureSchema>
export type ScorePage = z.infer<typeof scorePageSchema>
export type ImagePage = z.infer<typeof imagePageSchema>
export type ScoreBook = z.infer<typeof scoreBookSchema>
export type ScoreBookPage = ScoreBook['pages'][number]

const createPosition = (): ScorePosition => ({
  id: createId(),
  chord: null,
  barline: null,
  notes: [],
})

export function createScoreBook(title: string): ScoreBook {
  const now = new Date().toISOString()

  return scoreBookSchema.parse({
    schemaVersion: 1,
    id: createId(),
    title,
    instrument: {
      type: 'guitar',
      strings: 6,
      tuning: ['E4', 'B3', 'G3', 'D3', 'A2', 'E2'],
    },
    pages: [],
    createdAt: now,
    updatedAt: now,
  })
}

export function createScorePage(title: string): ScorePage {
  return scorePageSchema.parse({
    id: createId(),
    type: 'score',
    title,
    measures: Array.from({ length: DEFAULT_MEASURE_COUNT }, createMeasure),
  })
}

export function createImagePage(
  title: string,
  image: ImagePage['image'],
): ImagePage {
  return imagePageSchema.parse({
    id: createId(),
    type: 'image',
    title,
    image,
  })
}

export function createMeasure(): ScoreMeasure {
  return measureSchema.parse({
    id: createId(),
    positions: Array.from({ length: DEFAULT_POSITION_COUNT }, createPosition),
    lyrics: [],
    symbols: [],
  })
}

export function setFretAtPosition(
  page: ScorePage,
  measureId: string,
  positionId: string,
  stringNumber: number,
  fret: FretValue | null,
): ScorePage {
  const measures = page.measures.map((measure) => {
    if (measure.id !== measureId) return measure

    return {
      ...measure,
      positions: measure.positions.map((position) => {
        if (position.id !== positionId) return position

        const notes = position.notes.filter((note) => note.string !== stringNumber)
        if (fret !== null) notes.push({ string: stringNumber, fret })

        return { ...position, notes: notes.sort((a, b) => a.string - b.string) }
      }),
    }
  })

  return scorePageSchema.parse({ ...page, measures })
}

export function parseScoreBook(input: string): ScoreBook {
  try {
    return scoreBookSchema.parse(JSON.parse(input))
  } catch {
    throw new Error('无法识别这份乐谱文件')
  }
}
