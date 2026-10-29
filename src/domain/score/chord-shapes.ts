/**
 * 常用吉他和弦的指法数据。
 *
 * 指针法图中的六根弦按“6 弦到 1 弦”的顺序存储，
 * 数值为相对品位：-1 表示闷音，0 表示空弦，正数表示品位。
 */

/**
 * 横按信息。
 */
export interface ChordBarre {
  /** 横按所在品位。 */
  fret: number
  /** 起始弦索引，0 表示 6 弦。 */
  from: number
  /** 结束弦索引，0 表示 6 弦。 */
  to: number
}

/**
 * 和弦指法。
 */
export interface ChordShape {
  /** 六根弦的品位，索引 0 为 6 弦，索引 5 为 1 弦。 */
  frets: readonly number[]
  /** 横按位置。 */
  barres?: readonly ChordBarre[]
}

/**
 * 内置和弦指法。
 */
export const CHORD_SHAPES: Record<string, ChordShape> = {
  C: { frets: [-1, 3, 2, 0, 1, 0] },
  D: { frets: [-1, -1, 0, 2, 3, 2] },
  E: { frets: [0, 2, 2, 1, 0, 0] },
  F: { frets: [1, 3, 3, 2, 1, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
  G: { frets: [3, 2, 0, 0, 0, 3] },
  A: { frets: [-1, 0, 2, 2, 2, 0] },
  B: {
    frets: [-1, 2, 4, 4, 4, 2],
    barres: [{ fret: 2, from: 1, to: 5 }, { fret: 4, from: 2, to: 4 }],
  },
  Cm: { frets: [-1, 3, 5, 5, 4, 3], barres: [{ fret: 3, from: 1, to: 5 }] },
  Dm: { frets: [-1, -1, 0, 2, 3, 1] },
  Em: { frets: [0, 2, 2, 0, 0, 0] },
  Fm: { frets: [1, 3, 3, 1, 1, 1], barres: [{ fret: 1, from: 0, to: 5 }] },
  Gm: { frets: [3, 5, 5, 3, 3, 3], barres: [{ fret: 3, from: 0, to: 5 }] },
  Am: { frets: [-1, 0, 2, 2, 1, 0] },
  Bm: { frets: [-1, 2, 4, 4, 3, 2], barres: [{ fret: 2, from: 1, to: 5 }] },
  C7: { frets: [-1, 3, 2, 3, 1, 0] },
  D7: { frets: [-1, -1, 0, 2, 1, 2] },
  E7: { frets: [0, 2, 0, 1, 0, 0] },
  G7: { frets: [3, 2, 0, 0, 0, 1] },
  A7: { frets: [-1, 0, 2, 0, 2, 0] },
  B7: { frets: [-1, 2, 1, 2, 0, 2] },
}

const chordShapeLookup = new Map(
  Object.entries(CHORD_SHAPES).map(([name, shape]) => [name.toLowerCase(), shape]),
)

/**
 * 规范化和弦名称。
 *
 * 去除首尾空白、统一升降号写法，并去掉转位斜杠（如 C/G 取 C）。
 *
 * @param chord 原始和弦名称。
 */
export function normalizeChordName(chord: string) {
  const [base = ''] = chord.trim().replaceAll('♯', '#').replaceAll('♭', 'b').split('/')
  return base.trim()
}

/**
 * 查找和弦对应的指法样图。
 *
 * @param chord 和弦名称。
 * @returns 指法数据，未收录时返回 null。
 */
export function findChordShape(chord: string | null | undefined): ChordShape | null {
  if (!chord) return null

  const name = normalizeChordName(chord)
  if (!name) return null

  return CHORD_SHAPES[name] ?? chordShapeLookup.get(name.toLowerCase()) ?? null
}

/**
 * 计算指法图展示的起始品位。
 *
 * @param shape 和弦指法。
 */
export function chordBaseFret(shape: ChordShape) {
  const frets = shape.frets.filter((fret) => fret > 0)
  if (frets.length === 0) return 1

  const minFret = Math.min(...frets)
  const maxFret = Math.max(...frets)
  return minFret >= 3 || maxFret - minFret >= 5 ? minFret : 1
}
