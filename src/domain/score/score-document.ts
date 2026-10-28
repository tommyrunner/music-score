/**
 * 谱本文档的数据结构、Zod 校验规则与工厂函数。
 */

import { z } from 'zod'

import { createId } from './id'

const MAX_TITLE_LENGTH = 80
const DEFAULT_POSITION_COUNT = 24
const DEFAULT_MEASURE_COUNT = 8

/** 支持的最大品位。 */
export const MAX_FRET = 6
/** 页面副标题最大长度。 */
export const SCORE_SUBTITLE_MAX_LENGTH = 100
/** 页面左下角文字最大长度。 */
export const PAGE_FOOTER_LEFT_MAX_LENGTH = 10
/** 页面右下角文字最大长度。 */
export const PAGE_FOOTER_RIGHT_MAX_LENGTH = 50
/** 六线谱页面默认副标题。 */
export const DEFAULT_SCORE_SUBTITLE = '标准调弦 E A D G B E'
/** 页面默认左下角文字。 */
export const DEFAULT_PAGE_FOOTER_LEFT = '弦间'
/** 页面默认右下角文字。 */
export const DEFAULT_PAGE_FOOTER_RIGHT = ''

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
    subtitle: z.string().trim().max(SCORE_SUBTITLE_MAX_LENGTH).default(DEFAULT_SCORE_SUBTITLE),
    footerLeft: z.string().trim().max(PAGE_FOOTER_LEFT_MAX_LENGTH).default(DEFAULT_PAGE_FOOTER_LEFT),
    footerRight: z.string().trim().max(PAGE_FOOTER_RIGHT_MAX_LENGTH).default(DEFAULT_PAGE_FOOTER_RIGHT),
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

/** 谱本文档的完整校验 schema。 */
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

/** 品位值：X 或 0-6。 */
export type FretValue = z.infer<typeof fretSchema>
/** 小节线样式。 */
export type BarlineStyle = z.infer<typeof barlineSchema>
/** 扫弦范围。 */
export type StringRange = z.infer<typeof stringRangeSchema>
/** 乐谱符号类型。 */
export type ScoreSymbolType = z.infer<typeof scoreSymbolTypeSchema>
/** 乐谱符号。 */
export type ScoreSymbol = z.infer<typeof scoreSymbolSchema>
/** 单列音符位置。 */
export type ScorePosition = z.infer<typeof positionSchema>
/** 一个小节。 */
export type ScoreMeasure = z.infer<typeof measureSchema>
/** 六线谱页面。 */
export type ScorePage = z.infer<typeof scorePageSchema>
/** 图片参考页面。 */
export type ImagePage = z.infer<typeof imagePageSchema>
/** 一本谱本。 */
export type ScoreBook = z.infer<typeof scoreBookSchema>
/** 谱本中的任意页面。 */
export type ScoreBookPage = ScoreBook['pages'][number]

const createPosition = (): ScorePosition => ({
  id: createId(),
  chord: null,
  barline: null,
  notes: [],
})

/** 创建一本空的吉他谱本。 */
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

/** 创建一个包含默认小节和音符位置的六线谱页。 */
export function createScorePage(title: string): ScorePage {
  return scorePageSchema.parse({
    id: createId(),
    type: 'score',
    title,
    measures: Array.from({ length: DEFAULT_MEASURE_COUNT }, createMeasure),
  })
}

/** 创建图片参考页面。 */
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

/** 创建一个包含默认音符位置的小节。 */
export function createMeasure(): ScoreMeasure {
  return measureSchema.parse({
    id: createId(),
    positions: Array.from({ length: DEFAULT_POSITION_COUNT }, createPosition),
    lyrics: [],
    symbols: [],
  })
}

/** 在指定位置的某根弦上设置或清除品位。 */
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

/**
 * 解析并校验谱本 JSON。
 *
 * @throws 内容不是合法谱本时抛出统一错误。
 */
export function parseScoreBook(input: string): ScoreBook {
  try {
    return scoreBookSchema.parse(JSON.parse(input))
  } catch {
    throw new Error('无法识别这份乐谱文件')
  }
}
