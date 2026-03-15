// ============================================================================
// Mermaid source normalization
//
// Strips leading frontmatter, blank lines, and Mermaid comment/directive lines
// so the public routers can detect the real diagram header consistently.
// ============================================================================

export interface NormalizedMermaidSource {
  text: string
  lines: string[]
  firstLine: string
}

export function normalizeMermaidSource(text: string): NormalizedMermaidSource {
  const rawLines = text.replace(/^\uFEFF/, '').split('\n')
  let start = 0

  while (start < rawLines.length && rawLines[start]!.trim().length === 0) {
    start++
  }

  if (rawLines[start]?.trim() === '---') {
    start++
    while (start < rawLines.length && rawLines[start]!.trim() !== '---') {
      start++
    }
    if (start < rawLines.length && rawLines[start]!.trim() === '---') {
      start++
    }
  }

  const lines = rawLines
    .slice(start)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('%%'))

  return {
    text: lines.join('\n'),
    lines,
    firstLine: lines[0]?.toLowerCase() ?? '',
  }
}
