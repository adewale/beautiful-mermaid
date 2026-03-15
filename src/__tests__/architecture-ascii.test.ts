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
})
