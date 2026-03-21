import type { DiagramColors } from '../theme.ts'
import type { MermaidFrontmatterMap, MermaidConfigValue } from '../mermaid-source.ts'
import type { RenderOptions } from '../types.ts'

export interface ArchitectureVisualConfig {
  groupHeaderHeight: number
  groupFontSize: number
  groupFontWeight: number
  serviceFontSize: number
  serviceFontWeight: number
  edgeFontSize: number
  edgeFontWeight: number
  iconSize: number
  serviceIconSize: number
  junctionOuterRadius: number
  junctionInnerRadius: number
  groupSurface?: string
  groupBorder?: string
  serviceSurface?: string
  serviceBorder?: string
}

export interface ResolvedArchitectureVisualConfig {
  visual: ArchitectureVisualConfig
  padding?: number
}

export const DEFAULT_ARCHITECTURE_VISUAL: ArchitectureVisualConfig = {
  groupHeaderHeight: 28,
  groupFontSize: 12,
  groupFontWeight: 600,
  serviceFontSize: 13,
  serviceFontWeight: 500,
  edgeFontSize: 11,
  edgeFontWeight: 400,
  iconSize: 16,
  serviceIconSize: 18,
  junctionOuterRadius: 8,
  junctionInnerRadius: 4.5,
}

/**
 * Resolve architecture-specific visual metrics from Mermaid frontmatter.
 *
 * Color resolution is handled by the shared `buildColors()` in src/index.ts.
 * This function only computes layout metrics (font sizes, icon sizes, junction
 * radii) and architecture-specific surface/border overrides (clusterBkg, etc.).
 */
export function resolveArchitectureVisualConfig(
  mermaidConfig: MermaidFrontmatterMap,
  colors: DiagramColors,
): ResolvedArchitectureVisualConfig {
  const themeVariables = getMap(mermaidConfig, 'themeVariables')
  const architecture = getMap(mermaidConfig, 'architecture')

  const baseFontSize = clamp(
    getNumber(architecture, 'fontSize')
      ?? getNumber(mermaidConfig, 'fontSize')
      ?? getNumber(themeVariables, 'fontSize')
      ?? DEFAULT_ARCHITECTURE_VISUAL.serviceFontSize,
    10,
    24,
  )

  const serviceIconSize = clamp(
    getNumber(architecture, 'iconSize') ?? DEFAULT_ARCHITECTURE_VISUAL.serviceIconSize,
    12,
    40,
  )

  const iconSize = clamp(Math.round(serviceIconSize * (DEFAULT_ARCHITECTURE_VISUAL.iconSize / DEFAULT_ARCHITECTURE_VISUAL.serviceIconSize)), 10, 36)
  const groupFontSize = clamp(Math.round(baseFontSize * 0.92), 10, 22)
  const edgeFontSize = clamp(Math.round(baseFontSize * 0.85), 10, 20)
  const groupHeaderHeight = Math.max(
    DEFAULT_ARCHITECTURE_VISUAL.groupHeaderHeight,
    Math.round(Math.max(groupFontSize, iconSize) + 12),
  )
  const junctionOuterRadius = clamp(Math.round(serviceIconSize * 0.44), 8, 18)
  const junctionInnerRadius = Number((junctionOuterRadius * 0.56).toFixed(1))

  const visual: ArchitectureVisualConfig = {
    groupHeaderHeight,
    groupFontSize,
    groupFontWeight: DEFAULT_ARCHITECTURE_VISUAL.groupFontWeight,
    serviceFontSize: baseFontSize,
    serviceFontWeight: DEFAULT_ARCHITECTURE_VISUAL.serviceFontWeight,
    edgeFontSize,
    edgeFontWeight: DEFAULT_ARCHITECTURE_VISUAL.edgeFontWeight,
    iconSize,
    serviceIconSize,
    junctionOuterRadius,
    junctionInnerRadius,
    groupSurface: pickString(themeVariables, 'clusterBkg') ?? colors.surface,
    groupBorder: pickString(themeVariables, 'clusterBorder') ?? colors.border,
    serviceSurface: pickString(themeVariables, 'mainBkg', 'secondaryColor') ?? colors.surface,
    serviceBorder: pickString(themeVariables, 'primaryBorderColor') ?? colors.border,
  }

  return { visual, padding: getNumber(architecture, 'padding') }
}

function pickString(map: MermaidFrontmatterMap | undefined, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = getString(map, key)
    if (value) return value
  }
  return undefined
}

function getString(map: MermaidFrontmatterMap | undefined, key: string): string | undefined {
  const value = map?.[key]
  return typeof value === 'string' ? value : undefined
}

function getNumber(map: MermaidFrontmatterMap | undefined, key: string): number | undefined {
  return toNumber(map?.[key])
}

function getMap(map: MermaidFrontmatterMap | undefined, key: string): MermaidFrontmatterMap | undefined {
  const value = map?.[key]
  return isMap(value) ? value : undefined
}

function toNumber(value: MermaidConfigValue | undefined): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return undefined

  const normalized = value.trim()
  const match = normalized.match(/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:px)?$/i)
  return match ? Number.parseFloat(normalized) : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function isMap(value: MermaidConfigValue | undefined): value is MermaidFrontmatterMap {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
