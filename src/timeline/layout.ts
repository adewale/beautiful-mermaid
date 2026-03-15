import type {
  TimelineDiagram,
  PositionedTimelineDiagram,
  PositionedTimelineSection,
  PositionedTimelinePeriod,
  PositionedTimelineEvent,
} from './types.ts'
import type { RenderOptions } from '../types.ts'
import { measureMultilineText } from '../text-metrics.ts'

// ============================================================================
// Timeline diagram layout engine
//
// Computes direct coordinates for a horizontal timeline with:
//   - optional section frames
//   - period pills above the rail
//   - stacked event cards below the rail
// ============================================================================

const TL = {
  paddingX: 32,
  paddingY: 28,
  titleFontSize: 18,
  titleFontWeight: 600,
  titleGap: 24,
  sectionHeaderHeight: 24,
  sectionHeaderPadX: 12,
  sectionHeaderGap: 14,
  sectionPadX: 18,
  sectionPadBottom: 18,
  sectionGap: 28,
  columnGap: 24,
  pillFontSize: 12,
  pillFontWeight: 600,
  pillPadX: 12,
  pillPadY: 8,
  pillMinWidth: 72,
  railToPillGap: 22,
  railToEventsGap: 28,
  markerRadius: 8,
  eventFontSize: 12,
  eventFontWeight: 400,
  eventPadX: 14,
  eventPadY: 10,
  eventMinWidth: 128,
  eventGap: 10,
} as const

interface PeriodMetric {
  pillWidth: number
  pillHeight: number
  columnWidth: number
  stackHeight: number
  events: Array<{ width: number; height: number }>
}

interface SectionMetric {
  headerWidth: number
  innerWidth: number
  columnAreaWidth: number
  periods: PeriodMetric[]
  maxStackHeight: number
}

/**
 * Lay out a parsed timeline diagram.
 */
export function layoutTimelineDiagram(
  diagram: TimelineDiagram,
  _options: RenderOptions = {}
): PositionedTimelineDiagram {
  const hasNamedSections = diagram.sections.some(section => !!section.label)
  const showSectionFrames = diagram.sections.length > 1 || hasNamedSections
  const sectionHeaderHeight = hasNamedSections ? TL.sectionHeaderHeight : 0
  const sectionPadX = showSectionFrames ? TL.sectionPadX : 0

  const titleMetrics = diagram.title
    ? measureMultilineText(diagram.title, TL.titleFontSize, TL.titleFontWeight)
    : undefined

  const metrics: SectionMetric[] = diagram.sections.map(section => {
    const periodMetrics: PeriodMetric[] = section.periods.map(period => {
      const pillText = measureMultilineText(period.label, TL.pillFontSize, TL.pillFontWeight)
      const pillWidth = Math.max(TL.pillMinWidth, pillText.width + TL.pillPadX * 2)
      const pillHeight = pillText.height + TL.pillPadY * 2

      const eventMetrics = period.events.map(event => {
        const text = measureMultilineText(event.text, TL.eventFontSize, TL.eventFontWeight)
        return {
          width: Math.max(TL.eventMinWidth, text.width + TL.eventPadX * 2),
          height: text.height + TL.eventPadY * 2,
        }
      })

      const columnWidth = Math.max(
        pillWidth,
        ...eventMetrics.map(event => event.width),
      )

      const stackHeight = eventMetrics.reduce((sum, event, index) => {
        const gap = index === 0 ? 0 : TL.eventGap
        return sum + gap + event.height
      }, 0)

      return { pillWidth, pillHeight, columnWidth, stackHeight, events: eventMetrics }
    })

    const columnAreaWidth = periodMetrics.reduce((sum, period, index) => {
      const gap = index === 0 ? 0 : TL.columnGap
      return sum + gap + period.columnWidth
    }, 0)

    const headerWidth = section.label
      ? measureMultilineText(section.label, TL.pillFontSize, TL.pillFontWeight).width + TL.sectionHeaderPadX * 2
      : 0

    const innerWidth = Math.max(columnAreaWidth, headerWidth)
    const maxStackHeight = Math.max(0, ...periodMetrics.map(period => period.stackHeight))

    return { headerWidth, innerWidth, columnAreaWidth, periods: periodMetrics, maxStackHeight }
  })

  const maxPillHeight = Math.max(
    0,
    ...metrics.flatMap(section => section.periods.map(period => period.pillHeight)),
  )

  let contentTop = TL.paddingY
  if (titleMetrics) {
    contentTop += titleMetrics.height
    contentTop += TL.titleGap
  }

  const pillY = contentTop + sectionHeaderHeight + (hasNamedSections ? TL.sectionHeaderGap : 0)
  const railY = pillY + maxPillHeight + TL.railToPillGap
  const eventsTop = railY + TL.railToEventsGap

  let cursorX = TL.paddingX
  const sections: PositionedTimelineSection[] = []
  let maxBottom = railY + TL.markerRadius

  for (let sectionIndex = 0; sectionIndex < diagram.sections.length; sectionIndex++) {
    const section = diagram.sections[sectionIndex]!
    const metric = metrics[sectionIndex]!
    const sectionWidth = metric.innerWidth + sectionPadX * 2
    const columnStartX = cursorX + sectionPadX + (metric.innerWidth - metric.columnAreaWidth) / 2

    let periodCursorX = columnStartX
    const periods: PositionedTimelinePeriod[] = []
    let sectionBottom = railY + TL.markerRadius

    for (let periodIndex = 0; periodIndex < section.periods.length; periodIndex++) {
      const period = section.periods[periodIndex]!
      const periodMetric = metric.periods[periodIndex]!
      const centerX = periodCursorX + periodMetric.columnWidth / 2

      let eventY = eventsTop
      const events: PositionedTimelineEvent[] = period.events.map((event, eventIndex) => {
        const eventMetric = periodMetric.events[eventIndex]!
        const positioned: PositionedTimelineEvent = {
          id: event.id,
          sectionId: section.id,
          periodId: period.id,
          periodLabel: period.label,
          text: event.text,
          x: centerX - eventMetric.width / 2,
          y: eventY,
          width: eventMetric.width,
          height: eventMetric.height,
        }
        eventY += eventMetric.height + TL.eventGap
        return positioned
      })

      const stemBottomY = events.length > 0 ? events[0]!.y - 10 : railY + 16

      periods.push({
        id: period.id,
        sectionId: section.id,
        label: period.label,
        centerX,
        markerY: railY,
        pillX: centerX - periodMetric.pillWidth / 2,
        pillY,
        pillWidth: periodMetric.pillWidth,
        pillHeight: periodMetric.pillHeight,
        stemTopY: railY + TL.markerRadius,
        stemBottomY,
        events,
      })

      if (events.length > 0) {
        const lastEvent = events[events.length - 1]!
        sectionBottom = Math.max(sectionBottom, lastEvent.y + lastEvent.height)
      }

      periodCursorX += periodMetric.columnWidth + TL.columnGap
    }

    sectionBottom += TL.sectionPadBottom
    maxBottom = Math.max(maxBottom, sectionBottom)

    sections.push({
      id: section.id,
      label: section.label,
      x: cursorX,
      y: contentTop,
      width: sectionWidth,
      height: sectionBottom - contentTop,
      framed: showSectionFrames,
      headerHeight: sectionHeaderHeight,
      periods,
    })

    cursorX += sectionWidth
    if (sectionIndex < diagram.sections.length - 1) {
      cursorX += showSectionFrames ? TL.sectionGap : TL.columnGap
    }
  }

  const width = cursorX + TL.paddingX
  const height = maxBottom + TL.paddingY
  const allPeriods = sections.flatMap(section => section.periods)
  const firstCenter = allPeriods[0]?.centerX ?? TL.paddingX
  const lastCenter = allPeriods[allPeriods.length - 1]?.centerX ?? width - TL.paddingX

  return {
    width,
    height,
    title: diagram.title
      ? {
          text: diagram.title,
          x: width / 2,
          y: TL.paddingY + titleMetrics!.height / 2,
        }
      : undefined,
    rail: {
      x1: firstCenter === lastCenter ? firstCenter - 42 : firstCenter,
      x2: firstCenter === lastCenter ? lastCenter + 42 : lastCenter,
      y: railY,
    },
    sections,
  }
}
