// Status anchors from the design system's fixed status scale (critical/warning/good),
// interpolated continuously so the badge reads as a live progress gauge rather than
// three discrete states.
const CRITICAL: [number, number, number] = [208, 59, 59] // #d03b3b
const WARNING: [number, number, number] = [250, 178, 25] // #fab219
const GOOD: [number, number, number] = [12, 163, 12] // #0ca30c

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function interpolateRgb(percent: number): [number, number, number] {
  const clamped = Math.max(0, Math.min(100, percent))
  const [from, to, t] = clamped <= 50 ? [CRITICAL, WARNING, clamped / 50] : [WARNING, GOOD, (clamped - 50) / 50]
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)]
}

// WCAG relative luminance, used to pick readable text over the interpolated fill.
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((channel) => {
    const s = channel / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

type Props = {
  percent: number
  className?: string
}

export function CompletionBadge({ percent, className }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const rgb = interpolateRgb(clamped)
  const textColor = relativeLuminance(rgb) > 0.45 ? '#1a1a1a' : '#ffffff'

  return (
    <span
      className={`badge fw-semibold ${className ?? ''}`}
      style={{
        backgroundColor: `rgb(${rgb.join(', ')})`,
        color: textColor,
        minWidth: '3.5rem',
        display: 'inline-block',
      }}
    >
      {clamped}%
    </span>
  )
}
