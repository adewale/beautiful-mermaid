/**
 * Tests for the timeline diagram parser.
 *
 * Covers: title, sections, implicit sections, multi-event periods,
 * continuation lines, and error cases.
 */
import { describe, it, expect } from 'bun:test'
import { parseTimelineDiagram } from '../timeline/parser.ts'

function parse(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  return parseTimelineDiagram(lines)
}

describe('parseTimelineDiagram', () => {
  it('parses a basic timeline with a title', () => {
    const diagram = parse(`timeline
      title Product history
      2022 : Private alpha
      2023 : Public launch`)

    expect(diagram.title).toBe('Product history')
    expect(diagram.sections).toHaveLength(1)
    expect(diagram.sections[0]!.periods).toHaveLength(2)
    expect(diagram.sections[0]!.periods[0]!.label).toBe('2022')
    expect(diagram.sections[0]!.periods[0]!.events[0]!.text).toBe('Private alpha')
  })

  it('parses named sections in order', () => {
    const diagram = parse(`timeline
      section Foundation
      2020 : Prototype
      2021 : Beta
      section Growth
      2022 : Launch`)

    expect(diagram.sections).toHaveLength(2)
    expect(diagram.sections[0]!.label).toBe('Foundation')
    expect(diagram.sections[1]!.label).toBe('Growth')
    expect(diagram.sections[1]!.periods[0]!.label).toBe('2022')
  })

  it('creates an implicit section for periods before the first section', () => {
    const diagram = parse(`timeline
      2021 : Quiet alpha
      section Public
      2022 : Launch`)

    expect(diagram.sections).toHaveLength(2)
    expect(diagram.sections[0]!.label).toBeUndefined()
    expect(diagram.sections[0]!.periods[0]!.label).toBe('2021')
    expect(diagram.sections[1]!.label).toBe('Public')
  })

  it('parses multiple events on a single period line', () => {
    const diagram = parse(`timeline
      2024 : Design refresh : Timeline support`)

    expect(diagram.sections[0]!.periods[0]!.events.map(event => event.text)).toEqual([
      'Design refresh',
      'Timeline support',
    ])
  })

  it('parses continuation lines onto the previous period', () => {
    const diagram = parse(`timeline
      2024 : Design refresh
           : Timeline support
           : Craft polish`)

    expect(diagram.sections[0]!.periods[0]!.events.map(event => event.text)).toEqual([
      'Design refresh',
      'Timeline support',
      'Craft polish',
    ])
  })

  it('normalizes <br> tags in title, section labels, periods, and events', () => {
    const diagram = parse(`timeline
      title Platform<br>History
      section Product<br>Work
      2024<br>Q1 : Soft<br>launch`)

    expect(diagram.title).toBe('Platform\nHistory')
    expect(diagram.sections[0]!.label).toBe('Product\nWork')
    expect(diagram.sections[0]!.periods[0]!.label).toBe('2024\nQ1')
    expect(diagram.sections[0]!.periods[0]!.events[0]!.text).toBe('Soft\nlaunch')
  })

  it('throws when a continuation appears before any period', () => {
    expect(() => parse(`timeline
      : orphaned event`)).toThrow('Timeline continuation found before any period was declared')
  })

  it('throws when the diagram has no periods', () => {
    expect(() => parse(`timeline
      title Empty`)).toThrow('Timeline diagram must include at least one period with events')
  })
})
