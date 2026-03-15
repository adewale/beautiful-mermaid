import type { PositionedJourneyDiagram, PositionedJourneySection, PositionedJourneyTask, PositionedJourneyActorPill } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { renderMultilineText, escapeXml } from '../multiline-utils.ts'

// ============================================================================
// Journey diagram SVG renderer
//
// Visual language:
//   - crisp section frames consistent with timeline / class / ER styling
//   - stacked task cards with an accent rail
//   - compact score meters and actor pills for readable metadata
// ============================================================================

const JY = {
  titleFontSize: 18,
  titleFontWeight: 600,
  sectionFontSize: 12,
  sectionFontWeight: 600,
  taskFontSize: 13,
  taskFontWeight: 500,
  actorFontSize: 11,
  actorFontWeight: 600,
  taskAccentWidth: 4,
} as const

/**
 * Render a positioned journey diagram as an SVG string.
 */
export function renderJourneySvg(
  diagram: PositionedJourneyDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false
): string {
  const parts: string[] = []

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(journeyStyles())

  for (const section of diagram.sections) {
    if (section.framed) {
      parts.push(renderSectionFrame(section))
    }
  }

  for (const section of diagram.sections) {
    for (const task of section.tasks) {
      parts.push(renderTask(task, section.label))
    }
  }

  if (diagram.title) {
    parts.push(
      renderMultilineText(
        diagram.title.text,
        diagram.title.x,
        diagram.title.y,
        JY.titleFontSize,
        `class="journey-title" text-anchor="middle" font-size="${JY.titleFontSize}" font-weight="${JY.titleFontWeight}"`,
      )
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function journeyStyles(): string {
  return `<style>
  .journey-title { fill: var(--_text); }
  .journey-section-bg { fill: color-mix(in srgb, var(--_node-fill) 88%, var(--bg)); stroke: var(--_node-stroke); stroke-width: 1; }
  .journey-section-band { fill: color-mix(in srgb, var(--_arrow) 8%, var(--bg)); stroke: var(--_node-stroke); stroke-width: 1; }
  .journey-section-label { fill: var(--_text-sec); }
  .journey-task-card { fill: var(--_node-fill); stroke: var(--_node-stroke); stroke-width: 1; }
  .journey-task-accent { fill: color-mix(in srgb, var(--_arrow) 18%, var(--bg)); }
  .journey-task-text { fill: var(--_text); }
  .journey-score-cell-filled { fill: var(--_arrow); stroke: var(--_arrow); stroke-width: 1; }
  .journey-score-cell-empty { fill: color-mix(in srgb, var(--bg) 55%, var(--_node-fill)); stroke: color-mix(in srgb, var(--_node-stroke) 82%, var(--bg)); stroke-width: 1; }
  .journey-actor-pill { fill: color-mix(in srgb, var(--_arrow) 8%, var(--bg)); stroke: color-mix(in srgb, var(--_arrow) 22%, var(--bg)); stroke-width: 1; }
  .journey-actor-text { fill: var(--_text-sec); }
</style>`
}

function renderSectionFrame(section: PositionedJourneySection): string {
  const parts: string[] = []
  const labelAttr = section.label ? ` data-label="${escapeAttr(section.label)}"` : ''

  parts.push(`<g class="journey-section" data-id="${escapeAttr(section.id)}"${labelAttr}>`)
  parts.push(
    `  <rect class="journey-section-bg" x="${section.x}" y="${section.y}" width="${section.width}" height="${section.height}" rx="0" ry="0" />`
  )

  if (section.headerHeight > 0) {
    parts.push(
      `  <rect class="journey-section-band" x="${section.x}" y="${section.y}" width="${section.width}" height="${section.headerHeight}" rx="0" ry="0" />`
    )

    if (section.label) {
      parts.push(
        '  ' + renderMultilineText(
          section.label,
          section.x + 12,
          section.y + section.headerHeight / 2,
          JY.sectionFontSize,
          `class="journey-section-label" text-anchor="start" font-size="${JY.sectionFontSize}" font-weight="${JY.sectionFontWeight}"`,
        )
      )
    }
  }

  parts.push('</g>')
  return parts.join('\n')
}

function renderTask(task: PositionedJourneyTask, sectionLabel?: string): string {
  const parts: string[] = []
  const sectionAttr = sectionLabel ? ` data-section="${escapeAttr(sectionLabel)}"` : ''
  const actorAttr = task.actors.length > 0 ? ` data-actors="${escapeAttr(task.actors.join(', '))}"` : ''

  parts.push(
    `<g class="journey-task" data-id="${escapeAttr(task.id)}" data-score="${task.score}"${sectionAttr}${actorAttr}>`
  )
  parts.push(
    `  <rect class="journey-task-card" x="${task.x}" y="${task.y}" width="${task.width}" height="${task.height}" rx="0" ry="0" />`
  )
  parts.push(
    `  <rect class="journey-task-accent" x="${task.x}" y="${task.y}" width="${JY.taskAccentWidth}" height="${task.height}" rx="0" ry="0" />`
  )
  parts.push(
    '  ' + renderMultilineText(
      task.text,
      task.textX,
      task.textY,
      JY.taskFontSize,
      `class="journey-task-text" text-anchor="start" font-size="${JY.taskFontSize}" font-weight="${JY.taskFontWeight}"`,
    )
  )

  for (const cell of task.scoreCells) {
    parts.push(
      `  <rect class="${cell.filled ? 'journey-score-cell-filled' : 'journey-score-cell-empty'}" x="${cell.x}" y="${cell.y}" width="${cell.size}" height="${cell.size}" rx="2" ry="2" />`
    )
  }

  for (const pill of task.actorPills) {
    parts.push(renderActorPill(pill))
  }

  parts.push('</g>')
  return parts.join('\n')
}

function renderActorPill(pill: PositionedJourneyActorPill): string {
  return [
    `  <g class="journey-actor" data-actor="${escapeAttr(pill.label)}">`,
    `    <rect class="journey-actor-pill" x="${pill.x}" y="${pill.y}" width="${pill.width}" height="${pill.height}" rx="${pill.height / 2}" ry="${pill.height / 2}" />`,
    '    ' + renderMultilineText(
      pill.label,
      pill.x + pill.width / 2,
      pill.y + pill.height / 2,
      JY.actorFontSize,
      `class="journey-actor-text" text-anchor="middle" font-size="${JY.actorFontSize}" font-weight="${JY.actorFontWeight}"`,
    ),
    '  </g>',
  ].join('\n')
}

function escapeAttr(text: string): string {
  return escapeXml(text)
}
