/**
 * Integration tests for timeline diagrams — end-to-end parse → layout → render.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'
import type { RenderOptions } from '../types.ts'

function render(text: string, options: RenderOptions = {}): string {
  return renderMermaidSVG(text, options)
}

describe('renderMermaidSVG – timeline diagrams', () => {
  it('renders a basic timeline to valid SVG', () => {
    const svg = render(`timeline
      title Product history
      2022 : Private alpha
      2023 : Public launch`)

    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
    expect(svg).toContain('Product history')
    expect(svg).toContain('class="timeline-rail"')
    expect(svg).toContain('class="timeline-period"')
    expect(svg).toContain('class="timeline-event"')
  })

  it('renders section frames and semantic data attributes', () => {
    const svg = render(`timeline
      title Beautiful Mermaid
      section Foundation
      2020 : Prototype
      section Growth
      2021 : Launch`)

    expect(svg).toContain('class="timeline-section"')
    expect(svg).toContain('data-label="Foundation"')
    expect(svg).toContain('data-section="Growth"')
    expect(svg).toContain('Prototype')
    expect(svg).toContain('Launch')
  })

  it('renders multiple events for a single period', () => {
    const svg = render(`timeline
      2024 : Design refresh
           : Timeline support
           : Packaging polish`)

    const eventCount = (svg.match(/class="timeline-event"/g) ?? []).length
    expect(eventCount).toBe(3)
    expect(svg).toContain('data-period="2024"')
    expect(svg).toContain('Timeline support')
  })

  it('renders multiline labels with tspans', () => {
    const svg = render(`timeline
      title Product<br>history
      section Platform<br>work
      2024<br>Q1 : Soft<br>launch`)

    expect(svg).toContain('<tspan')
    expect(svg).toContain('Product')
    expect(svg).toContain('history')
    expect(svg).toContain('Soft')
    expect(svg).toContain('launch')
  })

  it('supports dark themes and CSS variable colors without NaN output', () => {
    const svg = render(`timeline
      2024 : Timeline support`, {
      bg: 'var(--background)',
      fg: 'var(--foreground)',
      accent: 'var(--accent)',
    })

    expect(svg).toContain('--bg:var(--background)')
    expect(svg).toContain('--fg:var(--foreground)')
    expect(svg).not.toContain('NaN')
  })
})
