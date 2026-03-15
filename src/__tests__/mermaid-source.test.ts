import { describe, expect, it } from 'bun:test'
import { normalizeMermaidSource } from '../mermaid-source.ts'

describe('normalizeMermaidSource', () => {
  it('merges base config, frontmatter config, and init directives in Mermaid order', () => {
    const normalized = normalizeMermaidSource(`---
config:
  themeVariables:
    cScale0: "#112233"
  timeline:
    disableMulticolor: true
---
%%{init: {"fontFamily":"IBM Plex Sans","timeline":{"sectionFills":["#224466"]}}}%%
%% comment
timeline
2024 : Launch`, {
      timeline: {
        disableMulticolor: false,
        sectionColours: ['#f8f8f8'],
      },
    })

    expect(normalized.firstLine).toBe('timeline')
    expect(normalized.lines).toEqual(['timeline', '2024 : Launch'])
    expect(normalized.config.fontFamily).toBe('IBM Plex Sans')
    expect(normalized.config.themeVariables?.cScale0).toBe('#112233')
    expect(normalized.config.timeline?.disableMulticolor).toBe(true)
    expect(normalized.config.timeline?.sectionFills).toEqual(['#224466'])
    expect(normalized.config.timeline?.sectionColours).toEqual(['#f8f8f8'])
  })

  it('supports initialize directives and quoted theme variable keys', () => {
    const normalized = normalizeMermaidSource(`%%{initialize: {"themeVariables":{"cScale1":"#336699","cScaleLabel1":"#ffffff"}}}%%
timeline
2025 : General availability`)

    expect(normalized.config.themeVariables?.cScale1).toBe('#336699')
    expect(normalized.config.themeVariables?.cScaleLabel1).toBe('#ffffff')
    expect(normalized.lines).toEqual(['timeline', '2025 : General availability'])
  })
})
