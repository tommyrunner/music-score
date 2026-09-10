import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useScoreStore } from '../../app/use-score-store'
import { createScoreBook } from '../../domain/score/score-document'
import { WorkspaceToolbar } from './WorkspaceToolbar'

const originalSaveActiveBook = useScoreStore.getState().saveActiveBook

describe('workspace toolbar', () => {
  const book = createScoreBook('随身练习')
  const saveActiveBook = vi.fn(async () => undefined)

  beforeEach(() => {
    saveActiveBook.mockClear()
    useScoreStore.setState({ saveActiveBook })
  })

  afterAll(() => {
    useScoreStore.setState({ saveActiveBook: originalSaveActiveBook })
  })

  it('saves the current book and exposes portable file actions', async () => {
    render(
      <WorkspaceToolbar
        activeBook={book}
        books={[book]}
        isDirty
        onPreview={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '保存谱本' }))
    await waitFor(() => expect(saveActiveBook).toHaveBeenCalledOnce())

    fireEvent.click(screen.getByRole('button', { name: '文件操作' }))
    expect(screen.getByText('导入 JSON')).toBeInTheDocument()
    expect(screen.getByText('导出当前谱本')).toBeInTheDocument()
    expect(screen.getByText('批量导出全部')).toBeInTheDocument()
  })
})
