/**
 * Journey-specific theme coverage for built-in light and dark palettes.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidSVG } from '../index.ts'
import { THEMES } from '../theme.ts'

const source = `journey
  title My working day
  section Go to work
  Make tea: 5: Me
  Go upstairs: 3: Me
  section Go home
  Sit down: 3: Me`

describe('renderMermaidSVG – journey themes', () => {
  it('renders correctly with the built-in light theme palette', () => {
    const svg = renderMermaidSVG(source, THEMES['github-light'])

    expect(svg).toContain('--bg:#ffffff')
    expect(svg).toContain('--fg:#1f2328')
    expect(svg).toContain('--accent:#0969da')
    expect(svg).toContain('--line:#d1d9e0')
    expect(svg).toContain('class="journey-task-card"')
    expect(svg).not.toContain('NaN')
  })

  it('renders correctly with the built-in dark theme palette', () => {
    const svg = renderMermaidSVG(source, THEMES['github-dark'])

    expect(svg).toContain('--bg:#0d1117')
    expect(svg).toContain('--fg:#e6edf3')
    expect(svg).toContain('--accent:#4493f8')
    expect(svg).toContain('--line:#3d444d')
    expect(svg).toContain('class="journey-task-card"')
    expect(svg).not.toContain('NaN')
  })
})
