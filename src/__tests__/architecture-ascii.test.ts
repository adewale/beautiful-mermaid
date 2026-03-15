import { describe, expect, it } from 'bun:test'
import { renderMermaidASCII } from '../ascii/index.ts'

describe('renderMermaidASCII – architecture diagrams', () => {
  it('renders architecture diagrams through the dedicated ASCII entrypoint', () => {
    const ascii = renderMermaidASCII(`architecture-beta
      group app(cloud)[Application]
      service api(server)[API] in app
      service db(database)[Database]
      api:R --> L:db`, { useAscii: true })

    expect(ascii).toContain('API')
    expect(ascii).toContain('Database')
    expect(ascii).toContain('>')
  })

  it('renders architecture diagrams in unicode mode and skips leading comments', () => {
    const ascii = renderMermaidASCII(`---
config:
  theme: neutral
---
      %%{init: { "theme": "neutral" }}%%
      %% generated sample
      architecture-beta
      group app(cloud)[Application]
      service api(server)[API] in app
      service db(database)[Database]
      api:R --> L:db`)

    expect(ascii).toContain('Applicati')
    expect(ascii).toContain('API')
    expect(ascii).toContain('Database')
    expect(ascii).toContain('┌')
  })

  it('derives HTML colors from Mermaid wrapper theme variables', () => {
    const ascii = renderMermaidASCII(`---
config:
  theme: dark
  themeVariables:
    lineColor: "#f59e0b"
    primaryColor: "#38bdf8"
---
      architecture-beta
      service api(server)[API]
      service db(database)[Database]
      api:R --> L:db`, {
      colorMode: 'html',
    })

    expect(ascii).toContain('color:#f59e0b')
    expect(ascii).toContain('color:#38bdf8')
  })
})
