import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { useScoreStore } from '../../app/use-score-store'
import { createScoreBook, createScorePage } from '../../domain/score/score-document'
import { appendPage } from '../../domain/score/score-operations'
import { WorkspaceToolbar } from './WorkspaceToolbar'

const originalSaveActiveBook = useScoreStore.getState().saveActiveBook

describe('workspace toolbar', () => {
  const book = appendPage(createScoreBook('随身练习'), createScorePage('主歌'))
  const saveActiveBook = vi.fn(async () => undefined)

  beforeEach(() => {
    saveActiveBook.mockClear()
    useScoreStore.setState({
      saveActiveBook,
      activeBookId: book.id,
      activePageId: book.pages[0].id,
    })
  })

  afterAll(() => {
    useScoreStore.setState({ saveActiveBook: originalSaveActiveBook })
  })

  it('saves the current book and exports page or book JSON in the editor', async () => {
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
    expect(screen.getByText('导出当前页')).toBeInTheDocument()
    expect(screen.getByText('导出当前谱本')).toBeInTheDocument()
    expect(screen.queryByText('批量导出全部')).not.toBeInTheDocument()
  })

  it('offers JSON/ZIP import and batch ZIP export on the home toolbar', () => {
    useScoreStore.setState({ activeBookId: null, activePageId: null })

    render(
      <WorkspaceToolbar
        books={[book]}
        isDirty={false}
        onPreview={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '文件操作' }))
    expect(screen.getByText('导入 JSON / ZIP')).toBeInTheDocument()
    expect(screen.getByText('批量导出全部')).toBeInTheDocument()
    expect(screen.queryByText('导出当前谱本')).not.toBeInTheDocument()
    expect(screen.getByLabelText('选择要导入的 JSON 或 ZIP 文件')).toHaveAttribute(
      'accept',
      'application/json,.json,application/zip,.zip',
    )
  })
})