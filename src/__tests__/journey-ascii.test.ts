/**
 * Tests for journey ASCII rendering.
 */
import { describe, it, expect } from 'bun:test'
import { renderMermaidASCII } from '../ascii/index.ts'

function render(text: string, useAscii = false): string {
  return renderMermaidASCII(text, { colorMode: 'none', useAscii })
}

describe('journey ASCII', () => {
  it('renders a basic journey with title, section, score, and actors', () => {
    const result = render(`journey
      title My working day
      section Go to work
      Make tea: 5: Me`)

    expect(result).toContain('My working day')
    expect(result).toContain('[Go to work]')
    expect(result).toContain('●●●●● Make tea')
    expect(result).toContain('by Me')
  })

  it('renders multiple actors', () => {
    const result = render(`journey
      section Work
      Ship feature: 4: Me, QA`)

    expect(result).toContain('●●●●○ Ship feature')
    expect(result).toContain('by Me, QA')
  })

  it('uses ASCII-safe glyphs in ASCII mode', () => {
    const result = render(`journey
      section Work
      Deep work: 3: Me`, true)

    expect(result).toContain('###.. Deep work')
    expect(result).not.toContain('●')
    expect(result).not.toContain('○')
  })

  it('renders multiline task text on subsequent indented lines', () => {
    const result = render(`journey
      section Work
      Make<br>tea: 5: Me`)

    expect(result).toContain('Make')
    expect(result).toContain('tea')
  })
})
