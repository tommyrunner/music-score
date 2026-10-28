import { FileImage } from '@phosphor-icons/react'

import type { ImagePage } from '../../domain/score/score-document'

export function ImagePageView({ page }: { page: ImagePage }) {
  return (
    <section className="image-page" aria-label={`${page.title}图片页面`}>
      <header>
        <div>
          <p>图片参考</p>
          <h1>{page.title}</h1>
        </div>
        <span><FileImage size={16} /> 图片 URL 引用</span>
      </header>
      <div className="image-page-paper">
        <span aria-hidden="true">{page.title}</span>
        <img src={page.image.url} alt={page.title} />
      </div>
    </section>
  )
}
