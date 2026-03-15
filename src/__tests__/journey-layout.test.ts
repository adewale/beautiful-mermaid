/**
 * Direct layout invariants for journey diagrams.
 */
import { describe, it, expect } from 'bun:test'
import { preprocessMermaidLines } from '../mermaid-source.ts'
import { parseJourneyDiagram } from '../journey/parser.ts'
import { layoutJourneyDiagram } from '../journey/layout.ts'

function layout(text: string) {
  const parsed = parseJourneyDiagram(preprocessMermaidLines(text))
  return layoutJourneyDiagram(parsed)
}

describe('layoutJourneyDiagram', () => {
  it('places named sections side by side without overlap', () => {
    const diagram = layout(`journey
      title My working day
      section Go to work
      Make tea: 5: Me
      Go upstairs: 3: Me
      section Go home
      Go downstairs: 5: Me`)

    expect(diagram.sections).toHaveLength(2)
    const first = diagram.sections[0]!
    const second = diagram.sections[1]!

    expect(first.framed).toBe(true)
    expect(second.framed).toBe(true)
    expect(first.headerHeight).toBeGreaterThan(0)
    expect(first.x + first.width).toBeLessThan(second.x)
    expect(first.y).toBe(second.y)
  })

  it('keeps score cells and actor pills inside each task card', () => {
    const diagram = layout(`journey
      section Work
      Prototype<br>review: 3: Design, Eng
      Ship: 5: Eng, QA`)

    const task = diagram.sections[0]!.tasks[0]!

    for (const cell of task.scoreCells) {
      expect(cell.x).toBeGreaterThanOrEqual(task.x)
      expect(cell.y).toBeGreaterThanOrEqual(task.y)
      expect(cell.x + cell.size).toBeLessThanOrEqual(task.x + task.width)
      expect(cell.y + cell.size).toBeLessThanOrEqual(task.y + task.height)
    }

    for (const pill of task.actorPills) {
      expect(pill.x).toBeGreaterThanOrEqual(task.x)
      expect(pill.y).toBeGreaterThanOrEqual(task.y)
      expect(pill.x + pill.width).toBeLessThanOrEqual(task.x + task.width)
      expect(pill.y + pill.height).toBeLessThanOrEqual(task.y + task.height)
    }
  })

  it('leaves a single implicit section unframed while stacking tasks top-to-bottom', () => {
    const diagram = layout(`journey
      Wake up: 3: Me
      Make coffee: 5: Me`)

    expect(diagram.sections).toHaveLength(1)
    const section = diagram.sections[0]!

    expect(section.framed).toBe(false)
    expect(section.headerHeight).toBe(0)
    expect(section.tasks[0]!.y + section.tasks[0]!.height).toBeLessThan(section.tasks[1]!.y)
  })
})
