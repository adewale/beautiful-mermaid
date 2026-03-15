/**
 * Integration tests for journey diagrams — end-to-end parse → layout → render.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'
import type { RenderOptions } from '../types.ts'

function render(text: string, options: RenderOptions = {}): string {
  return renderMermaidSVG(text, options)
}

describe('renderMermaidSVG – journey diagrams', () => {
  it('renders a basic user journey to valid SVG', () => {
    const svg = render(`journey
      title My working day
      section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('My working day')
    expect(svg).toContain('class="journey-section"')
    expect(svg).toContain('class="journey-task"')
    expect(svg).toContain('class="journey-score-cell-filled"')
    expect(svg).toContain('class="journey-actor-pill"')
  })

  it('emits semantic data attributes for section, score, and actors', () => {
    const svg = render(`journey
      section Go to work
      Make tea: 5: Me, Cat`)

    expect(svg).toContain('data-label="Go to work"')
    expect(svg).toContain('data-score="5"')
    expect(svg).toContain('data-actors="Me, Cat"')
    expect(svg).toContain('data-actor="Me"')
    expect(svg).toContain('data-actor="Cat"')
  })

  it('renders the correct number of filled and empty score cells', () => {
    const svg = render(`journey
      section Work
      Do work: 3: Me`)

    const filledCount = (svg.match(/class="journey-score-cell-filled"/g) ?? []).length
    const emptyCount = (svg.match(/class="journey-score-cell-empty"/g) ?? []).length
    expect(filledCount).toBe(3)
    expect(emptyCount).toBe(2)
  })

  it('renders multiline labels with tspans', () => {
    const svg = render(`journey
      title Product<br>journey
      section Go<br>to work
      Make<br>tea: 5: Me`)

    expect(svg).toContain('<tspan')
    expect(svg).toContain('Product')
    expect(svg).toContain('journey')
    expect(svg).toContain('Make')
    expect(svg).toContain('tea')
  })

  it('supports CSS variable colors without NaN output', () => {
    const svg = render(`journey
      section Work
      Deep work: 4: Me`, {
      bg: 'var(--background)',
      fg: 'var(--foreground)',
      accent: 'var(--accent)',
    })

    expect(svg).toContain('--bg:var(--background)')
    expect(svg).toContain('--fg:var(--foreground)')
    expect(svg).not.toContain('NaN')
  })
})
