import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { createScoreBook } from '../domain/score/score-document'
import { ScoreDatabase } from './score-db'

describe('local score database', () => {
  const databases: ScoreDatabase[] = []

  afterEach(async () => {
    await Promise.all(databases.map((database) => database.delete()))
    databases.length = 0
  })

  it('saves each score book as one independent record', async () => {
    const database = new ScoreDatabase(`test-${crypto.randomUUID()}`)
    databases.push(database)
    const first = createScoreBook('第一本')
    const second = createScoreBook('第二本')

    await database.books.bulkPut([first, second])

    expect(await database.books.get(first.id)).toEqual(first)
    expect(await database.books.toArray()).toHaveLength(2)
  })
})
