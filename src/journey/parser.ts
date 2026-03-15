import type { JourneyDiagram, JourneySection, JourneyTask } from './types.ts'
import { normalizeBrTags } from '../multiline-utils.ts'

// ============================================================================
// Journey diagram parser
//
// Parses Mermaid user journey syntax into a JourneyDiagram structure.
//
// Supported syntax:
//   journey
//   title My working day
//   section Go to work
//   Make tea: 5: Me
//   Do work: 1: Me, Cat
// ============================================================================

function normalizeActorLabel(label: string): string {
  return normalizeBrTags(label.trim())
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean)
    .join(' / ')
}

/**
 * Parse a Mermaid user journey diagram.
 * Expects the first line to be "journey".
 */
export function parseJourneyDiagram(lines: string[]): JourneyDiagram {
  const diagram: JourneyDiagram = { sections: [] }

  let currentSection: JourneySection | undefined
  let sectionIndex = 0
  let taskIndex = 0

  const ensureSection = (): JourneySection => {
    if (currentSection) return currentSection
    currentSection = {
      id: `section-${sectionIndex++}`,
      tasks: [],
    }
    diagram.sections.push(currentSection)
    return currentSection
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!

    if (/^journey\b/i.test(line)) continue

    if (/^acc(?:Title|Descr)\b/i.test(line)) continue

    const titleMatch = line.match(/^title\s+(.+)$/i)
    if (titleMatch) {
      diagram.title = normalizeBrTags(titleMatch[1]!.trim())
      continue
    }

    const sectionMatch = line.match(/^section\s+(.+)$/i)
    if (sectionMatch) {
      currentSection = {
        id: `section-${sectionIndex++}`,
        label: normalizeBrTags(sectionMatch[1]!.trim()),
        tasks: [],
      }
      diagram.sections.push(currentSection)
      continue
    }

    const taskMatch = line.match(/^(.+?)\s*:\s*([0-9]+)\s*(?::\s*(.*))?$/)
    if (taskMatch) {
      const text = normalizeBrTags(taskMatch[1]!.trim())
      const rawScore = taskMatch[2]!
      const score = Number.parseInt(rawScore, 10)

      if (!text) {
        throw new Error(`Invalid user journey task: "${line}"`)
      }

      if (!Number.isInteger(score) || score < 1 || score > 5) {
        throw new Error(`Journey task "${text}" has invalid score ${rawScore}. Expected a number between 1 and 5`)
      }

      const actors = (taskMatch[3] ?? '')
        .split(',')
        .map(normalizeActorLabel)
        .filter(Boolean)

      const task: JourneyTask = {
        id: `task-${taskIndex++}`,
        text,
        score,
        actors,
      }

      ensureSection().tasks.push(task)
      continue
    }

    if (line.includes(':')) {
      throw new Error(`Invalid user journey task: "${line}". Expected "Task name: 3: Actor"`)
    }
  }

  if (diagram.sections.length === 0 || diagram.sections.every(section => section.tasks.length === 0)) {
    throw new Error('Journey diagram must include at least one scored task')
  }

  return diagram
}
