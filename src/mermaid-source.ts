// ============================================================================
// Mermaid source normalization + config extraction
//
// Handles:
//   - UTF-8 BOM stripping
//   - leading YAML frontmatter
//   - Mermaid directives / init blocks (%%{init: ...}%%)
//   - Mermaid comment stripping for downstream line-based parsers
//   - normalized, trimmed diagram lines for downstream parsers
// ============================================================================

export type MermaidConfigScalar = string | number | boolean | null
export type MermaidConfigValue = MermaidConfigScalar | MermaidConfigValue[] | MermaidConfigMap

export interface MermaidConfigMap {
  [key: string]: MermaidConfigValue | undefined
}

export type MermaidFrontmatterScalar = MermaidConfigScalar
export type MermaidFrontmatterValue = MermaidConfigValue
export type MermaidFrontmatterList = MermaidFrontmatterValue[]

export interface MermaidFrontmatterMap extends MermaidConfigMap {}

export interface MermaidThemeVariables extends MermaidConfigMap {
  fontFamily?: string
}

export interface TimelineRuntimeConfig extends MermaidConfigMap {
  disableMulticolor?: boolean
  sectionFills?: string[]
  sectionColours?: string[]
}

export interface MermaidRuntimeConfig extends MermaidConfigMap {
  theme?: string
  fontFamily?: string
  themeVariables?: MermaidThemeVariables
  timeline?: TimelineRuntimeConfig
  xyChart?: MermaidConfigMap
  useMaxWidth?: boolean
  useWidth?: number
  themeCSS?: string
}

export interface ProcessedMermaidSource {
  body: string
  lines: string[]
  frontmatter: MermaidFrontmatterMap
}

export interface NormalizedMermaidSource {
  text: string
  lines: string[]
  firstLine: string
  config: MermaidRuntimeConfig
  frontmatter: MermaidFrontmatterMap
}

const FRONTMATTER_REGEX = /^\uFEFF?\s*---\s*\r?\n([\s\S]*?)\r?\n\s*---\s*(?:\r?\n|$)/
const INIT_DIRECTIVE_REGEX = /^\s*%%\{\s*(?:init|initialize)\s*:\s*([\s\S]*?)\}\s*%%\s*(?:\r?\n|$)?/gm

export function normalizeMermaidSource(
  text: string,
  baseConfig: MermaidRuntimeConfig = {},
): NormalizedMermaidSource {
  const processed = preprocessMermaidSource(text, runtimeConfigToFrontmatterMap(baseConfig))

  return {
    text: processed.lines.join('\n'),
    lines: processed.lines,
    firstLine: processed.lines[0]?.toLowerCase() ?? '',
    config: normalizeMermaidRuntimeConfig(processed.frontmatter),
    frontmatter: processed.frontmatter,
  }
}

export function preprocessMermaidSource(
  text: string,
  baseFrontmatter: MermaidFrontmatterMap = {},
): ProcessedMermaidSource {
  const frontmatterMatch = text.match(FRONTMATTER_REGEX)
  const yamlFrontmatter = frontmatterMatch ? canonicalizeFrontmatterMap(parseFrontmatter(frontmatterMatch[1]!)) : {}
  const rawBody = frontmatterMatch ? text.slice(frontmatterMatch[0].length) : text
  const { body, frontmatter: directiveFrontmatter } = extractInitDirectives(rawBody)
  const frontmatter = mergeFrontmatterMaps(
    mergeFrontmatterMaps(canonicalizeFrontmatterMap(baseFrontmatter), yamlFrontmatter),
    canonicalizeFrontmatterMap(directiveFrontmatter),
  )

  return {
    body,
    lines: toMermaidLines(body),
    frontmatter,
  }
}

export function toMermaidLines(text: string): string[] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('%%'))
}

export function mergeMermaidConfigs(...configs: MermaidRuntimeConfig[]): MermaidRuntimeConfig {
  const merged: MermaidFrontmatterMap = {}

  for (const config of configs) {
    mergeInto(merged, runtimeConfigToFrontmatterMap(config))
  }

  return normalizeMermaidRuntimeConfig(merged)
}

export function mergeFrontmatterMaps(
  base: MermaidFrontmatterMap,
  override: MermaidFrontmatterMap,
): MermaidFrontmatterMap {
  const merged = cloneFrontmatterMap(base)

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue

    const existing = merged[key]
    if (isFrontmatterMap(existing) && isFrontmatterMap(value)) {
      merged[key] = mergeFrontmatterMaps(existing, value)
      continue
    }

    merged[key] = cloneFrontmatterValue(value)
  }

  return merged
}

export function getFrontmatterMap(
  root: MermaidFrontmatterMap,
  path: readonly string[],
): MermaidFrontmatterMap | undefined {
  let current: MermaidFrontmatterValue | undefined = root
  for (const segment of path) {
    if (!isFrontmatterMap(current)) return undefined
    current = current[segment]
  }
  return isFrontmatterMap(current) ? current : undefined
}

export function getFrontmatterScalar<T extends MermaidFrontmatterScalar>(
  root: MermaidFrontmatterMap,
  path: readonly string[],
): T | undefined {
  let current: MermaidFrontmatterValue | undefined = root
  for (const segment of path) {
    if (!isFrontmatterMap(current)) return undefined
    current = current[segment]
  }
  return current !== undefined && !Array.isArray(current) && (typeof current !== 'object' || current === null)
    ? current as T
    : undefined
}

export function getFrontmatterList<T extends MermaidFrontmatterValue = MermaidFrontmatterValue>(
  root: MermaidFrontmatterMap,
  path: readonly string[],
): T[] | undefined {
  let current: MermaidFrontmatterValue | undefined = root
  for (const segment of path) {
    if (!isFrontmatterMap(current)) return undefined
    current = current[segment]
  }
  return Array.isArray(current) ? current as T[] : undefined
}

function runtimeConfigToFrontmatterMap(config: MermaidRuntimeConfig): MermaidFrontmatterMap {
  return canonicalizeFrontmatterMap(toFrontmatterMap(config) ?? {})
}

function normalizeMermaidRuntimeConfig(raw: MermaidFrontmatterMap): MermaidRuntimeConfig {
  const config = cloneFrontmatterMap(raw) as MermaidRuntimeConfig

  if (isFrontmatterMap(config.themeVariables)) {
    config.themeVariables = cloneFrontmatterMap(config.themeVariables) as MermaidThemeVariables
  }

  if (isFrontmatterMap(config.timeline)) {
    config.timeline = normalizeTimelineRuntimeConfig(config.timeline)
  }

  return config
}

function normalizeTimelineRuntimeConfig(raw: MermaidFrontmatterMap): TimelineRuntimeConfig {
  const config = cloneFrontmatterMap(raw) as TimelineRuntimeConfig

  if (typeof config.disableMulticolor !== 'boolean') {
    delete config.disableMulticolor
  }

  const sectionFills = normalizeStringArray(config.sectionFills)
  if (sectionFills.length > 0) {
    config.sectionFills = sectionFills
  } else {
    delete config.sectionFills
  }

  const sectionColours = normalizeStringArray(config.sectionColours)
  const sectionColors = normalizeStringArray((config as MermaidFrontmatterMap).sectionColors)
  if (sectionColours.length > 0) {
    config.sectionColours = sectionColours
  } else if (sectionColors.length > 0) {
    config.sectionColours = sectionColors
  } else {
    delete config.sectionColours
  }

  delete (config as MermaidFrontmatterMap).sectionColors
  return config
}

function normalizeStringArray(value: MermaidConfigValue | undefined): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function mergeInto(target: MermaidFrontmatterMap, source: MermaidFrontmatterMap | undefined): void {
  if (!source) return

  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue

    if (Array.isArray(value)) {
      target[key] = value.map(entry => cloneFrontmatterValue(entry)!)
      continue
    }

    if (isFrontmatterMap(value)) {
      const existing = isFrontmatterMap(target[key]) ? target[key] as MermaidFrontmatterMap : {}
      target[key] = existing
      mergeInto(existing, value)
      continue
    }

    target[key] = value
  }
}

function canonicalizeFrontmatterMap(raw: MermaidFrontmatterMap): MermaidFrontmatterMap {
  const topLevel = cloneFrontmatterMap(raw)
  const configRoot = isFrontmatterMap(topLevel.config) ? topLevel.config : undefined
  delete topLevel.config

  return configRoot ? mergeFrontmatterMaps(configRoot, topLevel) : topLevel
}

function parseFrontmatter(text: string): MermaidFrontmatterMap {
  const lines = text.split(/\r?\n/)
  const firstIndex = skipYamlNoise(lines, 0)
  if (firstIndex >= lines.length) return {}

  const baseIndent = getIndent(lines[firstIndex]!)
  const state = { lines, index: firstIndex }
  return parseYamlMap(state, baseIndent).value
}

function extractInitDirectives(text: string): { body: string; frontmatter: MermaidFrontmatterMap } {
  let merged: MermaidFrontmatterMap = {}

  const body = text.replace(INIT_DIRECTIVE_REGEX, (_match, payload: string) => {
    const parsed = parseDirectiveMap(payload)
    if (parsed) merged = mergeFrontmatterMaps(merged, canonicalizeFrontmatterMap(parsed))
    return ''
  })

  return { body, frontmatter: merged }
}

function parseDirectiveMap(text: string): MermaidFrontmatterMap | undefined {
  try {
    return toFrontmatterMap(JSON.parse(text))
  } catch {
    return parseLooseObjectLiteral(text)
  }
}

function toFrontmatterMap(value: unknown): MermaidFrontmatterMap | undefined {
  if (!isPlainObject(value)) return undefined

  const map: MermaidFrontmatterMap = {}
  for (const [key, entry] of Object.entries(value)) {
    const parsed = toFrontmatterValue(entry)
    if (parsed !== undefined) map[key] = parsed
  }
  return map
}

function toFrontmatterValue(value: unknown): MermaidFrontmatterValue | undefined {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value

  if (Array.isArray(value)) {
    const items: MermaidFrontmatterList = []
    for (const entry of value) {
      const parsed = toFrontmatterValue(entry)
      if (parsed === undefined) return undefined
      items.push(parsed)
    }
    return items
  }

  return toFrontmatterMap(value)
}

function cloneFrontmatterMap(value: MermaidFrontmatterMap): MermaidFrontmatterMap {
  const clone: MermaidFrontmatterMap = {}
  for (const [key, entry] of Object.entries(value)) {
    clone[key] = cloneFrontmatterValue(entry)
  }
  return clone
}

function cloneFrontmatterValue(value: MermaidFrontmatterValue | undefined): MermaidFrontmatterValue | undefined {
  if (value === undefined || value === null) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.map(entry => cloneFrontmatterValue(entry)!)
  return cloneFrontmatterMap(value)
}

function isFrontmatterMap(value: MermaidFrontmatterValue | undefined): value is MermaidFrontmatterMap {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseScalar(valueText: string): MermaidFrontmatterScalar {
  if ((valueText.startsWith('"') && valueText.endsWith('"')) || (valueText.startsWith("'") && valueText.endsWith("'"))) {
    return unescapeQuotedString(valueText)
  }
  if (valueText === 'true') return true
  if (valueText === 'false') return false
  if (valueText === 'null') return null
  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(valueText)) return Number(valueText)
  return valueText
}

function parseLooseObjectLiteral(text: string): MermaidFrontmatterMap | undefined {
  const parsed = parseFlowValue(text.trim())
  return isFrontmatterMap(parsed) ? parsed : undefined
}

function parseFlowValue(text: string): MermaidFrontmatterValue | undefined {
  const trimmed = text.trim()
  if (trimmed.length === 0) return undefined

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return parseFlowMap(trimmed.slice(1, -1))
  }
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return parseFlowList(trimmed.slice(1, -1))
  }

  return parseScalar(trimmed)
}

function parseFlowMap(text: string): MermaidFrontmatterMap | undefined {
  const map: MermaidFrontmatterMap = {}
  for (const entry of splitFlowEntries(text)) {
    const colonIdx = findSeparatorIndex(entry, ':')
    if (colonIdx === -1) return undefined

    const rawKey = entry.slice(0, colonIdx).trim()
    const rawValue = entry.slice(colonIdx + 1).trim()
    const key = parseFlowKey(rawKey)
    if (!key) return undefined

    const value = parseFlowValue(rawValue)
    if (value === undefined) return undefined
    map[key] = value
  }
  return map
}

function parseFlowList(text: string): MermaidFrontmatterList | undefined {
  const values: MermaidFrontmatterList = []
  for (const entry of splitFlowEntries(text)) {
    const value = parseFlowValue(entry)
    if (value === undefined) return undefined
    values.push(value)
  }
  return values
}

function parseFlowKey(text: string): string | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return unescapeQuotedString(trimmed)
  }
  return trimmed
}

function splitFlowEntries(text: string): string[] {
  const entries: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  let braceDepth = 0
  let bracketDepth = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quote) {
      current += char
      if (char === quote && text[i - 1] !== '\\') quote = null
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      current += char
      continue
    }
    if (char === '{') {
      braceDepth++
      current += char
      continue
    }
    if (char === '}') {
      braceDepth--
      current += char
      continue
    }
    if (char === '[') {
      bracketDepth++
      current += char
      continue
    }
    if (char === ']') {
      bracketDepth--
      current += char
      continue
    }
    if (char === ',' && braceDepth === 0 && bracketDepth === 0) {
      const value = current.trim()
      if (value) entries.push(value)
      current = ''
      continue
    }

    current += char
  }

  const trailing = current.trim()
  if (trailing) entries.push(trailing)
  return entries
}

function parseYamlMap(
  state: { lines: string[]; index: number },
  indent: number,
): { value: MermaidFrontmatterMap; index: number } {
  const map: MermaidFrontmatterMap = {}
  let index = state.index

  while (index < state.lines.length) {
    index = skipYamlNoise(state.lines, index)
    if (index >= state.lines.length) break

    const rawLine = state.lines[index]!
    const lineIndent = getIndent(rawLine)
    if (lineIndent < indent) break
    if (lineIndent > indent) {
      index++
      continue
    }

    const line = rawLine.trim()
    if (line.startsWith('-')) break

    const colonIdx = findSeparatorIndex(line, ':')
    if (colonIdx === -1) {
      index++
      continue
    }

    const key = line.slice(0, colonIdx).trim()
    if (!key) {
      index++
      continue
    }

    const valueText = line.slice(colonIdx + 1).trim()
    index++

    if (isBlockScalarIndicator(valueText)) {
      const block = parseYamlBlockScalar(state.lines, index, lineIndent, valueText[0] as '|' | '>')
      map[key] = block.value
      index = block.index
      continue
    }

    if (valueText.length === 0) {
      const nested = parseYamlNestedValue(state.lines, index, lineIndent)
      map[key] = nested.value
      index = nested.index
      continue
    }

    map[key] = parseYamlValue(valueText)
  }

  state.index = index
  return { value: map, index }
}

function parseYamlSequence(
  state: { lines: string[]; index: number },
  indent: number,
): { value: MermaidFrontmatterList; index: number } {
  const items: MermaidFrontmatterList = []
  let index = state.index

  while (index < state.lines.length) {
    index = skipYamlNoise(state.lines, index)
    if (index >= state.lines.length) break

    const rawLine = state.lines[index]!
    const lineIndent = getIndent(rawLine)
    if (lineIndent < indent) break
    if (lineIndent > indent) {
      index++
      continue
    }

    const line = rawLine.slice(indent).trim()
    if (!line.startsWith('-')) break

    const valueText = line.slice(1).trim()
    index++

    if (valueText.length === 0) {
      const nested = parseYamlNestedValue(state.lines, index, lineIndent)
      items.push(nested.value)
      index = nested.index
      continue
    }

    if (isBlockScalarIndicator(valueText)) {
      const block = parseYamlBlockScalar(state.lines, index, lineIndent, valueText[0] as '|' | '>')
      items.push(block.value)
      index = block.index
      continue
    }

    const colonIdx = findSeparatorIndex(valueText, ':')
    if (
      colonIdx !== -1 &&
      !valueText.startsWith('{') &&
      !valueText.startsWith('[') &&
      !valueText.startsWith('"') &&
      !valueText.startsWith("'")
    ) {
      const key = valueText.slice(0, colonIdx).trim()
      const rawValue = valueText.slice(colonIdx + 1).trim()
      const item: MermaidFrontmatterMap = {}

      if (isBlockScalarIndicator(rawValue)) {
        const block = parseYamlBlockScalar(state.lines, index, lineIndent, rawValue[0] as '|' | '>')
        item[key] = block.value
        index = block.index
      } else if (rawValue.length === 0) {
        const nested = parseYamlNestedValue(state.lines, index, lineIndent)
        item[key] = nested.value
        index = nested.index
      } else {
        item[key] = parseYamlValue(rawValue)
      }

      const nestedState = { lines: state.lines, index }
      const extra = parseYamlMap(nestedState, lineIndent + 2)
      index = nestedState.index
      items.push(Object.keys(extra.value).length > 0 ? mergeFrontmatterMaps(item, extra.value) : item)
      continue
    }

    items.push(parseYamlValue(valueText))
  }

  state.index = index
  return { value: items, index }
}

function parseYamlNestedValue(
  lines: string[],
  startIndex: number,
  parentIndent: number,
): { value: MermaidFrontmatterValue; index: number } {
  const nextIndex = skipYamlNoise(lines, startIndex)
  if (nextIndex >= lines.length) return { value: {}, index: nextIndex }

  const nextLine = lines[nextIndex]!
  const indent = getIndent(nextLine)
  if (indent <= parentIndent) return { value: {}, index: nextIndex }

  const state = { lines, index: nextIndex }
  if (nextLine.slice(indent).trim().startsWith('-')) {
    return parseYamlSequence(state, indent)
  }
  return parseYamlMap(state, indent)
}

function parseYamlBlockScalar(
  lines: string[],
  startIndex: number,
  parentIndent: number,
  mode: '|' | '>',
): { value: string; index: number } {
  let index = startIndex
  const chunks: string[] = []
  let blockIndent: number | undefined

  while (index < lines.length) {
    const rawLine = lines[index]!
    const lineIndent = getIndent(rawLine)
    if (rawLine.trim().length === 0) {
      chunks.push('')
      index++
      continue
    }
    if (lineIndent <= parentIndent) break

    if (blockIndent === undefined) blockIndent = lineIndent
    chunks.push(rawLine.slice(Math.min(rawLine.length, blockIndent)))
    index++
  }

  return {
    value: mode === '>' ? foldYamlBlockScalar(chunks) : chunks.join('\n'),
    index,
  }
}

function parseYamlValue(text: string): MermaidFrontmatterValue {
  const flowValue = parseFlowValue(text)
  return flowValue === undefined ? parseScalar(text) : flowValue
}

function foldYamlBlockScalar(lines: string[]): string {
  let result = ''
  let previousBlank = false

  for (const line of lines) {
    if (line.length === 0) {
      result += result.endsWith('\n') || result.length === 0 ? '\n' : '\n\n'
      previousBlank = true
      continue
    }

    if (result.length > 0 && !previousBlank && !result.endsWith('\n')) result += ' '
    result += line
    previousBlank = false
  }

  return result
}

function skipYamlNoise(lines: string[], index: number): number {
  let cursor = index
  while (cursor < lines.length) {
    const trimmed = lines[cursor]!.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      cursor++
      continue
    }
    break
  }
  return cursor
}

function getIndent(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0
}

function isBlockScalarIndicator(valueText: string): valueText is '|' | '>' | '|-' | '>-' | '|+' | '>+' {
  return /^[|>][-+]?$/.test(valueText)
}

function findSeparatorIndex(text: string, separator: ':' | ','): number {
  let quote: '"' | "'" | null = null
  let braceDepth = 0
  let bracketDepth = 0

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quote) {
      if (char === quote && text[i - 1] !== '\\') quote = null
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      continue
    }
    if (char === '{') {
      braceDepth++
      continue
    }
    if (char === '}') {
      braceDepth--
      continue
    }
    if (char === '[') {
      bracketDepth++
      continue
    }
    if (char === ']') {
      bracketDepth--
      continue
    }
    if (char === separator && braceDepth === 0 && bracketDepth === 0) return i
  }

  return -1
}

function unescapeQuotedString(valueText: string): string {
  try {
    if (valueText.startsWith("'")) {
      return valueText
        .slice(1, -1)
        .replace(/\\\\/g, '\\')
        .replace(/\\'/g, "'")
    }
    return JSON.parse(valueText)
  } catch {
    return valueText.slice(1, -1)
  }
}

export type RoutedDiagramType = 'flowchart' | 'sequence' | 'class' | 'er' | 'timeline' | 'journey' | 'xychart'

/**
 * Return the logical Mermaid lines after frontmatter/init/comment normalization.
 * This is a thin wrapper around the richer source preprocessing used by the
 * public SVG and ASCII entry points.
 */
export function preprocessMermaidLines(text: string): string[] {
  return preprocessMermaidSource(text).lines
}

/**
 * Detect the routed Mermaid diagram family from the first logical line.
 */
export function detectDiagramType(text: string): RoutedDiagramType {
  const firstLine = preprocessMermaidLines(text)[0]?.split(';')[0]?.trim().toLowerCase() ?? ''

  if (/^xychart(-beta)?\b/.test(firstLine)) return 'xychart'
  if (/^timeline\s*$/.test(firstLine)) return 'timeline'
  if (/^journey\s*$/.test(firstLine)) return 'journey'
  if (/^sequencediagram\s*$/.test(firstLine)) return 'sequence'
  if (/^classdiagram\s*$/.test(firstLine)) return 'class'
  if (/^erdiagram\s*$/.test(firstLine)) return 'er'

  return 'flowchart'
}
