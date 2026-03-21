import { describe, expect, it } from 'bun:test'
import { resolveArchitectureVisualConfig } from '../architecture/config.ts'
import { preprocessMermaidSource } from '../mermaid-source.ts'
import type { DiagramColors } from '../theme.ts'

function resolve(text: string, colors: DiagramColors = { bg: '#ffffff', fg: '#1f2937' }) {
  return resolveArchitectureVisualConfig(preprocessMermaidSource(text).frontmatter, colors)
}

describe('resolveArchitectureVisualConfig', () => {
  it('computes visual metrics from architecture frontmatter config', () => {
    const resolved = resolve(`---
config:
  themeVariables:
    clusterBkg: "#111827"
    clusterBorder: "#38bdf8"
  architecture:
    padding: 60
    iconSize: 26
    fontSize: 16
---
architecture-beta
  service api(server)[API]`, {
      bg: '#0b1120',
      fg: '#F8FAFC',
      line: '#f59e0b',
      accent: '#38bdf8',
      surface: '#0f172a',
    })

    expect(resolved.padding).toBe(60)
    expect(resolved.visual.serviceIconSize).toBe(26)
    expect(resolved.visual.iconSize).toBe(23)
    expect(resolved.visual.serviceFontSize).toBe(16)
    expect(resolved.visual.groupFontSize).toBe(15)
    expect(resolved.visual.edgeFontSize).toBe(14)
    expect(resolved.visual.groupHeaderHeight).toBe(35)
    expect(resolved.visual.groupSurface).toBe('#111827')
    expect(resolved.visual.groupBorder).toBe('#38bdf8')
  })

  it('falls back to DiagramColors when no theme variables present', () => {
    const resolved = resolve(`architecture-beta
  service api(server)[API]`, {
      bg: '#fafaf9',
      fg: '#1c1917',
      surface: '#e7e5e4',
      border: '#a8a29e',
    })

    expect(resolved.visual.groupSurface).toBe('#e7e5e4')
    expect(resolved.visual.groupBorder).toBe('#a8a29e')
    expect(resolved.visual.serviceSurface).toBe('#e7e5e4')
    expect(resolved.visual.serviceBorder).toBe('#a8a29e')
  })
})
