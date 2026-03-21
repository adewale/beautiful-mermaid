// ============================================================================
// ASCII renderer — architecture diagrams
//
// Purpose-built renderer that preserves architecture-specific visual identity:
// group frames with headers, service cards with icon indicators, junction
// markers, and labeled edge connections.
// ============================================================================

import { parseArchitectureDiagram } from '../architecture/parser.ts'
import type {
  ArchitectureChildRef,
  ArchitectureDiagram,
  ArchitectureEdge,
  ArchitectureGroup,
  ArchitectureJunction,
  ArchitectureService,
} from '../architecture/types.ts'
import { colorizeLine, DEFAULT_ASCII_THEME } from './ansi.ts'
import type { AsciiConfig, AsciiTheme, CharRole, ColorMode } from './types.ts'

interface StyledSegment {
  text: string
  role: CharRole | null
}

function renderStyledLine(
  segments: StyledSegment[],
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const chars: string[] = []
  const roles: (CharRole | null)[] = []

  for (const segment of segments) {
    for (const char of segment.text) {
      chars.push(char)
      roles.push(segment.role)
    }
  }

  return colorizeLine(chars, roles, theme, colorMode)
}

/**
 * Render a Mermaid architecture diagram to ASCII/Unicode text.
 */
export function renderArchitectureAscii(
  lines: string[],
  config: AsciiConfig,
  colorMode: ColorMode = 'none',
  theme: AsciiTheme = DEFAULT_ASCII_THEME,
): string {
  const diagram = parseArchitectureDiagram(lines)
  const useAscii = config.useAscii
  const out: string[] = []

  const pushLine = (segments: StyledSegment[] = []): void => {
    out.push(segments.length === 0 ? '' : renderStyledLine(segments, colorMode, theme))
  }

  const groupsById = new Map(diagram.groups.map((g) => [g.id, g]))
  const servicesById = new Map(diagram.services.map((s) => [s.id, s]))
  const junctionsById = new Map(diagram.junctions.map((j) => [j.id, j]))

  const tl = useAscii ? '+' : '┌'
  const tr = useAscii ? '+' : '┐'
  const bl = useAscii ? '+' : '└'
  const br = useAscii ? '+' : '┘'
  const h = useAscii ? '-' : '─'
  const v = useAscii ? '|' : '│'
  const arrow = useAscii ? '>' : '►'
  const arrowLeft = useAscii ? '<' : '◄'
  const dash = useAscii ? '-' : '─'
  const junctionMark = useAscii ? '(*)' : '◉'

  renderChildren(diagram.rootChildren, 0)

  if (diagram.edges.length > 0) {
    pushLine()
    for (const edge of diagram.edges) {
      renderEdgeLine(edge)
    }
  }

  return out.join('\n').trimEnd()

  function renderChildren(children: ArchitectureChildRef[], indent: number): void {
    for (let ci = 0; ci < children.length; ci++) {
      const child = children[ci]!

      if (child.kind === 'group') {
        const group = groupsById.get(child.id)!
        renderGroup(group, indent)
      } else if (child.kind === 'service') {
        const service = servicesById.get(child.id)!
        renderService(service, indent)
      } else {
        const junction = junctionsById.get(child.id)!
        renderJunction(junction, indent)
      }

      if (ci < children.length - 1) pushLine()
    }
  }

  function renderGroup(group: ArchitectureGroup, indent: number): void {
    const pad = ' '.repeat(indent)
    const label = group.label.replace(/\n/g, ' ')
    const iconTag = group.icon ? `(${group.icon})` : ''
    const header = `${iconTag}${iconTag ? ' ' : ''}${label}`
    const innerWidth = Math.max(header.length + 4, 30)
    const hBar = h.repeat(innerWidth - 2)

    pushLine([
      { text: pad, role: null },
      { text: tl + hBar + tr, role: 'border' },
    ])
    pushLine([
      { text: pad, role: null },
      { text: v, role: 'border' },
      { text: ' ', role: null },
      { text: header, role: 'text' },
      { text: ' '.repeat(Math.max(0, innerWidth - header.length - 3)), role: null },
      { text: v, role: 'border' },
    ])
    pushLine([
      { text: pad, role: null },
      { text: v + h.repeat(innerWidth - 2) + v, role: 'border' },
    ])

    for (const child of group.children) {
      if (child.kind === 'group') {
        const nested = groupsById.get(child.id)!
        renderGroup(nested, indent + 2)
      } else if (child.kind === 'service') {
        const service = servicesById.get(child.id)!
        renderService(service, indent + 2)
      } else {
        const junction = junctionsById.get(child.id)!
        renderJunction(junction, indent + 2)
      }
    }

    pushLine([
      { text: pad, role: null },
      { text: bl + hBar + br, role: 'border' },
    ])
  }

  function renderService(service: ArchitectureService, indent: number): void {
    const pad = ' '.repeat(indent)
    const icon = service.icon ? `[${service.icon}]` : ''
    const label = service.label.replace(/\n/g, ' ')

    pushLine([
      { text: pad, role: null },
      ...(icon
        ? [
            { text: icon, role: 'arrow' as CharRole },
            { text: ' ', role: null as CharRole | null },
          ]
        : []),
      { text: label, role: 'text' },
    ])
  }

  function renderJunction(junction: ArchitectureJunction, indent: number): void {
    const pad = ' '.repeat(indent)

    pushLine([
      { text: pad, role: null },
      { text: junctionMark, role: 'arrow' },
      { text: ' ', role: null },
      { text: junction.id, role: 'text' },
    ])
  }

  function renderEdgeLine(edge: ArchitectureEdge): void {
    const srcName = itemLabel(edge.source.id)
    const tgtName = itemLabel(edge.target.id)
    const left = edge.hasArrowStart ? arrowLeft + dash : dash + dash
    const right = edge.hasArrowEnd ? dash + arrow : dash + dash
    const label = edge.label ? ` ${edge.label.replace(/\n/g, ' ')} ` : ''

    pushLine([
      { text: '  ', role: null },
      { text: srcName, role: 'text' },
      { text: `:${edge.source.side}`, role: 'border' },
      { text: ' ', role: null },
      { text: left, role: 'line' },
      ...(label
        ? [
            { text: '[', role: 'border' as CharRole },
            { text: label.trim(), role: 'text' as CharRole },
            { text: ']', role: 'border' as CharRole },
          ]
        : []),
      { text: right, role: 'line' },
      { text: ' ', role: null },
      { text: `${edge.target.side}:`, role: 'border' },
      { text: tgtName, role: 'text' },
    ])
  }

  function itemLabel(id: string): string {
    const service = servicesById.get(id)
    if (service) return service.label.replace(/\n/g, ' ')
    return id
  }
}
