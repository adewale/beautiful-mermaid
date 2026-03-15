// ============================================================================
// ASCII renderer — journey diagrams
//
// Renders Mermaid user journeys as compact scored task lists with optional
// section headings and actor annotations.
// ============================================================================

import { parseJourneyDiagram } from '../journey/parser.ts'
import type { AsciiConfig, AsciiTheme, ColorMode } from './types.ts'

function renderScore(score: number, useAscii: boolean): string {
  const filled = useAscii ? '#' : '●'
  const empty = useAscii ? '.' : '○'
  return filled.repeat(score) + empty.repeat(5 - score)
}

/**
 * Render a Mermaid journey diagram to ASCII/Unicode text.
 */
export function renderJourneyAscii(
  text: string,
  config: AsciiConfig,
  _colorMode?: ColorMode,
  _theme?: AsciiTheme,
): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  const diagram = parseJourneyDiagram(lines)
  const useAscii = config.useAscii
  const out: string[] = []

  if (diagram.title) {
    out.push(...diagram.title.split('\n'))
    out.push('')
  }

  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!

    if (section.label) {
      out.push(`[${section.label.replace(/\n/g, ' / ')}]`)
    }

    for (let taskIndex = 0; taskIndex < section.tasks.length; taskIndex++) {
      const task = section.tasks[taskIndex]!
      const score = renderScore(task.score, useAscii)
      const taskLines = task.text.split('\n')

      out.push(`${score} ${taskLines[0] ?? ''}`)
      for (const line of taskLines.slice(1)) {
        out.push(`${' '.repeat(score.length + 1)} ${line}`)
      }

      if (task.actors.length > 0) {
        out.push(`  by ${task.actors.join(', ')}`)
      }

      const moreTasks = taskIndex < section.tasks.length - 1
      const moreSections = sectionIndex < diagram.sections.length - 1
      if (moreTasks || moreSections) out.push('')
    }
  }

  return out.join('\n').trimEnd()
}
