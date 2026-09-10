import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { createScoreBook, createScorePage, setFretAtPosition } from '../../domain/score/score-document'
import { appendPage, setBarline, setLyricLine } from '../../domain/score/score-operations'
import { ScorePreview } from './ScorePreview'

describe('paper preview', () => {
  it('renders a score book as a read-only paper sheet', () => {
    const emptyPage = createScorePage('主歌')
    const measure = emptyPage.measures[0]
    const withFret = setFretAtPosition(emptyPage, measure.id, measure.positions[0].id, 1, 3)
    const withBarline = setBarline(withFret, measure.id, measure.positions[3].id, 'single')
    const page = setLyricLine(withBarline, measure.id, 0, '沿着晚风继续弹')
    const book = appendPage(createScoreBook('路边练习'), page)
    const close = vi.fn()

    render(<ScorePreview open book={book} onOpenChange={close} />)

    expect(screen.getByRole('dialog', { name: '路边练习纸张预览' })).toBeInTheDocument()
    expect(screen.getByLabelText('主歌六线谱纸张')).toHaveTextContent('3')
    expect(screen.getByLabelText('主歌六线谱纸张')).toHaveTextContent('沿着晚风继续弹')
    expect(document.querySelectorAll('.preview-functional-barline')).toHaveLength(1)
    expect(document.querySelector('.preview-measure-number')).not.toBeInTheDocument()
    expect(document.querySelector('.preview-chords')).toHaveStyle({
      gridTemplateColumns: 'repeat(16, minmax(0, 1fr))',
    })
    fireEvent.click(screen.getByRole('button', { name: '关闭预览' }))
    expect(close).toHaveBeenCalledWith(false)
  })

  it('zooms every paper page relative to the fitted screen size', () => {
    const firstPage = createScorePage('主歌')
    const secondPage = createScorePage('副歌')
    const book = appendPage(appendPage(createScoreBook('缩放练习'), firstPage), secondPage)

    render(<ScorePreview open book={book} onOpenChange={vi.fn()} />)

    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(document.querySelectorAll('.preview-page-stage')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: '放大预览' }))
    expect(screen.getByText('125%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '缩小预览' }))
    expect(screen.getByText('100%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '缩小预览' }))
    expect(screen.getByText('75%')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '适配屏幕' }))
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})
