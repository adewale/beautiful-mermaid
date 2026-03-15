import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'

import { layoutXYChart } from '../xychart/layout.ts'
import { parseXYChart } from '../xychart/parser.ts'

const PROPERTY_RUNS = 50
const WORD_CHARS = [...'abcdefghijklmnopqrstuvwxyz']

const wordArb = fc
  .array(fc.constantFrom(...WORD_CHARS), { minLength: 1, maxLength: 8 })
  .map(chars => chars.join(''))

const categoryLabelArb = fc
  .array(wordArb, { minLength: 1, maxLength: 2 })
  .map(parts => parts.join(' '))

const numberArb = fc.integer({ min: -30, max: 90 })

function toLines(source: string): string[] {
  return source
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('%%'))
}

function renderCategories(labels: string[]): string {
  return labels.join(', ')
}

function renderSeriesLine(type: 'bar' | 'line', values: number[]): string {
  return `${type} [${values.join(', ')}]`
}

function expectInsidePlotArea(
  plotArea: { x: number; y: number; width: number; height: number },
  rect: { x: number; y: number; width: number; height: number },
): void {
  expect(Number.isFinite(rect.x)).toBe(true)
  expect(Number.isFinite(rect.y)).toBe(true)
  expect(Number.isFinite(rect.width)).toBe(true)
  expect(Number.isFinite(rect.height)).toBe(true)
  expect(rect.x >= plotArea.x - 0.0001).toBe(true)
  expect(rect.y >= plotArea.y - 0.0001).toBe(true)
  expect(rect.x + rect.width <= plotArea.x + plotArea.width + 0.0001).toBe(true)
  expect(rect.y + rect.height <= plotArea.y + plotArea.height + 0.0001).toBe(true)
}

describe('property-based xychart parsing', () => {
  it('preserves category labels and per-series data', () => {
    const chartArb = fc.uniqueArray(categoryLabelArb, { minLength: 1, maxLength: 5 }).chain(labels =>
      fc.record({
        labels: fc.constant(labels),
        barValues: fc.array(numberArb, { minLength: labels.length, maxLength: labels.length }),
        lineValues: fc.array(numberArb, { minLength: labels.length, maxLength: labels.length }),
      }),
    )

    fc.assert(
      fc.property(chartArb, ({ labels, barValues, lineValues }) => {
        const lines = toLines([
          'xychart-beta',
          `x-axis [${renderCategories(labels)}]`,
          renderSeriesLine('bar', barValues),
          renderSeriesLine('line', lineValues),
        ].join('\n'))

        const chart = parseXYChart(lines)

        expect(chart.xAxis.categories).toEqual(labels)
        expect(chart.series[0]!.data).toEqual(barValues)
        expect(chart.series[1]!.data).toEqual(lineValues)
      }),
      { numRuns: PROPERTY_RUNS },
    )
  })

  it('derives a y-axis range that always contains all data values', () => {
    const chartArb = fc.integer({ min: 1, max: 5 }).chain(length =>
      fc.record({
        labels: fc.array(categoryLabelArb, { minLength: length, maxLength: length }),
        series: fc.array(
          fc.record({
            type: fc.constantFrom<'bar' | 'line'>('bar', 'line'),
            values: fc.array(numberArb, { minLength: length, maxLength: length }),
          }),
          { minLength: 1, maxLength: 3 },
        ),
      }),
    )

    fc.assert(
      fc.property(chartArb, ({ labels, series }) => {
        const lines = toLines([
          'xychart-beta',
          `x-axis [${renderCategories(labels)}]`,
          ...series.map(entry => renderSeriesLine(entry.type, entry.values)),
        ].join('\n'))

        const chart = parseXYChart(lines)
        const allValues = series.flatMap(entry => entry.values)

        expect(chart.yAxis.range).toBeDefined()
        expect(chart.yAxis.range!.min <= Math.min(...allValues)).toBe(true)
        expect(chart.yAxis.range!.max >= Math.max(...allValues)).toBe(true)
      }),
      { numRuns: PROPERTY_RUNS },
    )
  })
})

describe('property-based xychart layout', () => {
  it('keeps bars, points, and axes inside the plot area for vertical and horizontal charts', () => {
    const layoutArb = fc.integer({ min: 1, max: 5 }).chain(length =>
      fc.record({
        orientation: fc.constantFrom<'horizontal' | 'vertical'>('horizontal', 'vertical'),
        labels: fc.uniqueArray(categoryLabelArb, { minLength: length, maxLength: length }),
        barValues: fc.array(numberArb, { minLength: length, maxLength: length }),
        lineValues: fc.array(numberArb, { minLength: length, maxLength: length }),
      }),
    ).filter(({ barValues }) => barValues.some(value => value >= 0))

    fc.assert(
      fc.property(layoutArb, ({ orientation, labels, barValues, lineValues }) => {
        const header = orientation === 'horizontal' ? 'xychart-beta horizontal' : 'xychart-beta'
        const chart = parseXYChart(toLines([
          header,
          `x-axis [${renderCategories(labels)}]`,
          renderSeriesLine('bar', barValues),
          renderSeriesLine('line', lineValues),
        ].join('\n')))

        const positioned = layoutXYChart(chart)

        expect(positioned.width > 0).toBe(true)
        expect(positioned.height > 0).toBe(true)
        expect(positioned.plotArea.width > 0).toBe(true)
        expect(positioned.plotArea.height > 0).toBe(true)

        for (const bar of positioned.bars) {
          expectInsidePlotArea(positioned.plotArea, bar)
        }

        for (const line of positioned.lines) {
          for (const point of line.points) {
            expect(point.x >= positioned.plotArea.x - 0.0001).toBe(true)
            expect(point.x <= positioned.plotArea.x + positioned.plotArea.width + 0.0001).toBe(true)
            expect(point.y >= positioned.plotArea.y - 0.0001).toBe(true)
            expect(point.y <= positioned.plotArea.y + positioned.plotArea.height + 0.0001).toBe(true)
          }
        }

        for (const tick of positioned.xAxis.ticks) {
          expect(Number.isFinite(tick.x)).toBe(true)
          expect(Number.isFinite(tick.y)).toBe(true)
          expect(Number.isFinite(tick.labelX)).toBe(true)
          expect(Number.isFinite(tick.labelY)).toBe(true)
        }

        for (const tick of positioned.yAxis.ticks) {
          expect(Number.isFinite(tick.x)).toBe(true)
          expect(Number.isFinite(tick.y)).toBe(true)
          expect(Number.isFinite(tick.labelX)).toBe(true)
          expect(Number.isFinite(tick.labelY)).toBe(true)
        }
      }),
      { numRuns: PROPERTY_RUNS },
    )
  })
})
