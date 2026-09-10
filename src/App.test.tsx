import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from './App'
import { useScoreStore } from './app/use-score-store'

describe('score book workspace', () => {
  beforeEach(() => {
    useScoreStore.setState({
      books: [],
      activeBookId: null,
      activePageId: null,
      isDirty: false,
      dirtyBookIds: [],
      isHydrated: true,
    })
  })

  it('opens on a personal library without a persistent sidebar', () => {
    useScoreStore.getState().createBook('深夜练习')
    useScoreStore.getState().goHome()

    render(<App />)

    expect(screen.getByRole('heading', { name: '我的谱本' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开谱本 深夜练习' })).toBeInTheDocument()
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
  })

  it('creates a book, adds a full score sheet and enters a fret', () => {
    render(<App />)

    expect(screen.getByText('还没有谱本')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '新建谱本' }))
    fireEvent.change(screen.getByLabelText('谱本名称'), {
      target: { value: '深夜练习' },
    })
    fireEvent.click(screen.getByRole('button', { name: '创建谱本' }))

    expect(screen.getByRole('heading', { name: '深夜练习' })).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '新增一页' }))
    fireEvent.change(screen.getByLabelText('页面名称'), {
      target: { value: '前奏' },
    })
    fireEvent.click(screen.getByRole('button', { name: '新增六线谱页' }))

    expect(
      screen.getAllByRole('article', { name: /第 \d+ 行六线谱/ }),
    ).toHaveLength(8)
    const staffLines = Array.from(document.querySelectorAll('.staff-lines'))
    expect(staffLines).toHaveLength(8)
    expect(staffLines.every((staff) => staff.getAttribute('preserveAspectRatio') === 'none')).toBe(true)
    expect(screen.getAllByText('点击新增和弦')).toHaveLength(128)
    expect(document.querySelector('.measure-labels')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '添加小节' })).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: '第 1 小节，第 1 列，1 弦，空白' }),
    )
    fireEvent.click(screen.getByRole('button', { name: '3 品' }))

    const filledNote = screen.getByRole('button', {
      name: '第 1 小节，第 1 列，1 弦，3 品',
    })
    expect(within(filledNote).getByText('3')).toHaveClass('note-value')
    expect(
      screen.getByRole('button', { name: '第 1 小节，第 16 列，1 弦，空白' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: '添加和弦' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Am 和弦' }))

    expect(
      screen.getByRole('button', { name: '第 1 小节，第 1 列，和弦 Am' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开页面目录' }))
    expect(screen.getByRole('navigation', { name: '页面目录' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '返回我的谱本' }))
    expect(screen.getByRole('heading', { name: '我的谱本' })).toBeInTheDocument()
  })

  it('adds and clears a functional barline and multiple lyric lines', () => {
    useScoreStore.getState().createBook('弹唱练习')
    useScoreStore.getState().addScorePage('主歌')
    render(<App />)

    const firstLine = screen.getByRole('article', { name: '第 1 行六线谱' })
    fireEvent.click(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 4 列，2 弦，空白' }),
    )
    expect(screen.getByRole('tab', { name: '品位' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: '功能' }))
    fireEvent.click(screen.getByRole('button', { name: '添加单竖线' }))

    expect(within(firstLine).getByRole('img', { name: '第 1 行第 4 列单竖线' })).toBeInTheDocument()

    fireEvent.click(within(firstLine).getByRole('button', { name: '输入歌词' }))
    fireEvent.change(screen.getByLabelText('歌词内容'), { target: { value: '第一行歌词很长也要留在谱表之下' } })
    fireEvent.click(screen.getByRole('button', { name: '保存歌词' }))
    fireEvent.click(within(firstLine).getByRole('button', { name: '新增一行歌词' }))
    fireEvent.change(screen.getByLabelText('歌词内容'), { target: { value: '第二行歌词' } })
    fireEvent.click(screen.getByRole('button', { name: '保存歌词' }))

    expect(within(firstLine).getByText('第一行歌词很长也要留在谱表之下')).toHaveStyle({
      fontSize: '16px',
    })
    expect(within(firstLine).getByText('第二行歌词')).toBeInTheDocument()

    fireEvent.click(within(firstLine).getByRole('button', { name: '编辑歌词 第二行歌词' }))
    fireEvent.click(screen.getByRole('button', { name: '清除这行歌词' }))
    expect(within(firstLine).queryByText('第二行歌词')).not.toBeInTheDocument()

    fireEvent.click(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 4 列，2 弦，空白' }),
    )
    fireEvent.click(screen.getByRole('tab', { name: '功能' }))
    fireEvent.click(screen.getByRole('button', { name: '清除竖线' }))
    expect(within(firstLine).queryByRole('img', { name: '第 1 行第 4 列单竖线' })).not.toBeInTheDocument()
  })

  it('adds an uploaded image as a self-contained page', async () => {
    useScoreStore.getState().createBook('图片谱本')
    render(<App />)

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '新增一页' }))
    fireEvent.click(screen.getByRole('button', { name: '图片页面' }))
    const image = new File(['image-bytes'], '手写谱.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText('选择图片'), { target: { files: [image] } })
    fireEvent.change(screen.getByLabelText('页面名称'), {
      target: { value: '手写谱' },
    })
    fireEvent.click(screen.getByRole('button', { name: '新增图片页' }))

    expect(await screen.findByAltText('手写谱')).toBeInTheDocument()
  })
})
