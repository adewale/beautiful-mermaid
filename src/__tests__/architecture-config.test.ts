import { describe, expect, it } from 'bun:test'
import { resolveArchitectureRenderConfig } from '../architecture/config.ts'
import { preprocessMermaidSource } from '../mermaid-source.ts'

function resolve(text: string, options = {}) {
  return resolveArchitectureRenderConfig(preprocessMermaidSource(text).config, options)
}

describe('resolveArchitectureRenderConfig', () => {
  it('merges Mermaid wrappers into architecture theme and sizing semantics', () => {
    const resolved = resolve(`---
config:
  theme: forest
  themeVariables:
    background: "#0b1120"
    mainBkg: "#0f172a"
    clusterBkg: "#111827"
    clusterBorder: "#38bdf8"
    fontFamily: IBM Plex Sans
    fontSize: 15
---
%%{init: {
  "theme": "neutral",
  "themeVariables": {
    "lineColor": "#f59e0b",
    "primaryColor": "#38bdf8"
  },
  "architecture": {
    "padding": 60,
    "iconSize": 26,
    "fontSize": 16
  }
}}%%
architecture-beta
  service api(server)[API]`)

    expect(resolved.colors.bg).toBe('#0b1120')
    expect(resolved.colors.fg).toBe('#F8FAFC')
    expect(resolved.colors.line).toBe('#f59e0b')
    expect(resolved.colors.accent).toBe('#38bdf8')
    expect(resolved.colors.surface).toBe('#0f172a')
    expect(resolved.font).toBe('IBM Plex Sans')
    expect(resolved.renderOptions.padding).toBe(60)
    expect(resolved.visual.serviceIconSize).toBe(26)
    expect(resolved.visual.iconSize).toBe(23)
    expect(resolved.visual.serviceFontSize).toBe(16)
    expect(resolved.visual.groupFontSize).toBe(15)
    expect(resolved.visual.edgeFontSize).toBe(14)
    expect(resolved.visual.groupHeaderHeight).toBe(35)
    expect(resolved.visual.groupSurface).toBe('#111827')
    expect(resolved.visual.groupBorder).toBe('#38bdf8')
  })

  it('lets explicit render options override Mermaid wrapper config', () => {
    const resolved = resolve(`---
config:
  theme: dark
  fontFamily: IBM Plex Sans
  architecture:
    padding: 72
---
architecture-beta
  service api(server)[API]`, {
      bg: '#fafaf9',
      fg: '#1c1917',
      line: '#ea580c',
      font: 'Space Grotesk',
      padding: 28,
    })

    expect(resolved.colors.bg).toBe('#fafaf9')
    expect(resolved.colors.fg).toBe('#1c1917')
    expect(resolved.colors.line).toBe('#ea580c')
    expect(resolved.font).toBe('Space Grotesk')
    expect(resolved.renderOptions.padding).toBe(28)
  })
})
