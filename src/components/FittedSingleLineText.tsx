import { useLayoutEffect, useRef, useState } from 'react'

export function FittedSingleLineText({
  text,
  fontSize = 12,
  minFontSize = 8,
  className = '',
}: {
  text: string
  fontSize?: number
  minFontSize?: number
  className?: string
}) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState({ fontSize, scaleX: 1 })

  useLayoutEffect(() => {
    const container = containerRef.current
    const textElement = textRef.current
    if (!container || !textElement) return

    const fitText = () => {
      const availableWidth = container.clientWidth
      const renderedFontSize = Number.parseFloat(getComputedStyle(textElement).fontSize)
      const widthAtBaseSize = textElement.scrollWidth * (fontSize / renderedFontSize)
      const fitRatio = availableWidth > 0 && widthAtBaseSize > availableWidth
        ? availableWidth / widthAtBaseSize
        : 1
      const nextFontSize = Math.max(minFontSize, fontSize * fitRatio)
      const nextScaleX = fitRatio < minFontSize / fontSize
        ? fitRatio / (minFontSize / fontSize)
        : 1

      setFit((current) =>
        Math.abs(current.fontSize - nextFontSize) < 0.01
          && Math.abs(current.scaleX - nextScaleX) < 0.001
          ? current
          : { fontSize: nextFontSize, scaleX: nextScaleX },
      )
    }

    fitText()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fitText)
    observer.observe(container)
    return () => observer.disconnect()
  }, [fontSize, minFontSize, text])

  return (
    <span className={`fitted-single-line ${className}`.trim()} ref={containerRef}>
      <span
        className="fitted-single-line-text"
        ref={textRef}
        style={{ fontSize: fit.fontSize, transform: `scaleX(${fit.scaleX})` }}
      >
        {text}
      </span>
    </span>
  )
}
