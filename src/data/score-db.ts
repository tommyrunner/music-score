/**
 * 本地 IndexedDB 谱本存储。
 */

import Dexie, { type Table } from 'dexie'

import type { ScoreBook } from '../domain/score/score-document'

/**
 * 谱本 IndexedDB 数据库。
 */
export class ScoreDatabase extends Dexie {
  books!: Table<ScoreBook, string>

  constructor(databaseName = 'stringroom') {
    super(databaseName)
    this.version(1).stores({
      books: 'id, title, updatedAt',
    })
  }
}

/**
 * 全局谱本数据库实例。
 */
export const scoreDb = new ScoreDatabase()
