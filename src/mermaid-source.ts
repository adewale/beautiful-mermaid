// ============================================================================
// Mermaid source normalization + config extraction
//
// Handles:
//   - UTF-8 BOM stripping
//   - leading YAML frontmatter
//   - Mermaid directives / init blocks (%%{init: ...}%%)
//   - Mermaid comment stripping (%% ...)
//   - normalized, trimmed diagram lines for downstream parsers
// ============================================================================

export type MermaidConfigScalar = string | number | boolean

export interface MermaidThemeVariables {
  fontFamily?: string
  [key: string]: MermaidConfigScalar | undefined
}

export interface TimelineRuntimeConfig {
  disableMulticolor?: boolean
  sectionFills?: string[]
  sectionColours?: string[]
}

export interface MermaidRuntimeConfig {
  theme?: string
  fontFamily?: string
  themeVariables?: MermaidThemeVariables
  timeline?: TimelineRuntimeConfig
}

export interface NormalizedMermaidSource {
  text: string
  lines: string[]
  firstLine: string
  config: MermaidRuntimeConfig
}

export function normalizeMermaidSource(
  text: string,
  baseConfig: MermaidRuntimeConfig = {},
): NormalizedMermaidSource {
  const rawLines = text.replace(/^\uFEFF/, '').split('\n')
  let index = 0
  let config = mergeMermaidConfigs(baseConfig)

  while (index < rawLines.length && rawLines[index]!.trim().length === 0) {
    index++
  }

  if (rawLines[index]?.trim() === '---') {
    const frontmatter = collectFrontmatter(rawLines, index)
    if (frontmatter) {
      config = mergeMermaidConfigs(config, frontmatter.config)
      index = frontmatter.nextIndex
    }
  }

  const lines: string[] = []

  while (index < rawLines.length) {
    const rawLine = rawLines[index]!
    const trimmed = rawLine.trim()

    if (trimmed.startsWith('%%{')) {
      const directive = collectDirective(rawLines, index)
      config = mergeMermaidConfigs(config, directive.config)
      index = directive.nextIndex
      continue
    }

    if (trimmed.length > 0 && !trimmed.startsWith('%%')) {
      lines.push(trimmed)
    }

    index++
  }

  return {
    text: lines.join('\n'),
    lines,
    firstLine: lines[0]?.toLowerCase() ?? '',
    config,
  }
}

export function mergeMermaidConfigs(...configs: MermaidRuntimeConfig[]): MermaidRuntimeConfig {
  const merged: Record<string, unknown> = {}

  for (const config of configs) {
    mergeInto(merged, config as Record<string, unknown>)
  }

  return merged as MermaidRuntimeConfig
}

function mergeInto(target: Record<string, unknown>, source: Record<string, unknown> | undefined): void {
  if (!source) return

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue

    if (Array.isArray(value)) {
      target[key] = value.slice()
      continue
    }

    if (isPlainObject(value)) {
      const existing = isPlainObject(target[key]) ? target[key] as Record<string, unknown> : {}
      target[key] = existing
      mergeInto(existing, value)
      continue
    }

    target[key] = value
  }
}

function collectFrontmatter(rawLines: string[], startIndex: number): { config: MermaidRuntimeConfig; nextIndex: number } | undefined {
  const content: string[] = []
  let index = startIndex + 1

  while (index < rawLines.length && rawLines[index]!.trim() !== '---') {
    content.push(rawLines[index]!)
    index++
  }

  if (index >= rawLines.length) return undefined

  const parsed = parseYamlDocument(content)
  const frontmatter = isPlainObject(parsed) && isPlainObject(parsed.config)
    ? parsed.config
    : parsed

  return {
    config: normalizeMermaidRuntimeConfig(frontmatter),
    nextIndex: index + 1,
  }
}

function collectDirective(rawLines: string[], startIndex: number): { config: MermaidRuntimeConfig; nextIndex: number } {
  const buffer: string[] = []
  let index = startIndex

  while (index < rawLines.length) {
    buffer.push(rawLines[index]!)
    if (rawLines[index]!.includes('}%%')) break
    index++
  }

  const rawDirective = buffer.join('\n').trim()
  const directiveBody = rawDirective.replace(/^%%\{/, '').replace(/\}%%$/, '').trim()
  const wrappedBody = directiveBody.startsWith('{') ? directiveBody : `{${directiveBody}}`
  const parsed = parseObjectLiteral(wrappedBody)
  const directiveConfig = isPlainObject(parsed) && (isPlainObject(parsed.init) || isPlainObject(parsed.initialize))
    ? (parsed.init ?? parsed.initialize)
    : parsed

  return {
    config: normalizeMermaidRuntimeConfig(directiveConfig),
    nextIndex: index + 1,
  }
}

function normalizeMermaidRuntimeConfig(raw: unknown): MermaidRuntimeConfig {
  if (!isPlainObject(raw)) return {}

  const config: MermaidRuntimeConfig = {}

  if (typeof raw.theme === 'string') config.theme = raw.theme
  if (typeof raw.fontFamily === 'string') config.fontFamily = raw.fontFamily

  if (isPlainObject(raw.themeVariables)) {
    const themeVariables: MermaidThemeVariables = {}
    for (const [key, value] of Object.entries(raw.themeVariables)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        themeVariables[key] = value
      }
    }
    if (Object.keys(themeVariables).length > 0) config.themeVariables = themeVariables
  }

  if (isPlainObject(raw.timeline)) {
    const timeline = normalizeTimelineRuntimeConfig(raw.timeline)
    if (Object.keys(timeline).length > 0) config.timeline = timeline
  }

  return config
}

function normalizeTimelineRuntimeConfig(raw: Record<string, unknown>): TimelineRuntimeConfig {
  const config: TimelineRuntimeConfig = {}

  if (typeof raw.disableMulticolor === 'boolean') config.disableMulticolor = raw.disableMulticolor

  const sectionFills = normalizeStringArray(raw.sectionFills)
  if (sectionFills.length > 0) config.sectionFills = sectionFills

  const sectionColours = normalizeStringArray(raw.sectionColours)
  const sectionColors = normalizeStringArray(raw.sectionColors)
  const sectionPalette = sectionColours.length > 0 ? sectionColours : sectionColors
  if (sectionPalette.length > 0) config.sectionColours = sectionPalette

  return config
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function parseYamlDocument(lines: string[]): unknown {
  const prepared = dedentYamlLines(lines.map(line => line.replace(/\t/g, '    ')))
  const { value } = parseYamlBlock(prepared, 0, 0)
  return value
}

function dedentYamlLines(lines: string[]): string[] {
  const indents = lines
    .filter(line => stripYamlComment(line).trim().length > 0)
    .map(countIndent)

  const minIndent = indents.length > 0 ? Math.min(...indents) : 0
  if (minIndent === 0) return lines

  return lines.map(line => line.slice(Math.min(minIndent, line.length)))
}

function parseYamlBlock(lines: string[], startIndex: number, indent: number): { value: unknown; nextIndex: number } {
  let index = startIndex

  while (index < lines.length) {
    const trimmed = stripYamlComment(lines[index]!).trim()
    if (trimmed.length === 0) {
      index++
      continue
    }
    break
  }

  if (index >= lines.length) return { value: {}, nextIndex: index }

  const firstIndent = countIndent(lines[index]!)
  if (firstIndent < indent) return { value: {}, nextIndex: index }

  const firstTrimmed = stripYamlComment(lines[index]!).trim()
  if (firstTrimmed.startsWith('-')) {
    const items: unknown[] = []

    while (index < lines.length) {
      const line = stripYamlComment(lines[index]!)
      const trimmed = line.trim()
      if (trimmed.length === 0) {
        index++
        continue
      }

      const currentIndent = countIndent(line)
      if (currentIndent < indent) break
      if (!trimmed.startsWith('-')) break

      const rest = trimmed.slice(1).trim()
      index++

      if (rest.length === 0) {
        const nested = parseYamlBlock(lines, index, currentIndent + 2)
        items.push(nested.value)
        index = nested.nextIndex
      } else if (looksLikeYamlKeyValue(rest)) {
        const synthetic = `${' '.repeat(currentIndent + 2)}${rest}`
        const nestedLines = [synthetic]
        let nestedIndex = index

        while (nestedIndex < lines.length) {
          const candidate = lines[nestedIndex]!
          const candidateTrimmed = stripYamlComment(candidate).trim()
          if (candidateTrimmed.length === 0) {
            nestedLines.push(candidate)
            nestedIndex++
            continue
          }
          if (countIndent(candidate) <= currentIndent) break
          nestedLines.push(candidate)
          nestedIndex++
        }

        const nested = parseYamlBlock(nestedLines, 0, currentIndent + 2)
        items.push(nested.value)
        index = nestedIndex
      } else {
        items.push(parseYamlScalar(rest))
      }
    }

    return { value: items, nextIndex: index }
  }

  const object: Record<string, unknown> = {}

  while (index < lines.length) {
    const line = stripYamlComment(lines[index]!)
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      index++
      continue
    }

    const currentIndent = countIndent(line)
    if (currentIndent < indent) break
    if (currentIndent > indent) {
      throw new Error(`Invalid Mermaid frontmatter indentation near "${trimmed}"`)
    }

    const match = trimmed.match(/^([^:]+):(?:\s+(.*))?$/)
    if (!match) {
      throw new Error(`Invalid Mermaid frontmatter entry: "${trimmed}"`)
    }

    const key = match[1]!.trim()
    const valuePart = match[2]
    index++

    if (valuePart === undefined || valuePart.trim().length === 0) {
      const nested = parseYamlBlock(lines, index, currentIndent + 2)
      object[key] = nested.value
      index = nested.nextIndex
      continue
    }

    object[key] = parseYamlScalar(valuePart.trim())
  }

  return { value: object, nextIndex: index }
}

function stripYamlComment(line: string): string {
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!
    const prev = i > 0 ? line[i - 1]! : ''

    if (char === "'" && !inDouble && prev !== '\\') inSingle = !inSingle
    if (char === '"' && !inSingle && prev !== '\\') inDouble = !inDouble

    if (char === '#' && !inSingle && !inDouble) {
      return line.slice(0, i)
    }
  }

  return line
}

function parseYamlScalar(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value)

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return parseStringLiteral(value)
  }

  if (value.startsWith('[') || value.startsWith('{')) {
    return parseObjectLiteral(value)
  }

  return value
}

function looksLikeYamlKeyValue(value: string): boolean {
  return /^[^:[\]{}][^:]*:(?:\s+.*)?$/.test(value)
}

function countIndent(line: string): number {
  let count = 0
  while (count < line.length && line[count] === ' ') count++
  return count
}

type LiteralToken =
  | { type: 'brace-open' | 'brace-close' | 'bracket-open' | 'bracket-close' | 'colon' | 'comma' }
  | { type: 'string'; value: string }
  | { type: 'number'; value: number }
  | { type: 'boolean'; value: boolean }
  | { type: 'null'; value: null }
  | { type: 'identifier'; value: string }

function parseObjectLiteral(input: string): unknown {
  const tokens = tokenizeLiteral(input)
  let index = 0

  const parseValue = (): unknown => {
    const token = tokens[index]
    if (!token) throw new Error('Unexpected end of Mermaid config')

    switch (token.type) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'null':
        index++
        return token.value

      case 'brace-open':
        return parseObject()

      case 'bracket-open':
        return parseArray()

      case 'identifier':
        index++
        if (token.value === 'true') return true
        if (token.value === 'false') return false
        if (token.value === 'null') return null
        return token.value

      default:
        throw new Error(`Unexpected Mermaid config token: ${token.type}`)
    }
  }

  const parseObject = (): Record<string, unknown> => {
    expectToken('brace-open')
    const object: Record<string, unknown> = {}

    while (!peekToken('brace-close')) {
      const keyToken = tokens[index]
      if (!keyToken || (keyToken.type !== 'identifier' && keyToken.type !== 'string')) {
        throw new Error('Expected Mermaid config object key')
      }

      index++
      const key = keyToken.value
      expectToken('colon')
      object[key] = parseValue()

      if (peekToken('comma')) index++
    }

    expectToken('brace-close')
    return object
  }

  const parseArray = (): unknown[] => {
    expectToken('bracket-open')
    const array: unknown[] = []

    while (!peekToken('bracket-close')) {
      array.push(parseValue())
      if (peekToken('comma')) index++
    }

    expectToken('bracket-close')
    return array
  }

  const expectToken = (type: LiteralToken['type']): void => {
    const token = tokens[index]
    if (!token || token.type !== type) {
      throw new Error(`Expected Mermaid config token ${type}`)
    }
    index++
  }

  const peekToken = (type: LiteralToken['type']): boolean => tokens[index]?.type === type

  const value = parseValue()
  if (index < tokens.length) {
    throw new Error('Unexpected trailing Mermaid config tokens')
  }
  return value
}

function tokenizeLiteral(input: string): LiteralToken[] {
  const tokens: LiteralToken[] = []
  let index = 0

  while (index < input.length) {
    const char = input[index]!

    if (/\s/.test(char)) {
      index++
      continue
    }

    if (char === '{') {
      tokens.push({ type: 'brace-open' })
      index++
      continue
    }
    if (char === '}') {
      tokens.push({ type: 'brace-close' })
      index++
      continue
    }
    if (char === '[') {
      tokens.push({ type: 'bracket-open' })
      index++
      continue
    }
    if (char === ']') {
      tokens.push({ type: 'bracket-close' })
      index++
      continue
    }
    if (char === ':') {
      tokens.push({ type: 'colon' })
      index++
      continue
    }
    if (char === ',') {
      tokens.push({ type: 'comma' })
      index++
      continue
    }

    if (char === '"' || char === "'") {
      const { value, nextIndex } = readStringLiteral(input, index)
      tokens.push({ type: 'string', value })
      index = nextIndex
      continue
    }

    const numberMatch = input.slice(index).match(/^-?\d+(?:\.\d+)?/)
    if (numberMatch) {
      tokens.push({ type: 'number', value: Number(numberMatch[0]) })
      index += numberMatch[0].length
      continue
    }

    const identifierMatch = input.slice(index).match(/^[A-Za-z_$][\w$-]*/)
    if (identifierMatch) {
      const value = identifierMatch[0]
      if (value === 'true' || value === 'false') {
        tokens.push({ type: 'boolean', value: value === 'true' })
      } else if (value === 'null') {
        tokens.push({ type: 'null', value: null })
      } else {
        tokens.push({ type: 'identifier', value })
      }
      index += value.length
      continue
    }

    throw new Error(`Unsupported Mermaid config character: "${char}"`)
  }

  return tokens
}

function readStringLiteral(input: string, startIndex: number): { value: string; nextIndex: number } {
  const quote = input[startIndex]!
  let value = ''
  let index = startIndex + 1

  while (index < input.length) {
    const char = input[index]!

    if (char === '\\') {
      const next = input[index + 1]
      if (next !== undefined) {
        value += decodeEscape(next)
        index += 2
        continue
      }
    }

    if (char === quote) {
      return { value, nextIndex: index + 1 }
    }

    value += char
    index++
  }

  throw new Error('Unterminated Mermaid config string literal')
}

function parseStringLiteral(value: string): string {
  return readStringLiteral(value, 0).value
}

function decodeEscape(char: string): string {
  switch (char) {
    case 'n': return '\n'
    case 'r': return '\r'
    case 't': return '\t'
    case '"': return '"'
    case "'": return "'"
    case '\\': return '\\'
    default: return char
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
