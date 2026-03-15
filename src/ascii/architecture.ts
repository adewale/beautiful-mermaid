// ============================================================================
// ASCII renderer — architecture diagrams
//
// Renders Mermaid architecture-beta diagrams through the graph-compatible
// ASCII pipeline while keeping a dedicated entrypoint consistent with the
// other specialized diagram families.
// ============================================================================

import { parseArchitectureDiagram, architectureToMermaidGraph } from '../architecture/parser.ts'
import { convertToAsciiGraph } from './converter.ts'
import { createMapping } from './grid.ts'
import { drawGraph } from './draw.ts'
import { canvasToString, flipCanvasVertically, flipRoleCanvasVertically } from './canvas.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

/**
 * Render a Mermaid architecture diagram to ASCII/Unicode text.
 */
export function renderArchitectureAscii(
  text: string,
  config: AsciiConfig,
  colorMode: ColorMode,
  theme: AsciiTheme,
): string {
  const parsed = architectureToMermaidGraph(parseArchitectureDiagram(text))

  if (parsed.direction === 'LR' || parsed.direction === 'RL') {
    config.graphDirection = 'LR'
  } else {
    config.graphDirection = 'TD'
  }

  const graph = convertToAsciiGraph(parsed, config)
  createMapping(graph)
  drawGraph(graph)

  if (parsed.direction === 'BT') {
    flipCanvasVertically(graph.canvas)
    flipRoleCanvasVertically(graph.roleCanvas)
  }

  return canvasToString(graph.canvas, {
    roleCanvas: graph.roleCanvas,
    colorMode,
    theme,
  })
}
