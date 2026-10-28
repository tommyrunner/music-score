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
      history: {},
      canUndo: false,
      canRedo: false,
      isSelectMode: false,
      selectedNodes: [],
      clipboard: [],
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
    expect(screen.getAllByText('点击新增和弦')).toHaveLength(192)
    expect(document.querySelector('.measure-labels')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '添加小节' })).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: '第 1 小节，第 1 列，1 弦，空白' }),
    )
    expect(screen.getByRole('button', { name: '0 品' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '6 品' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '7 品' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '24 品' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '3 品' }))

    const filledNote = screen.getByRole('button', {
      name: '第 1 小节，第 1 列，1 弦，3 品',
    })
    expect(within(filledNote).getByText('3')).toHaveClass('note-value')

    fireEvent.click(filledNote)
    fireEvent.click(screen.getByRole('button', { name: '清除' }))
    expect(
      screen.getByRole('button', { name: '第 1 小节，第 1 列，1 弦，空白' }),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('button', { name: '第 1 小节，第 24 列，1 弦，空白' }),
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
    expect(screen.getByRole('tab', { name: '音符' })).toHaveAttribute('aria-selected', 'true')
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
      within(firstLine).getByRole('button', { name: '第 1 行第 4 列单竖线' }),
    )
    expect(screen.getByRole('tab', { name: '功能' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '音符' })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '清除' }))
    expect(within(firstLine).queryByRole('img', { name: '第 1 行第 4 列单竖线' })).not.toBeInTheDocument()
  })

  it('adds range symbols and two-point slur symbols', () => {
    useScoreStore.getState().createBook('技巧练习')
    useScoreStore.getState().addScorePage('主歌')
    render(<App />)

    const firstLine = screen.getByRole('article', { name: '第 1 行六线谱' })
    const openNoteTab = (position: number, stringNumber: number) => {
      fireEvent.click(within(firstLine).getByRole('button', {
        name: `第 1 小节，第 ${position} 列，${stringNumber} 弦，空白`,
      }))
      fireEvent.click(screen.getByRole('tab', { name: '音符' }))
    }

    openNoteTab(1, 2)
    fireEvent.click(screen.getByRole('button', { name: '添加琶音 上弦' }))
    const arpeggio = within(firstLine).getByRole('button', { name: '琶音 上弦' })
    expect(arpeggio).toBeInTheDocument()

    fireEvent.click(arpeggio)
    expect(screen.getByText('当前符号：琶音 上弦')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '清除' }))
    expect(within(firstLine).queryByRole('button', { name: '琶音 上弦' })).not.toBeInTheDocument()

    openNoteTab(1, 2)
    fireEvent.click(screen.getByRole('button', { name: '添加扫弦 下弦' }))
    expect(within(firstLine).getByRole('button', { name: '扫弦 下弦' })).toBeInTheDocument()

    openNoteTab(2, 2)
    fireEvent.click(screen.getByRole('button', { name: '添加击弦 H' }))
    expect(screen.getByRole('status')).toHaveTextContent('第 1 行第 2 列，第 2 弦')

    fireEvent.click(within(firstLine).getByRole('button', {
      name: '第 1 小节，第 5 列，2 弦，空白',
    }))
    expect(
      within(firstLine).getByRole('button', { name: '击弦 H，第 2 列至第 5 列' }),
    ).toBeInTheDocument()
  })

  it('edits multiple notes vertically at one position', () => {
    useScoreStore.getState().createBook('和弦练习')
    useScoreStore.getState().addScorePage('主歌')
    render(<App />)

    const firstLine = screen.getByRole('article', { name: '第 1 行六线谱' })
    fireEvent.click(within(firstLine).getByRole('button', {
      name: '第 1 小节，第 1 列，1 弦，空白',
    }))
    expect(screen.getByRole('tab', { name: '音符' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('button', { name: '编辑单节多音' }))

    expect(screen.getByText('第 1 列')).toBeInTheDocument()
    for (const stringNumber of [1, 2, 3, 4, 5, 6]) {
      expect(
        screen.getByRole('button', { name: `${stringNumber} 弦 闷音 X` }),
      ).toHaveAttribute('aria-pressed', 'true')
    }

    fireEvent.click(screen.getByRole('button', { name: '1 弦 3 品' }))
    fireEvent.click(screen.getByRole('button', { name: '2 弦 5 品' }))
    fireEvent.click(screen.getByRole('button', { name: '3 弦 0 品' }))
    expect(screen.getByRole('button', { name: '1 弦 3 品' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '2 弦 5 品' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '2 弦 5 品' }))
    expect(screen.getByRole('button', { name: '2 弦 闷音 X' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '完成' }))

    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 1 列，1 弦，3 品' }),
    ).toBeInTheDocument()
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 1 列，2 弦，闷音 X' }),
    ).toBeInTheDocument()
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 1 列，3 弦，0 品' }),
    ).toBeInTheDocument()
    for (const stringNumber of [4, 5, 6]) {
      expect(
        within(firstLine).getByRole('button', {
          name: `第 1 小节，第 1 列，${stringNumber} 弦，闷音 X`,
        }),
      ).toBeInTheDocument()
    }

    fireEvent.click(within(firstLine).getByRole('button', {
      name: '第 1 小节，第 1 列，1 弦，3 品',
    }))
    fireEvent.click(screen.getByRole('button', { name: '编辑单节多音' }))
    fireEvent.click(screen.getByRole('button', { name: '清除' }))

    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 1 列，1 弦，空白' }),
    ).toBeInTheDocument()
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 1 列，3 弦，空白' }),
    ).toBeInTheDocument()
  })

  it('selects, copies and pastes non-adjacent notes with keyboard shortcuts', () => {
    useScoreStore.getState().createBook('复制练习')
    useScoreStore.getState().addScorePage('主歌')
    const book = useScoreStore.getState().books[0]
    const page = book.pages[0]
    if (page.type !== 'score') throw new Error('missing score page')
    const measure = page.measures[0]
    useScoreStore.getState().updateFret(measure.id, measure.positions[0].id, 1, 3)
    useScoreStore.getState().updateFret(measure.id, measure.positions[3].id, 1, 5)

    render(<App />)

    const firstLine = screen.getByRole('article', { name: '第 1 行六线谱' })
    fireEvent.click(screen.getByRole('button', { name: '编辑菜单' }))
    fireEvent.click(screen.getByRole('button', { name: '选择节点' }))
    fireEvent.click(within(firstLine).getByRole('button', {
      name: '第 1 小节，第 1 列，1 弦，3 品',
    }))
    fireEvent.click(within(firstLine).getByRole('button', {
      name: '第 1 小节，第 4 列，1 弦，5 品',
    }))

    expect(screen.getByText(/已选 2 个/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '编辑菜单' }))
    expect(screen.getByRole('button', { name: '复制选中音符' })).not.toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '复制选中音符' }))
    expect(screen.queryByText(/已选 2 个/)).not.toBeInTheDocument()

    fireEvent.click(within(firstLine).getByRole('button', {
      name: '第 1 小节，第 11 列，1 弦，空白',
    }))
    fireEvent.click(screen.getByRole('tab', { name: '功能' }))
    fireEvent.click(screen.getByRole('button', { name: '粘贴音符' }))

    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 11 列，1 弦，3 品' }),
    ).toBeInTheDocument()
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 12 列，1 弦，5 品' }),
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true })
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 11 列，1 弦，空白' }),
    ).toBeInTheDocument()
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 12 列，1 弦，空白' }),
    ).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 11 列，1 弦，3 品' }),
    ).toBeInTheDocument()
  })

  it('selects notes with a dragged selection rectangle', () => {
    useScoreStore.getState().createBook('框选练习')
    useScoreStore.getState().addScorePage('主歌')
    const book = useScoreStore.getState().books[0]
    const page = book.pages[0]
    if (page.type !== 'score') throw new Error('missing score page')
    const measure = page.measures[0]
    const frets = [3, 5, 1, 2]
    frets.forEach((fret, index) => {
      useScoreStore.getState().updateFret(measure.id, measure.positions[index].id, 1, fret)
    })

    render(<App />)

    const firstLine = screen.getByRole('article', { name: '第 1 行六线谱' })
    fireEvent.click(screen.getByRole('button', { name: '编辑菜单' }))
    fireEvent.click(screen.getByRole('button', { name: '选择节点' }))

    const systems = document.querySelector('.score-systems') as HTMLElement
    const makeRect = (left: number, top: number, width: number, height: number) => ({
      x: left,
      y: top,
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      toJSON: () => ({}),
    }) as DOMRect
    systems.getBoundingClientRect = () => makeRect(0, 0, 800, 800)

    frets.forEach((fret, index) => {
      const button = within(firstLine).getByRole('button', {
        name: `第 1 小节，第 ${index + 1} 列，1 弦，${fret} 品`,
      })
      button.getBoundingClientRect = () => makeRect(index * 30, 0, 20, 20)
    })

    fireEvent.pointerDown(systems, {
      pointerId: 1,
      button: 0,
      clientX: 0,
      clientY: 0,
    })
    fireEvent.pointerMove(window, {
      pointerId: 1,
      clientX: 85,
      clientY: 50,
    })

    expect(document.querySelector('.selection-marquee')).toBeInTheDocument()
    expect(screen.getByText(/已选 3 个/)).toBeInTheDocument()

    fireEvent.pointerUp(window, {
      pointerId: 1,
      clientX: 85,
      clientY: 50,
    })

    expect(document.querySelector('.selection-marquee')).not.toBeInTheDocument()
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 1 列，1 弦，3 品' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 3 列，1 弦，1 品' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(firstLine).getByRole('button', { name: '第 1 小节，第 4 列，1 弦，2 品' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('adds an uploaded image as a self-contained page', async () => {
    useScoreStore.getState().createBook('图片谱本')
    render(<App />)

    fireEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: '新增一页' }))
    fireEvent.click(screen.getByRole('button', { name: '图片页面' }))
    fireEvent.change(screen.getByLabelText('图片 URL'), {
      target: { value: 'https://example.com/score.png' },
    })
    fireEvent.change(screen.getByLabelText('页面名称'), {
      target: { value: '手写谱' },
    })
    fireEvent.click(screen.getByRole('button', { name: '新增图片页' }))

    expect(await screen.findByAltText('手写谱')).toHaveAttribute(
      'src',
      'https://example.com/score.png',
    )
  })
})
