import type { PositionedTimelineDiagram, PositionedTimelineSection, PositionedTimelinePeriod, PositionedTimelineEvent } from './types.ts'
import type { DiagramColors } from '../theme.ts'
import { svgOpenTag, buildStyleBlock } from '../theme.ts'
import { renderMultilineText, escapeXml } from '../multiline-utils.ts'

// ============================================================================
// Timeline diagram SVG renderer
//
// Visual language:
//   - crisp section frames aligned with the rest of beautiful-mermaid
//   - a single horizontal rail
//   - period pills above the rail
//   - stacked event cards below with a subtle accent strip
//   - color families grouped by section (or by period when unsectioned)
// ============================================================================

const TL = {
  titleFontSize: 18,
  titleFontWeight: 600,
  sectionFontSize: 12,
  sectionFontWeight: 600,
  pillFontSize: 12,
  pillFontWeight: 600,
  eventFontSize: 12,
  eventFontWeight: 400,
  markerOuterRadius: 8,
  markerInnerRadius: 4.5,
  eventAccentWidth: 4,
} as const

const TL_THEME_FAMILY_ACCENTS = [
  'var(--_arrow)',
  mix('var(--_arrow)', 'var(--_line)', 72),
  mix('var(--_arrow)', 'var(--_text-sec)', 60),
  mix('var(--_line)', 'var(--_text)', 56),
  mix('var(--_arrow)', 'var(--_node-stroke)', 46),
] as const

const TL_DEFAULT_FAMILY_ACCENTS = [
  '#5B7FFF',
  '#159A72',
  '#D18A24',
  '#CC5A5A',
  '#6B7280',
] as const

/**
 * Render a positioned timeline diagram as an SVG string.
 */
export function renderTimelineSvg(
  diagram: PositionedTimelineDiagram,
  colors: DiagramColors,
  font: string = 'Inter',
  transparent: boolean = false
): string {
  const parts: string[] = []
  const useSectionFamilies = diagram.sections.some(section => Boolean(section.label))
  const familyAccents = getTimelineFamilyAccents(colors)

  parts.push(svgOpenTag(diagram.width, diagram.height, colors, transparent))
  parts.push(buildStyleBlock(font, false))
  parts.push(timelineStyles())

  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!
    const familyIndex = useSectionFamilies ? sectionIndex : 0
    if (section.framed) {
      parts.push(renderSectionFrame(section, familyIndex, familyAccents))
    }
  }

  parts.push(
    `<line class="timeline-rail" x1="${diagram.rail.x1}" y1="${diagram.rail.y}" x2="${diagram.rail.x2}" y2="${diagram.rail.y}" />`
  )

  let periodFamilyIndex = 0
  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!
    const sectionFamilyIndex = useSectionFamilies ? sectionIndex : undefined
    for (const period of section.periods) {
      const familyIndex = sectionFamilyIndex ?? periodFamilyIndex++
      parts.push(renderPeriod(period, section.label, familyIndex, familyAccents))
    }
  }

  if (diagram.title) {
    parts.push(
      renderMultilineText(
        diagram.title.text,
        diagram.title.x,
        diagram.title.y,
        TL.titleFontSize,
        `class="timeline-title" text-anchor="middle" font-size="${TL.titleFontSize}" font-weight="${TL.titleFontWeight}"`,
      )
    )
  }

  parts.push('</svg>')
  return parts.join('\n')
}

function timelineStyles(): string {
  return `<style>
  .timeline-title { fill: var(--_text); }
  .timeline-rail { stroke: var(--_line); stroke-width: 1.5; stroke-linecap: round; }
  .timeline-section-bg { fill: var(--tl-section-bg, color-mix(in srgb, var(--_node-fill) 88%, var(--bg))); stroke: var(--tl-event-stroke, var(--_node-stroke)); stroke-width: 1; }
  .timeline-section-band { fill: var(--tl-section-band, color-mix(in srgb, var(--_arrow) 8%, var(--bg))); stroke: var(--tl-event-stroke, var(--_node-stroke)); stroke-width: 1; }
  .timeline-section-label { fill: var(--_text-sec); }
  .timeline-stem { stroke: var(--tl-stem, color-mix(in srgb, var(--_arrow) 32%, var(--_line))); stroke-width: 1; stroke-dasharray: 3 4; }
  .timeline-marker-ring { fill: var(--bg); stroke: var(--tl-marker-ring, var(--_arrow)); stroke-width: 1.5; }
  .timeline-marker-core { fill: var(--tl-marker-core, var(--_arrow)); }
  .timeline-period-pill { fill: var(--tl-pill-fill, color-mix(in srgb, var(--_arrow) 7%, var(--bg))); stroke: var(--tl-pill-stroke, color-mix(in srgb, var(--_arrow) 20%, var(--bg))); stroke-width: 1; }
  .timeline-period-text { fill: var(--_text); }
  .timeline-event-card { fill: var(--tl-event-fill, var(--_node-fill)); stroke: var(--tl-event-stroke, var(--_node-stroke)); stroke-width: 1; }
  .timeline-event-accent { fill: var(--tl-event-accent, color-mix(in srgb, var(--_arrow) 18%, var(--bg))); }
  .timeline-event-text { fill: var(--_text-muted); }
</style>`
}

function renderSectionFrame(
  section: PositionedTimelineSection,
  familyIndex: number,
  familyAccents: readonly string[],
): string {
  const parts: string[] = []
  const labelAttr = section.label ? ` data-label="${escapeAttr(section.label)}"` : ''
  const familyAttr = renderFamilyAttr(familyIndex, familyAccents)
  parts.push(`<g class="timeline-section" data-id="${escapeAttr(section.id)}"${labelAttr}${familyAttr}>`)
  parts.push(
    `  <rect class="timeline-section-bg" x="${section.x}" y="${section.y}" width="${section.width}" height="${section.height}" rx="0" ry="0" />`
  )

  if (section.headerHeight > 0) {
    parts.push(
      `  <rect class="timeline-section-band" x="${section.x}" y="${section.y}" width="${section.width}" height="${section.headerHeight}" rx="0" ry="0" />`
    )
    if (section.label) {
      parts.push(
        '  ' + renderMultilineText(
          section.label,
          section.x + 12,
          section.y + section.headerHeight / 2,
          TL.sectionFontSize,
          `class="timeline-section-label" text-anchor="start" font-size="${TL.sectionFontSize}" font-weight="${TL.sectionFontWeight}"`,
        )
      )
    }
  }

  parts.push('</g>')
  return parts.join('\n')
}

function renderPeriod(
  period: PositionedTimelinePeriod,
  sectionLabel: string | undefined,
  familyIndex: number,
  familyAccents: readonly string[],
): string {
  const parts: string[] = []
  const sectionAttr = sectionLabel ? ` data-section="${escapeAttr(sectionLabel)}"` : ''
  const familyAttr = renderFamilyAttr(familyIndex, familyAccents)

  parts.push(
    `<g class="timeline-period" data-id="${escapeAttr(period.id)}" data-label="${escapeAttr(period.label)}"${sectionAttr}${familyAttr}>`
  )
  parts.push(
    `  <line class="timeline-stem" x1="${period.centerX}" y1="${period.stemTopY}" x2="${period.centerX}" y2="${period.stemBottomY}" />`
  )
  parts.push(
    `  <rect class="timeline-period-pill" x="${period.pillX}" y="${period.pillY}" width="${period.pillWidth}" height="${period.pillHeight}" rx="0" ry="0" />`
  )
  parts.push(
    '  ' + renderMultilineText(
      period.label,
      period.centerX,
      period.pillY + period.pillHeight / 2,
      TL.pillFontSize,
      `class="timeline-period-text" text-anchor="middle" font-size="${TL.pillFontSize}" font-weight="${TL.pillFontWeight}"`,
    )
  )
  parts.push(
    `  <circle class="timeline-marker-ring" cx="${period.centerX}" cy="${period.markerY}" r="${TL.markerOuterRadius}" />`
  )
  parts.push(
    `  <circle class="timeline-marker-core" cx="${period.centerX}" cy="${period.markerY}" r="${TL.markerInnerRadius}" />`
  )

  for (const event of period.events) {
    parts.push(renderEvent(event, sectionLabel, familyIndex, familyAccents.length))
  }

  parts.push('</g>')
  return parts.join('\n')
}

function renderEvent(
  event: PositionedTimelineEvent,
  sectionLabel: string | undefined,
  familyIndex: number,
  familyCount: number,
): string {
  const sectionAttr = sectionLabel ? ` data-section="${escapeAttr(sectionLabel)}"` : ''
  const familyAttr = ` data-family="${familyIndex % familyCount}"`

  return [
    `<g class="timeline-event" data-id="${escapeAttr(event.id)}" data-period="${escapeAttr(event.periodLabel)}"${sectionAttr}${familyAttr}>`,
    `  <rect class="timeline-event-card" x="${event.x}" y="${event.y}" width="${event.width}" height="${event.height}" rx="0" ry="0" />`,
    `  <rect class="timeline-event-accent" x="${event.x}" y="${event.y}" width="${TL.eventAccentWidth}" height="${event.height}" rx="0" ry="0" />`,
    '  ' + renderMultilineText(
      event.text,
      event.x + TL.eventAccentWidth + 12,
      event.y + event.height / 2,
      TL.eventFontSize,
      `class="timeline-event-text" text-anchor="start" font-size="${TL.eventFontSize}" font-weight="${TL.eventFontWeight}"`,
    ),
    '</g>',
].join('\n')
}

function renderFamilyAttr(familyIndex: number, familyAccents: readonly string[]): string {
  const family = familyIndex % familyAccents.length
  const accent = familyAccents[family]!
  const style = [
    `--tl-accent:${accent}`,
    `--tl-section-bg:${mix(accent, 'var(--bg)', 4)}`,
    `--tl-section-band:${mix(accent, 'var(--bg)', 9)}`,
    `--tl-stem:${mix(accent, 'var(--_line)', 36)}`,
    `--tl-pill-fill:${mix(accent, 'var(--bg)', 8)}`,
    `--tl-pill-stroke:${mix(accent, 'var(--bg)', 24)}`,
    `--tl-marker-ring:${accent}`,
    `--tl-marker-core:${accent}`,
    `--tl-event-fill:${mix(accent, 'var(--_node-fill)', 10)}`,
    `--tl-event-stroke:${mix(accent, 'var(--_node-stroke)', 24)}`,
    `--tl-event-accent:${mix(accent, 'var(--bg)', 18)}`,
  ].join(';')

  return ` data-family="${family}" style="${escapeAttr(style)}"`
}

function getTimelineFamilyAccents(colors: DiagramColors): readonly string[] {
  const hasThemeEnrichment = Boolean(
    colors.accent ||
    colors.line ||
    colors.muted ||
    colors.surface ||
    colors.border
  )

  return hasThemeEnrichment ? TL_THEME_FAMILY_ACCENTS : TL_DEFAULT_FAMILY_ACCENTS
}

function mix(primary: string, secondary: string, amount: number): string {
  return `color-mix(in srgb, ${primary} ${amount}%, ${secondary})`
}

function escapeAttr(text: string): string {
  return escapeXml(text)
}
